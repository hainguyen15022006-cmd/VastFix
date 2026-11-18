import type { NextRequest } from "next/server";
import { ApiError, body, handle, isRecord, json, uuid } from "@/lib/api";
import { currentUser } from "@/lib/demo-session";
import { getDb } from "@/lib/db";
import type { Prisma } from "../../../../database-starter/generated/prisma/client";

function badLocation(): never {
  throw new ApiError(422, "INVALID_LOCATION", "Vị trí không hợp lệ");
}

async function resolveLocation(tx: Prisma.TransactionClient, input: unknown) {
  if (!isRecord(input)) return badLocation();
  const { kind, detail, latitude, longitude, buildingId, floorId, areaId } = input;
  if (detail != null && typeof detail !== "string") return badLocation();
  if (kind === "OUTDOOR") {
    if (!detail?.trim() || buildingId != null || floorId != null || areaId != null) return badLocation();
    if (latitude != null || longitude != null) {
      if (typeof latitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
          typeof longitude !== "number" || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return badLocation();
    }
    return { locationKind: kind as "OUTDOOR", locationDetail: detail, latitude: latitude ?? null,
      longitude: longitude ?? null, locationSnapshot: { detail } };
  }
  if (kind !== "INDOOR" || !uuid(buildingId) || !uuid(floorId) || !uuid(areaId) ||
      latitude != null || longitude != null) return badLocation();
  const area = await tx.area.findFirst({
    where: { id: areaId, floorId, floor: { buildingId } }, include: { floor: { include: { building: true } } },
  });
  if (!area) return badLocation();
  const { floor } = area;
  return { locationKind: kind as "INDOOR", areaId: area.id, locationDetail: detail ?? null,
    locationSnapshot: {
      buildingCode: floor.building.code, buildingNameVi: floor.building.nameVi, buildingNameEn: floor.building.nameEn,
      floorNameVi: floor.nameVi, floorNameEn: floor.nameEn, areaNameVi: area.nameVi, areaNameEn: area.nameEn,
    } };
}

export function POST(request: NextRequest) {
  return handle(async requestId => {
    const user = await currentUser(request);
    const input = await body(request);
    const { description, proposedCategoryCode, location } = input;
    if (Object.keys(input).some(key => !["description", "proposedCategoryCode", "location"].includes(key)) ||
        typeof description !== "string" || !description.trim() || description.length > 5000) {
      throw new ApiError(422, "VALIDATION_ERROR", "Kiểm tra các trường gửi lên và mô tả (1–5000 ký tự)");
    }
    const result = await getDb().$transaction(async tx => {
      const place = await resolveLocation(tx, location);
      let proposedCategoryId: string | null = null;
      if (proposedCategoryCode !== undefined) {
        const category = typeof proposedCategoryCode === "string"
          ? await tx.category.findUnique({ where: { code: proposedCategoryCode } }) : null;
        if (!category) throw new ApiError(422, "INVALID_CATEGORY", "Loại sự cố không hợp lệ");
        proposedCategoryId = category.id;
      }
      const report = await tx.report.create({
        data: { reporterId: user.id, description, proposedCategoryId, ...place },
        select: { id: true, submittedAt: true },
      });
      const issue = await tx.issue.create({
        data: { originReportId: report.id, status: "SUBMITTED", events: { create: {
          actorUserId: user.id, eventType: "REPORT_SUBMITTED", details: { reportId: report.id },
        } } }, select: { id: true, status: true },
      });
      return { report, issue };
    });
    return json({ ...result, requestId }, 201);
  });
}
