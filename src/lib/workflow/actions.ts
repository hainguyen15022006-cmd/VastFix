import { ApiError, uuid } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { IssueStatus, Prisma, Role } from "../../../database-starter/generated/prisma/client";
import { attachEvidence, hasEvidence } from "./photos";

export const managerActions = ["triage", "assign", "return-work", "close", "reopen", "return-to-triage"] as const;
export const staffActions = ["start", "progress", "submit"] as const;
type Action = typeof managerActions[number] | typeof staffActions[number];

const transitions: Record<Action, { from: IssueStatus[]; to: IssueStatus; event: string; fields: string[] }> = {
  triage: { from: ["SUBMITTED"], to: "TRIAGED", event: "ISSUE_TRIAGED", fields: ["categoryCode", "priority", "dueAt"] },
  assign: { from: ["TRIAGED"], to: "ASSIGNED", event: "ISSUE_ASSIGNED", fields: ["assigneeId"] },
  start: { from: ["ASSIGNED"], to: "IN_PROGRESS", event: "WORK_STARTED", fields: [] },
  progress: { from: ["IN_PROGRESS"], to: "IN_PROGRESS", event: "WORK_PROGRESS_UPDATED", fields: ["progressNote", "materials"] },
  submit: { from: ["IN_PROGRESS"], to: "AWAITING_REVIEW", event: "WORK_SUBMITTED", fields: ["completionNote", "evidencePhotoIds"] },
  "return-work": { from: ["AWAITING_REVIEW"], to: "IN_PROGRESS", event: "WORK_RETURNED", fields: ["reason"] },
  close: { from: ["AWAITING_REVIEW"], to: "CLOSED", event: "ISSUE_CLOSED", fields: ["evidenceReviewed"] },
  reopen: { from: ["CLOSED"], to: "TRIAGED", event: "ISSUE_REOPENED", fields: ["reason"] },
  "return-to-triage": { from: ["ASSIGNED", "IN_PROGRESS"], to: "TRIAGED", event: "ISSUE_RETURNED_TO_TRIAGE", fields: ["reason"] },
};

function conflict(message: string): never {
  throw new ApiError(409, "WORKFLOW_CONFLICT", message);
}

function requiredText(value: unknown, name: string, maxLength = 5000): string {
  if (typeof value === "string" && value.trim() && value.length <= maxLength) return value;
  throw new ApiError(400, "BAD_REQUEST", "Trường không hợp lệ: " + name);
}

function parseDueAt(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) {
    const date = new Date(value);
    const day = new Date(value.slice(0, 10) + "T00:00:00Z");
    if (Number.isFinite(date.getTime()) && Number.isFinite(day.getTime()) &&
        day.toISOString().slice(0, 10) === value.slice(0, 10)) return date;
  }
  throw new ApiError(400, "BAD_REQUEST", "dueAt phải là thời điểm ISO 8601 có múi giờ");
}

