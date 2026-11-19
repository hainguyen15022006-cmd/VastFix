import { getDb } from "./db";
import { validateReportInput } from "./report-input";
import type { Prisma } from "../../database-starter/generated/prisma/client";

export function positiveSetting(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2147483647 ? parsed : fallback;
}

export async function prepareCandidates(input: Record<string, unknown>, locale: string) {
  const db = getDb();
  const { description, categoryCode, place } = await validateReportInput(db, input);
  const limit = positiveSetting(process.env.DUPLICATE_CANDIDATE_LIMIT, 50);
  const regions: Prisma.ReportWhereInput[] = [];
  let location;
  if (place.locationKind === "INDOOR") {
    const { buildingId, floorId } = place.locationSnapshot;
    location = { kind: place.locationKind, area_id: place.areaId, building_id: buildingId, floor_id: floorId, detail: place.locationDetail };
    regions.push({ areaId: place.areaId },
      { area: { floorId, id: { not: place.areaId } } },
      { area: { floor: { buildingId, id: { not: floorId } } } });
  } else {
    location = { kind: place.locationKind, detail: place.locationDetail, latitude: place.latitude, longitude: place.longitude };
    const nearby: Prisma.ReportWhereInput[] = [
      { locationDetail: { equals: place.locationDetail, mode: "insensitive" } },
    ];
    if (place.latitude !== null && place.longitude !== null) {
      nearby.push({ latitude: { gte: place.latitude - 0.001, lte: place.latitude + 0.001 },
        longitude: { gte: place.longitude - 0.001, lte: place.longitude + 0.001 } });
    }
    regions.push({ locationKind: "OUTDOOR", OR: nearby });
    // Pins are optional. Without them, free-text place names cannot reliably
    // define a region, so fill the remaining budget from open outdoor issues
    // in this campus pilot and let the AI rank descriptions/location signals.
    if (place.latitude === null && place.longitude === null) {
      regions.push({ locationKind: "OUTDOOR" });
    }
  }

  async function fetchRegion(region: Prisma.ReportWhereInput, take: number, excludedIds: string[]) {
    return db.issue.findMany({
      where: { status: { not: "CLOSED" }, outgoingMerges: { none: { reversedAt: null } },
        id: { notIn: excludedIds }, originReport: region },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }], take,
      select: { id: true, confirmedCategory: { select: { code: true } }, originReport: { select: {
        id: true, description: true, submittedAt: true, locationDetail: true, latitude: true, longitude: true,
        proposedCategory: { select: { code: true } }, area: { include: { floor: { include: { building: true } } } },
      } } },
    });
  }
  const rows: Awaited<ReturnType<typeof fetchRegion>> = [];
  for (const region of regions) {
    if (rows.length >= limit) break;
    rows.push(...await fetchRegion(region, limit - rows.length, rows.map(row => row.id)));
  }
  const candidates = rows.map(({ id, confirmedCategory, originReport: report }) => {
    const area = report.area;
    const floor = area?.floor;
    const detail = report.locationDetail;
    const name = locale === "en" ? "nameEn" : "nameVi";
    const label = area && floor ? [floor.building.code, floor[name], area[name]].join(" · ") : detail ?? "";
    const wire = {
      report_id: report.id, issue_id: id, description: report.description,
      category_code: confirmedCategory?.code ?? report.proposedCategory?.code ?? null,
      created_at: report.submittedAt.toISOString(),
      location: area && floor
        ? { kind: "INDOOR", building_id: floor.buildingId, floor_id: floor.id, area_id: area.id, detail }
        : { kind: "OUTDOOR", latitude: report.latitude, longitude: report.longitude, detail },
    };
    return { label, wire };
  });
  return { query: { description, proposed_category_code: categoryCode, location }, candidates };
}
