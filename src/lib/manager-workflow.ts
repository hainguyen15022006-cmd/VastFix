import { issueStatuses, type IssueStatus } from "./manager-issues";

export type WorkflowPhoto = { photoId: string; url: string };
export type WorkflowReport = { reportId: string; issueId: string; description: string; locationLabel: string; submittedAt: string; photos: WorkflowPhoto[] };
export type WorkflowEvent = { id: string; eventType: string; actorUserId: string | null; occurredAt: string; details: Record<string, string | null>; evidencePhotos: WorkflowPhoto[] };
export type ActiveMerge = { id: string; mergeId: string; sourceIssueId: string; targetIssueId: string; mergedAt: string; reason: string };
export type ManagerDetail = {
  id: string; originReportId: string; status: IssueStatus; categoryCode: string | null;
  priority: "P0" | "P1" | "P2" | null; dueAt: string | null; createdAt: string;
  closedAt: string | null; assigneeId: string | null; assignee: { id: string; name: string } | null;
  version: number; reviewRequired: boolean; mergedIntoIssueId: string | null;
  outgoingMerge?: ActiveMerge | null; activeMerges?: ActiveMerge[];
  reports: WorkflowReport[]; history: WorkflowEvent[];
};

export class DetailError extends Error {
  constructor(public kind: "auth" | "forbidden" | "missing" | "unavailable", public requestId?: string) { super(kind); }
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const stringOrNull = (value: unknown): value is string | null => typeof value === "string" || value === null;
const dateOrNull = (value: unknown): value is string | null => value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
const photos = (value: unknown): value is WorkflowPhoto[] => Array.isArray(value) && value.every(p => record(p) && typeof p.photoId === "string" && p.url === `/api/photos/${p.photoId}`);

export function isManagerDetail(value: unknown): value is ManagerDetail {
  if (!record(value) || typeof value.id !== "string" || typeof value.originReportId !== "string"
    || !issueStatuses.includes(value.status as IssueStatus) || !stringOrNull(value.categoryCode)
    || !(value.priority === null || ["P0", "P1", "P2"].includes(value.priority as string))
    || !dateOrNull(value.dueAt) || !dateOrNull(value.closedAt) || !dateOrNull(value.createdAt)
    || !stringOrNull(value.assigneeId) || !(value.assignee === null || (record(value.assignee) && typeof value.assignee.id === "string" && typeof value.assignee.name === "string"))
    || !Number.isInteger(value.version) || (value.version as number) < 0 || typeof value.reviewRequired !== "boolean"
    || !stringOrNull(value.mergedIntoIssueId) || !Array.isArray(value.reports) || !Array.isArray(value.history)) return false;
  return value.reports.every(report => record(report) && typeof report.reportId === "string" && typeof report.issueId === "string"
    && typeof report.description === "string" && typeof report.locationLabel === "string" && dateOrNull(report.submittedAt) && report.submittedAt !== null && photos(report.photos))
    && value.history.every(event => record(event) && typeof event.id === "string" && typeof event.eventType === "string"
      && stringOrNull(event.actorUserId) && dateOrNull(event.occurredAt) && event.occurredAt !== null
      && record(event.details) && Object.values(event.details).every(stringOrNull) && photos(event.evidencePhotos));
}

export async function fetchManagerDetail(id: string, locale: string, signal: AbortSignal): Promise<ManagerDetail> {
  const response = await fetch(`/api/manager/issues/${encodeURIComponent(id)}?locale=${encodeURIComponent(locale)}`,
    { credentials: "same-origin", cache: "no-store", signal, headers: { Accept: "application/json" } });
  const body: unknown = await response.json().catch(() => null);
  const requestId = record(body) && typeof body.requestId === "string" ? body.requestId : undefined;
  if (!response.ok) throw new DetailError(response.status === 401 ? "auth" : response.status === 403 ? "forbidden" : response.status === 404 ? "missing" : "unavailable", requestId);
  if (!record(body) || !isManagerDetail(body.issue)) throw new DetailError("unavailable", requestId);
  return body.issue;
}

export type ManagerAction = "triage" | "assign" | "return-work" | "close" | "reopen" | "return-to-triage";
export class MutationError extends Error {
  constructor(public kind: "invalid" | "conflict" | "auth" | "forbidden" | "missing" | "unavailable", public requestId?: string) { super(kind); }
}

export async function postManagerAction(id: string, action: ManagerAction, data: Record<string, unknown>): Promise<void> {
  await managerPost(`/api/manager/issues/${encodeURIComponent(id)}/${action}`, data);
}

async function managerPost(url: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data),
  });
  const body: unknown = await response.json().catch(() => null);
  const requestId = record(body) && typeof body.requestId === "string" ? body.requestId : undefined;
  if (!response.ok) throw new MutationError(response.status === 400 ? "invalid" : response.status === 409 ? "conflict" : response.status === 401 ? "auth" : response.status === 403 ? "forbidden" : response.status === 404 ? "missing" : "unavailable", requestId);
  if (!record(body)) throw new MutationError("unavailable", requestId);
  return body;
}

export async function postMerge(sourceIssueId: string, targetIssueId: string, expectedSourceVersion: number, expectedTargetVersion: number, reason: string) {
  return managerPost("/api/manager/merges", { sourceIssueId, targetIssueId, expectedSourceVersion, expectedTargetVersion, reason });
}
export async function postReverseMerge(mergeId: string, expectedSourceVersion: number, expectedTargetVersion: number, reason: string) {
  return managerPost(`/api/manager/merges/${encodeURIComponent(mergeId)}/reverse`, { expectedSourceVersion, expectedTargetVersion, reason });
}
export async function postReviewAfterUnmerge(id: string, data: Record<string, unknown>) {
  return managerPost(`/api/manager/issues/${encodeURIComponent(id)}/review-after-unmerge`, data);
}
