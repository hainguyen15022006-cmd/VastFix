import { issueStatuses, type IssueStatus } from "./manager-issues";

export type WorkflowPhoto = { photoId: string; url: string };
export type WorkflowReport = { reportId: string; issueId: string; description: string; locationLabel: string; submittedAt: string; photos: WorkflowPhoto[] };
export type WorkflowEvent = { id: string; eventType: string; actorUserId: string | null; occurredAt: string; details: Record<string, string | null>; evidencePhotos: WorkflowPhoto[] };
export type ManagerDetail = {
  id: string; originReportId: string; status: IssueStatus; categoryCode: string | null;
  priority: "P0" | "P1" | "P2" | null; dueAt: string | null; createdAt: string;
  closedAt: string | null; assigneeId: string | null; assignee: { id: string; name: string } | null;
  version: number; reviewRequired: boolean; mergedIntoIssueId: string | null;
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
