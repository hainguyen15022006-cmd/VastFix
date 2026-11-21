// Browser DTOs. Never import the database client into a client component.
export type Named = { nameVi: string; nameEn: string };
export type AreaOption = Named & { id: string };
export type FloorOption = AreaOption & { areas: AreaOption[] };
export type BuildingOption = AreaOption & { code: string; floors: FloorOption[] };
export type ReportOptions = { buildings: BuildingOption[]; categories: (Named & { code: string })[]; requestId: string };
export type ReportInput = {
  description: string;
  proposedCategoryCode?: string;
  location: { kind: "INDOOR"; buildingId: string; floorId: string; areaId: string; detail: string }
    | { kind: "OUTDOOR"; detail: string; latitude?: number; longitude?: number };
};
export const reasonCodes = ["SAME_BUILDING", "SAME_FLOOR", "SAME_AREA", "SIMILAR_DESCRIPTION", "SAME_CATEGORY", "RECENT_REPORT"] as const;
export type ReasonCode = typeof reasonCodes[number];
export type Suggestion = { reportId: string; issueId: string; score: number; reasonCodes: ReasonCode[]; summary: string; locationLabel: string; createdAt: string };
export type Suggestions = { aiStatus: "ok" | "unavailable"; suggestions: Suggestion[]; requestId: string };
export type Receipt = { report: { id: string; submittedAt: string }; issue: { id: string; status: "SUBMITTED" }; requestId: string };

export class ReportApiError extends Error {
  constructor(public code: string, public requestId?: string) { super(code); }
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string";
const id = (v: unknown): v is string => text(v) && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v);
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
const named = (v: unknown): v is Named & Record<string, unknown> => object(v) && text(v.nameVi) && text(v.nameEn);
const area = (v: unknown): v is AreaOption & Record<string, unknown> => named(v) && id(v.id);

async function request(path: string, signal: AbortSignal, input?: ReportInput) {
  const response = await fetch(path, {
    method: input ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal,
    headers: { Accept: "application/json", ...(input ? { "Content-Type": "application/json" } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
  const data: unknown = await response.json().catch(() => null);
  const requestId = object(data) && text(data.requestId) ? data.requestId : undefined;
  if (!response.ok) {
    const code = response.status === 401 ? "UNAUTHENTICATED" : response.status === 403 ? "FORBIDDEN"
      : object(data) && object(data.error) && text(data.error.code) ? data.error.code : "INTERNAL_ERROR";
    throw new ReportApiError(code, requestId);
  }
  if (!object(data) || !id(data.requestId)) throw new ReportApiError("INVALID_RESPONSE", requestId);
  return { data, status: response.status };
}

export async function getReportOptions(signal: AbortSignal): Promise<ReportOptions> {
  const { data } = await request("/api/report-options", signal);
  if (!Array.isArray(data.buildings) || !data.buildings.every(b => area(b) && text(b.code) && Array.isArray(b.floors)
    && b.floors.every(f => area(f) && Array.isArray(f.areas) && f.areas.every(area)))
    || !Array.isArray(data.categories) || !data.categories.every(c => named(c) && text(c.code))) {
    throw new ReportApiError("INVALID_RESPONSE", data.requestId as string);
  }
  return data as unknown as ReportOptions;
}

export async function getSuggestions(input: ReportInput, signal: AbortSignal): Promise<Suggestions> {
  const { data } = await request("/api/duplicate-suggestions", signal, input);
  if (!["ok", "unavailable"].includes(data.aiStatus as string) || !Array.isArray(data.suggestions)
    || data.suggestions.length > 5 || !data.suggestions.every(s => object(s) && id(s.reportId) && id(s.issueId)
      && text(s.summary) && text(s.locationLabel) && date(s.createdAt) && typeof s.score === "number"
      && Number.isFinite(s.score) && s.score >= 0 && s.score <= 1 && Array.isArray(s.reasonCodes)
      && s.reasonCodes.every(r => reasonCodes.includes(r as ReasonCode)))
    || new Set(data.suggestions.map(s => s.reportId)).size !== data.suggestions.length
    || data.suggestions.some((s, i, all) => i > 0 && all[i - 1].score < s.score)
    || (data.aiStatus === "unavailable" && data.suggestions.length !== 0)) {
    throw new ReportApiError("INVALID_RESPONSE", data.requestId as string);
  }
  return data as unknown as Suggestions;
}

export async function submitReport(input: ReportInput, signal: AbortSignal): Promise<Receipt> {
  const { data, status } = await request("/api/reports", signal, input);
  if (status !== 201 || !object(data.report) || !id(data.report.id) || !date(data.report.submittedAt)
    || !object(data.issue) || !id(data.issue.id) || data.issue.status !== "SUBMITTED") {
    throw new ReportApiError("INVALID_RESPONSE", data.requestId as string);
  }
  return data as unknown as Receipt;
}