export async function applyWorkflow(
  actor: { id: string; role: Role }, issueId: string, action: Action, input: Record<string, unknown>,
) {
  if (!uuid(issueId)) throw new ApiError(400, "BAD_REQUEST", "Mã phiếu không hợp lệ");
  const transition = transitions[action];
  const { expectedVersion } = input;
  if (typeof expectedVersion !== "number" || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
      Object.keys(input).some(key => key !== "expectedVersion" && !transition.fields.includes(key))) {
    throw new ApiError(400, "BAD_REQUEST", "expectedVersion hoặc nội dung yêu cầu không hợp lệ");
  }

  try {
    return await getDb().$transaction(async tx => {
      const issue = await tx.issue.findUnique({
        where: { id: issueId },
        select: { status: true, assigneeId: true, reviewRequired: true,
          outgoingMerges: { where: { reversedAt: null }, take: 1, select: { id: true } },
          _count: { select: { events: true } } },
      });
      if (!issue || (actor.role === "STAFF" && issue.assigneeId !== actor.id)) {
        throw new ApiError(404, "NOT_FOUND", "Không tìm thấy phiếu");
      }
      if (issue.outgoingMerges.length || issue.reviewRequired) conflict("Phiếu đang gộp hoặc cần rà soát");
      const version = issue._count.events;
      if (version !== expectedVersion) conflict("Phiếu đã thay đổi, hãy tải lại");
      if (!transition.from.includes(issue.status)) conflict("Trạng thái hiện tại không cho phép thao tác này");

      const data: Prisma.IssueUncheckedUpdateInput = { status: transition.to };
      const details: Prisma.InputJsonObject = { from: issue.status, to: transition.to };
      let eventDetails = details;
      let evidence: string[] = [];

      switch (action) {
        case "triage": {
          const categoryCode = requiredText(input.categoryCode, "categoryCode", 100);
          const { priority } = input;
          if (priority !== "P0" && priority !== "P1" && priority !== "P2") {
            throw new ApiError(400, "BAD_REQUEST", "Mức ưu tiên không hợp lệ");
          }
          const dueAt = parseDueAt(input.dueAt);
          const category = await tx.category.findUnique({ where: { code: categoryCode }, select: { id: true } });
          if (!category) throw new ApiError(400, "INVALID_CATEGORY", "Loại sự cố không hợp lệ");
          Object.assign(data, { confirmedCategoryId: category.id, priority, dueAt });
          eventDetails = { ...details, categoryCode, priority, dueAt: dueAt.toISOString() };
          break;
        }
        case "assign": {
          const { assigneeId } = input;
          if (!uuid(assigneeId) || !await tx.user.findFirst({
            where: { id: assigneeId, role: "STAFF", emailVerified: true }, select: { id: true },
          })) throw new ApiError(400, "INVALID_ASSIGNEE", "Chọn nhân viên đã xác minh");
          data.assigneeId = assigneeId;
          eventDetails = { ...details, assigneeId };
          break;
        }
        case "progress": {
          const progressNote = requiredText(input.progressNote, "progressNote");
          const materials = input.materials === undefined ? null : requiredText(input.materials, "materials");
          eventDetails = { ...details, progressNote, materials };
          break;
        }
        case "submit": {
          const completionNote = requiredText(input.completionNote, "completionNote");
          const { evidencePhotoIds } = input;
          if (!Array.isArray(evidencePhotoIds) || evidencePhotoIds.length < 1 || evidencePhotoIds.length > 3 ||
              !evidencePhotoIds.every(uuid) || new Set(evidencePhotoIds.map(id => id.toLowerCase())).size !== evidencePhotoIds.length) {
            throw new ApiError(400, "INVALID_EVIDENCE", "Cần từ 1 đến 3 ảnh minh chứng khác nhau");
          }
          evidence = evidencePhotoIds;
          eventDetails = { ...details, completionNote };
          break;
        }
        case "return-work":
        case "return-to-triage":
        case "reopen": {
          eventDetails = { ...details, reason: requiredText(input.reason, "reason") };
          if (action !== "return-work") {
            data.assigneeId = null;
            data.closedAt = null;
          }
          break;
        }
        case "close": {
          if (input.evidenceReviewed !== true) throw new ApiError(400, "BAD_REQUEST", "Cần xác nhận đã xem minh chứng");
          const submission = await tx.issueEvent.findFirst({
            where: { issueId, eventType: "WORK_SUBMITTED" },
            orderBy: [{ occurredAt: "desc" }, { id: "desc" }], select: { id: true },
          });
          if (!submission || !await hasEvidence(tx, issueId, submission.id)) conflict("Phiếu chưa có minh chứng hợp lệ");
          data.closedAt = new Date();
          eventDetails = { ...details, submissionEventId: submission.id };
          break;
        }
      }

      // Even progress updates the Issue row. With Serializable this conflicts with
      // a competing write, including another progress request with the same version.
      const saved = await tx.issue.update({
        where: { id: issueId }, data,
        select: { id: true, status: true, assigneeId: true, closedAt: true, dueAt: true, priority: true },
      });
      const event = await tx.issueEvent.create({
        data: { issueId, actorUserId: actor.id, eventType: transition.event, details: eventDetails },
        select: { id: true, eventType: true, occurredAt: true },
      });
      if (action === "submit") await attachEvidence(tx, issueId, actor.id, event.id, evidence);
      return { issue: { ...saved, version: version + 1 }, event };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      conflict("Phiếu đã thay đổi, hãy tải lại");
    }
    throw error;
  }
}
