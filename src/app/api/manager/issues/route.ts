import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requestLocale } from "@/lib/request-locale";
import { requireWorkflowRole } from "@/lib/workflow/http";
import { activeIssue, locationLabel, pageSize, queueFilters } from "@/lib/workflow/queries";

export function GET(request: NextRequest) {
  return handle(async requestId => {
    const user = await requireWorkflowRole(request, "MANAGER");
    const { status, pagination } = queueFilters(request, "SUBMITTED");
    const locale = requestLocale(request, user.locale);
    const issues = await getDb().issue.findMany({
      where: { ...activeIssue, status },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pagination, take: pageSize + 1, include: { originReport: true },
    });
    const items = issues.slice(0, pageSize).map(issue => ({
      issueId: issue.id, originReportId: issue.originReportId, summary: issue.originReport.description,
      locationLabel: locationLabel(issue.originReport, locale), status: issue.status, createdAt: issue.createdAt,
    }));
    return json({ items, nextCursor: issues.length > pageSize ? items[pageSize - 1].issueId : null, requestId });
  });
}
