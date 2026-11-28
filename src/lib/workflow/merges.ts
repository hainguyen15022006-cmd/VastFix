import { ApiError, uuid } from "@/lib/api";
import { getDb } from "@/lib/db";
import { Prisma, type Role } from "../../../database-starter/generated/prisma/client";
import { requiredText, triageFields, validVersion } from "./inputs";
import { isWriteConflict, lockIssues, touchIssue } from "./locks";

type Actor = { id: string; role: Role };
const selectIssue = {
  id: true, status: true, assigneeId: true, reviewRequired: true,
  outgoingMerges: { where: { reversedAt: null }, select: { id: true } },
  incomingMerges: { where: { reversedAt: null }, select: { id: true } },
  _count: { select: { events: true } },
} satisfies Prisma.IssueSelect;
type SelectedIssue = Prisma.IssueGetPayload<{ select: typeof selectIssue }>;

function conflict(message: string): never { throw new ApiError(409, "MERGE_CONFLICT", message); }
function fields(input: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new ApiError(400, "BAD_REQUEST", "Yêu cầu chứa trường không hợp lệ");
}
function issueVersion(issue: SelectedIssue, version: unknown) {
  if (!validVersion(version)) throw new ApiError(400, "BAD_REQUEST", "Phiên bản phiếu không hợp lệ");
  if (issue._count.events !== version) conflict("Phiếu đã thay đổi, hãy tải lại chi tiết nguồn và đích");
}
function eligible(issue: SelectedIssue) {
  if (!["SUBMITTED", "TRIAGED"].includes(issue.status) || issue.assigneeId || issue.reviewRequired || issue.outgoingMerges.length) {
    conflict("Chỉ gộp phiếu mới/đã tiếp nhận, chưa giao việc và không cần rà soát");
  }
}
async function manager(tx: Prisma.TransactionClient, actor: Actor) {
  if (actor.role !== "MANAGER" || !await tx.user.findFirst({ where: { id: actor.id, role: "MANAGER" }, select: { id: true } })) {
    throw new ApiError(403, "FORBIDDEN", "Chỉ quản lý được thay đổi quan hệ gộp");
  }
}
function mergeError(error: unknown): never {
  if (isWriteConflict(error) || (error && typeof error === "object" && "code" in error && error.code === "P2002")) {
    conflict("Quan hệ gộp hoặc phiếu vừa thay đổi, hãy tải lại");
  }
  throw error;
}
const dto = (issue: SelectedIssue, reviewRequired = issue.reviewRequired) => ({ issueId: issue.id, status: issue.status, reviewRequired, version: issue._count.events + 1 });

export async function mergeIssues(actor: Actor, input: Record<string, unknown>) {
  fields(input, ["sourceIssueId", "targetIssueId", "expectedSourceVersion", "expectedTargetVersion", "reason"]);
  if (!uuid(input.sourceIssueId) || !uuid(input.targetIssueId)) throw new ApiError(400, "BAD_REQUEST", "Cần mã phiếu nguồn và đích hợp lệ");
  const sourceIssueId = input.sourceIssueId.toLowerCase(), targetIssueId = input.targetIssueId.toLowerCase();
  if (sourceIssueId === targetIssueId) throw new ApiError(400, "BAD_REQUEST", "Không thể tự gộp một phiếu");
  const reason = requiredText(input.reason, "reason");
  if (!validVersion(input.expectedSourceVersion) || !validVersion(input.expectedTargetVersion)) throw new ApiError(400, "BAD_REQUEST", "Cần phiên bản nguồn và đích");
  try {
    return await getDb().$transaction(async tx => {
      await manager(tx, actor);
      await lockIssues(tx, [sourceIssueId, targetIssueId]);
      const issues = await tx.issue.findMany({ where: { id: { in: [sourceIssueId, targetIssueId] } }, select: selectIssue });
      const source = issues.find(i => i.id === sourceIssueId), target = issues.find(i => i.id === targetIssueId);
      if (!source || !target) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy phiếu nguồn hoặc đích");
      issueVersion(source, input.expectedSourceVersion); issueVersion(target, input.expectedTargetVersion);
      eligible(source); eligible(target);
      if (source.incomingMerges.length) conflict("Phiếu đang làm đích gộp không thể trở thành nguồn; chỉ gộp một tầng");
      await touchIssue(tx, sourceIssueId); await touchIssue(tx, targetIssueId);
      const merge = await tx.issueMerge.create({ data: { sourceIssueId, targetIssueId, mergedByUserId: actor.id, reason } });
      for (const issue of [source, target]) await tx.issueEvent.create({ data: {
        issueId: issue.id, actorUserId: actor.id, eventType: "ISSUE_MERGED",
        details: { from: issue.status, to: issue.status, mergeId: merge.id, sourceIssueId, targetIssueId, reason, side: issue.id === sourceIssueId ? "SOURCE" : "TARGET" },
      } });
      return { merge: { ...merge, mergeId: merge.id }, issues: { source: dto(source), target: dto(target) } };
    }, { isolationLevel: "Serializable" });
  } catch (error) { return mergeError(error); }
}

