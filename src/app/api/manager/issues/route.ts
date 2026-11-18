import type { NextRequest } from "next/server";
import { ApiError, handle, isRecord, json, uuid } from "@/lib/api";
import { currentUser } from "@/lib/demo-session";
import { getDb } from "@/lib/db";

const pageSize = 25;

export function GET(request: NextRequest) {
  return handle(async requestId => {
    const user = await currentUser(request);
    if (user.role !== "MANAGER") throw new ApiError(403, "FORBIDDEN", "Chỉ quản lý được xem hàng đợi");
    const query = request.nextUrl.searchParams;
    const cursor = query.get("cursor");
    if ((query.get("status") ?? "SUBMITTED") !== "SUBMITTED" || (cursor !== null && !uuid(cursor))) {
      throw new ApiError(400, "BAD_REQUEST", "Bộ lọc hoặc con trỏ không hợp lệ");
    }
    const issues = await getDb().issue.findMany({
      where: { status: "SUBMITTED" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: pageSize + 1, include: { originReport: true },
    });
    const lang = user.locale === "en" ? "En" : "Vi";
    const items = issues.slice(0, pageSize).map(issue => {
      const report = issue.originReport;
      const snapshot = report.locationSnapshot;
      const locationLabel = report.locationKind === "INDOOR" && isRecord(snapshot)
        ? [snapshot.buildingCode, snapshot["floorName" + lang], snapshot["areaName" + lang]].filter(Boolean).join(" · ")
        : report.locationDetail;
      return { issueId: issue.id, originReportId: report.id, summary: report.description,
        locationLabel, status: issue.status, createdAt: issue.createdAt };
    });
    return json({ items, nextCursor: issues.length > pageSize ? items[pageSize - 1].issueId : null, requestId });
  });
}
