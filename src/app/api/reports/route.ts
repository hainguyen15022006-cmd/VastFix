import type { NextRequest } from "next/server";
import { body, handle, json } from "@/lib/api";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { validateReportInput } from "@/lib/report-input";
import { attachReportPhotos, parseReportPhotoIds, photoConflict } from "@/lib/photo-service";

export function POST(request: NextRequest) {
  return handle(async requestId => {
    const user = await currentUser(request);
    const { photoIds, ...input } = await body(request);
    const ids = parseReportPhotoIds(photoIds);
    const result = await getDb().$transaction(async tx => {
      const { description, place, proposedCategoryId } = await validateReportInput(tx, input);
      const report = await tx.report.create({
        data: { reporterId: user.id, description, proposedCategoryId, ...place },
        select: { id: true, submittedAt: true },
      });
      const issue = await tx.issue.create({
        data: { originReportId: report.id, status: "SUBMITTED", events: { create: {
          actorUserId: user.id, eventType: "REPORT_SUBMITTED", details: { reportId: report.id },
        } } }, select: { id: true, status: true },
      });
      await attachReportPhotos(tx, user.id, report.id, ids);
      return { report, issue };
    }, { isolationLevel: "Serializable" }).catch(photoConflict);
    return json({ ...result, requestId }, 201);
  });
}