export async function reverseMerge(actor: Actor, mergeId: string, input: Record<string, unknown>) {
  fields(input, ["expectedSourceVersion", "expectedTargetVersion", "reason"]);
  if (!uuid(mergeId)) throw new ApiError(400, "BAD_REQUEST", "Mã lần gộp không hợp lệ");
  const reason = requiredText(input.reason, "reason");
  if (!validVersion(input.expectedSourceVersion) || !validVersion(input.expectedTargetVersion)) throw new ApiError(400, "BAD_REQUEST", "Cần phiên bản nguồn và đích");
  try {
    return await getDb().$transaction(async tx => {
      await manager(tx, actor);
      const merge = await tx.issueMerge.findUnique({ where: { id: mergeId } });
      if (!merge) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy lần gộp");
      if (merge.reversedAt) conflict("Lần gộp này đã được hủy");
      await lockIssues(tx, [merge.sourceIssueId, merge.targetIssueId]);
      const issues = await tx.issue.findMany({ where: { id: { in: [merge.sourceIssueId, merge.targetIssueId] } }, select: selectIssue });
      const source = issues.find(i => i.id === merge.sourceIssueId)!, target = issues.find(i => i.id === merge.targetIssueId)!;
      issueVersion(source, input.expectedSourceVersion); issueVersion(target, input.expectedTargetVersion);
      await tx.issue.update({ where: { id: source.id }, data: { reviewRequired: true } });
      await touchIssue(tx, target.id);
      const saved = await tx.issueMerge.update({ where: { id: mergeId }, data: { reversedAt: new Date(), reversedByUserId: actor.id } });
      for (const issue of [source, target]) await tx.issueEvent.create({ data: {
        issueId: issue.id, actorUserId: actor.id, eventType: "ISSUE_UNMERGED",
        details: { from: issue.status, to: issue.status, mergeId, sourceIssueId: source.id, targetIssueId: target.id, reason,
          side: issue.id === source.id ? "SOURCE" : "TARGET" },
      } });
      return { merge: { ...saved, mergeId: saved.id }, reversalReason: reason, issues: { source: dto(source, true), target: dto(target) } };
    }, { isolationLevel: "Serializable" });
  } catch (error) { return mergeError(error); }
}

export async function reviewAfterUnmerge(actor: Actor, issueId: string, input: Record<string, unknown>) {
  fields(input, ["expectedVersion", "categoryCode", "priority", "dueAt", "reason"]);
  if (!uuid(issueId) || !validVersion(input.expectedVersion)) throw new ApiError(400, "BAD_REQUEST", "Mã phiếu hoặc phiên bản không hợp lệ");
  const reason = requiredText(input.reason, "reason");
  try {
    return await getDb().$transaction(async tx => {
      await manager(tx, actor); await lockIssues(tx, [issueId]);
      const issue = await tx.issue.findUnique({ where: { id: issueId }, select: selectIssue });
      if (!issue) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy phiếu");
      issueVersion(issue, input.expectedVersion);
      if (!issue.reviewRequired || issue.outgoingMerges.length || issue.assigneeId || !["SUBMITTED", "TRIAGED"].includes(issue.status)) {
        conflict("Phiếu không ở bước rà lại sau hủy gộp");
      }
      const reversed = await tx.issueMerge.findFirst({ where: { sourceIssueId: issueId, reversedAt: { not: null } },
        orderBy: [{ reversedAt: "desc" }, { id: "desc" }], select: { id: true } });
      if (!reversed) conflict("Phiếu chưa có lần hủy gộp để rà lại");
      const triage = await triageFields(tx, input);
      const saved = await tx.issue.update({ where: { id: issueId }, data: { ...triage.data, status: "TRIAGED", reviewRequired: false },
        select: { id: true, status: true, reviewRequired: true, priority: true, dueAt: true, assigneeId: true } });
      const event = await tx.issueEvent.create({ data: { issueId, actorUserId: actor.id, eventType: "ISSUE_REVIEWED_AFTER_UNMERGE",
        details: { from: issue.status, to: "TRIAGED", ...triage.details, reason, mergeId: reversed.id } }, select: { id: true, eventType: true, occurredAt: true } });
      return { issue: { ...saved, version: issue._count.events + 1 }, event };
    }, { isolationLevel: "Serializable" });
  } catch (error) { return mergeError(error); }
}
