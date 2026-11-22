import { ApiError, isRecord, uuid } from "./api";
import type { Prisma } from "../../database-starter/generated/prisma/client";

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
      buildingId: floor.buildingId, floorId: floor.id,
      buildingCode: floor.building.code, buildingNameVi: floor.building.nameVi, buildingNameEn: floor.building.nameEn,
      floorNameVi: floor.nameVi, floorNameEn: floor.nameEn, areaNameVi: area.nameVi, areaNameEn: area.nameEn,
    } };
}

export async function validateReportInput(tx: Prisma.TransactionClient, input: Record<string, unknown>) {
    const { description, proposedCategoryCode, location } = input;
    if (Object.keys(input).some(key => !["description", "proposedCategoryCode", "location"].includes(key)) ||
      typeof description !== "string" || !description.trim() || description.length > 5000) {
      throw new ApiError(422, "VALIDATION_ERROR", "Kiểm tra các trường gửi lên và mô tả (1–5000 ký tự)");
    }
    const place = await resolveLocation(tx, location);
    let proposedCategoryId: string | null = null;
    if (proposedCategoryCode !== undefined) {
      const category = typeof proposedCategoryCode === "string"
        ? await tx.category.findUnique({ where: { code: proposedCategoryCode } }) : null;
      if (!category) throw new ApiError(422, "INVALID_CATEGORY", "Loại sự cố không hợp lệ");
      proposedCategoryId = category.id;
    }
    return { description, place, proposedCategoryId, categoryCode: typeof proposedCategoryCode === "string" ? proposedCategoryCode : null };
}
