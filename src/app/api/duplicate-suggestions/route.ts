import type { NextRequest } from "next/server";
import { body, handle, isRecord, json } from "@/lib/api";
import { currentUser } from "@/lib/current-user";
import { positiveSetting, prepareCandidates } from "@/lib/duplicate-candidates";

const reasons = new Set(["SAME_BUILDING", "SAME_FLOOR", "SAME_AREA", "SIMILAR_DESCRIPTION", "SAME_CATEGORY", "RECENT_REPORT"]);

export function POST(request: NextRequest) {
  return handle(async requestId => {
    const user = await currentUser(request);
    const { query, candidates } = await prepareCandidates(await body(request), user.locale);
    if (!candidates.length) return json({ requestId, aiStatus: "ok", suggestions: [] });
    const byId = new Map(candidates.map(candidate => [candidate.wire.report_id, candidate]));
    try {
      const url = new URL("/duplicates", process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000");
      const response = await fetch(url, {
        method: "POST", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(positiveSetting(process.env.DUPLICATE_TIMEOUT_MS, 5000)),
        body: JSON.stringify({ request_id: requestId, query_time: new Date().toISOString(), query,
          candidates: candidates.map(candidate => candidate.wire), limit: 5 }),
      });
      if (!response.ok) throw new Error("upstream-http");
      const result: unknown = await response.json();
      if (!isRecord(result) || result.request_id !== requestId || typeof result.model_version !== "string" ||
          !result.model_version.trim() || !Array.isArray(result.suggestions)) throw new Error("upstream-schema");
      const seen = new Set<string>();
      const suggestions = [];
      for (const item of result.suggestions) {
        if (!isRecord(item) || typeof item.report_id !== "string") throw new Error("upstream-item");
        const match = byId.get(item.report_id);
        if (!match) {
          console.warn("Unknown AI candidate", requestId);
          continue;
        }
        if (typeof item.score !== "number" || !Number.isFinite(item.score) || item.score < 0 || item.score > 1 ||
            !Array.isArray(item.reason_codes) || !item.reason_codes.every(r => typeof r === "string" && reasons.has(r))) {
          throw new Error("upstream-item");
        }
        if (seen.has(item.report_id)) continue;
        seen.add(item.report_id);
        suggestions.push({ reportId: match.wire.report_id, issueId: match.wire.issue_id, score: item.score,
          reasonCodes: item.reason_codes, summary: match.wire.description, locationLabel: match.label, createdAt: match.wire.created_at });
      }
      suggestions.sort((a, b) => b.score - a.score);
      return json({ requestId, aiStatus: "ok", suggestions: suggestions.slice(0, 5) });
    } catch (error) {
      console.warn("Duplicate ranking unavailable", requestId, error instanceof Error ? error.name : "Error");
      return json({ requestId, aiStatus: "unavailable", suggestions: [] });
    }
  });
}
