import type { NextRequest } from "next/server";
import { ApiError, isRecord, uuid } from "@/lib/api";
import { getDb } from "@/lib/db";
import { issueStatuses, type IssueStatus } from "@/lib/manager-issues";
import type { Prisma } from "../../../database-starter/generated/prisma/client";
import { readPhotoLinks } from "./photos";

export const pageSize = 25;
export const activeIssue = { outgoingMerges: { none: { reversedAt: null } } } satisfies Prisma.IssueWhereInput;

export function queueFilters(request: NextRequest, defaultStatus?: IssueStatus) {
  const query = request.nextUrl.searchParams;
  const cursor = query.get("cursor");
  const status = query.get("status") ?? defaultStatus;
  if ((status !== undefined && !issueStatuses.includes(status as IssueStatus)) || (cursor !== null && !uuid(cursor))) {
    throw new ApiError(400, "BAD_REQUEST", "Bộ lọc hoặc con trỏ không hợp lệ");
  }
  return {
    status: status as IssueStatus | undefined,
    pagination: { cursor: cursor ? { id: cursor } : undefined, skip: cursor ? 1 : 0 },
  };
}

export function locationLabel(
  report: { locationKind: string; locationSnapshot: unknown; locationDetail: string | null },
  locale: "vi" | "en",
) {
  const { locationSnapshot: snapshot } = report;
  const suffix = locale === "en" ? "En" : "Vi";
  return report.locationKind === "INDOOR" && isRecord(snapshot)
    ? [snapshot.buildingCode, snapshot["floorName" + suffix], snapshot["areaName" + suffix]]
      .filter(value => typeof value === "string" && value).join(" · ")
    : report.locationDetail ?? "";
}

const reportFields = {
  id: true, description: true, submittedAt: true,
  locationKind: true, locationSnapshot: true, locationDetail: true, latitude: true, longitude: true,
} satisfies Prisma.ReportSelect;

export async function staffQueue(request: NextRequest, staffId: string, locale: "vi" | "en") {
  const { status, pagination } = queueFilters(request);
  const issues = await getDb().issue.findMany({
    where: { ...activeIssue, status, assigneeId: staffId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pagination, take: pageSize + 1,
    select: { id: true, originReportId: true, status: true, priority: true, dueAt: true, createdAt: true,
      originReport: { select: reportFields }, _count: { select: { events: true } } },
  });
  const items = issues.slice(0, pageSize).map(issue => ({
    issueId: issue.id, originReportId: issue.originReportId, status: issue.status,
    priority: issue.priority, dueAt: issue.dueAt, createdAt: issue.createdAt, version: issue._count.events,
    summary: issue.originReport.description, locationLabel: locationLabel(issue.originReport, locale),
  }));
  return { items, nextCursor: issues.length > pageSize ? items[pageSize - 1].issueId : null };
}

const publicDetailKeys = [
  "from", "to", "categoryCode", "priority", "dueAt", "assigneeId", "progressNote",
  "materials", "completionNote", "reason", "reportId", "submissionEventId",
  "mergeId", "sourceIssueId", "targetIssueId", "side",
];

export async function issueDetail(id: string, locale: "vi" | "en", staffId?: string) {
  if (!uuid(id)) throw new ApiError(400, "BAD_REQUEST", "Mã phiếu không hợp lệ");

  return getDb().$transaction(async tx => {
    const issue = await tx.issue.findFirst({
      where: { id, ...(staffId ? { ...activeIssue, assigneeId: staffId } : {}) },
      select: {
        id: true, originReportId: true, status: true, priority: true, dueAt: true, closedAt: true, createdAt: true,
        reviewRequired: true, assigneeId: true, assignee: { select: { id: true, name: true } },
        confirmedCategory: { select: { code: true } }, originReport: { select: reportFields },
        outgoingMerges: { where: { reversedAt: null }, take: 1,
          select: { id: true, sourceIssueId: true, targetIssueId: true, mergedAt: true, reason: true } },
        incomingMerges: { where: { reversedAt: null }, orderBy: { mergedAt: "asc" },
          select: { id: true, sourceIssueId: true, targetIssueId: true, mergedAt: true, reason: true,
            source: { select: { id: true, originReport: { select: reportFields } } } } },
        events: { orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
          select: { id: true, actorUserId: true, eventType: true, occurredAt: true, details: true } },
      },
    });
    if (!issue) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy phiếu");
    const mergeHistory = !staffId ? await tx.issueMerge.findMany({
      where: { OR: [{ sourceIssueId: id }, { targetIssueId: id }] },
      orderBy: [{ mergedAt: "asc" }, { id: "asc" }],
    }) : undefined;

    const related = [{ id: issue.id, originReport: issue.originReport }, ...issue.incomingMerges.map(merge => merge.source)];
    const photos = await readPhotoLinks(tx, issue.id, related.map(item => item.originReport.id));
    const photoDto = (id: string) => ({ photoId: id, url: "/api/photos/" + id });
    const reportPhotos = new Map<string, ReturnType<typeof photoDto>[]>();
    const eventPhotos = new Map<string, ReturnType<typeof photoDto>[]>();
    for (const photo of photos) {
      const photoKey = photo.reportId ?? photo.submissionEventId;
      if (!photoKey) continue;
      const target = photo.reportId ? reportPhotos : eventPhotos;
      const bucket = target.get(photoKey) ?? [];
      bucket.push(photoDto(photo.id));
      target.set(photoKey, bucket);
    }

    const history = issue.events.map(event => ({
      ...event,
      details: isRecord(event.details)
        ? Object.fromEntries(Object.entries(event.details).filter(([key, value]) =>
          publicDetailKeys.includes(key) && (value === null || typeof value === "string")))
        : {},
      evidencePhotos: eventPhotos.get(event.id) ?? [],
    }));

    return {
      id: issue.id, originReportId: issue.originReportId, status: issue.status, priority: issue.priority,
      categoryCode: issue.confirmedCategory?.code ?? null, dueAt: issue.dueAt, closedAt: issue.closedAt,
      createdAt: issue.createdAt, assigneeId: issue.assigneeId, assignee: issue.assignee,
      reviewRequired: issue.reviewRequired, mergedIntoIssueId: issue.outgoingMerges[0]?.targetIssueId ?? null,
      outgoingMerge: issue.outgoingMerges[0] ? { ...issue.outgoingMerges[0], mergeId: issue.outgoingMerges[0].id } : null,
      activeMerges: issue.incomingMerges.map(({ source: _source, ...merge }) => ({ ...merge, mergeId: merge.id })),
      mergeHistory,
      version: issue.events.length,
      reports: related.map(({ id: sourceIssueId, originReport }) => ({
        reportId: originReport.id, issueId: sourceIssueId, description: originReport.description,
        locationLabel: locationLabel(originReport, locale), submittedAt: originReport.submittedAt,
        location: { kind: originReport.locationKind, detail: originReport.locationDetail,
          latitude: originReport.latitude, longitude: originReport.longitude, snapshot: originReport.locationSnapshot },
        photos: reportPhotos.get(originReport.id) ?? [],
      })),
      history,
    };
  }, { isolationLevel: "RepeatableRead" });
}
