/** Public contract DTOs, deliberately independent from Prisma/server-only modules. */
export const issueStatuses = ["SUBMITTED", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "AWAITING_REVIEW", "CLOSED"] as const;
export type IssueStatus = typeof issueStatuses[number];
export type ManagerIssue = {
  issueId: string;
  originReportId: string;
  summary: string;
  locationLabel: string;
  status: IssueStatus;
  createdAt: string;
};
export type ManagerIssuesResponse = { items: ManagerIssue[]; nextCursor: string | null; requestId: string };
export type QueueFailureKind = "unauthenticated" | "forbidden" | "unavailable";

export class QueueError extends Error {
  constructor(public kind: QueueFailureKind, public requestId?: string) {
    super(kind);
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isIssue(value: unknown): value is ManagerIssue {
  return object(value) && ["issueId", "originReportId", "summary", "locationLabel", "createdAt"].every((key) => typeof value[key] === "string")
    && issueStatuses.includes(value.status as IssueStatus)
    && Number.isFinite(Date.parse(value.createdAt as string));
}

export async function fetchManagerIssues(status: IssueStatus, signal: AbortSignal): Promise<ManagerIssuesResponse> {
  const response = await fetch(`/api/manager/issues?${new URLSearchParams({ status })}`, {
    signal, credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" },
  });
  const data: unknown = await response.json().catch(() => null);
  const requestId = object(data) && typeof data.requestId === "string" ? data.requestId : undefined;
  if (!response.ok) {
    throw new QueueError(response.status === 401 ? "unauthenticated" : response.status === 403 ? "forbidden" : "unavailable", requestId);
  }
  if (!object(data) || !Array.isArray(data.items) || !data.items.every(isIssue)
    || !(data.nextCursor === null || typeof data.nextCursor === "string") || !requestId) {
    throw new QueueError("unavailable", requestId);
  }
  if (new Set(data.items.map((item) => item.issueId)).size !== data.items.length) throw new QueueError("unavailable", requestId);
  return { items: data.items, nextCursor: data.nextCursor, requestId };
}

export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase().trim();
}
