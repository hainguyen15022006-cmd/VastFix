import { prisma } from "../src/db";

// Stable demo IDs. These are fictional users, NOT login accounts.
const ids = {
  reporter: "10000000-0000-4000-8000-000000000001",
  staff: "10000000-0000-4000-8000-000000000002",
  manager: "10000000-0000-4000-8000-000000000003",
  building: "11111111-1111-4111-8111-111111111111",
  floor: "22222222-2222-4222-8222-222222222222",
  area: "33333333-3333-4333-8333-333333333333",
  category: "40000000-0000-4000-8000-000000000001",
  groundFloor: "22222222-2222-4222-8222-222222222223",
  restroom: "33333333-3333-4333-8333-333333333334",
  plumbing: "40000000-0000-4000-8000-000000000002",
};

async function main() {
  await prisma.$transaction(async (tx) => {
    const users = [
      { id: ids.reporter, email: "reporter@demo.invalid", role: "REPORTER" as const },
      { id: ids.staff, email: "staff@demo.invalid", role: "STAFF" as const },
      { id: ids.manager, email: "manager@demo.invalid", role: "MANAGER" as const },
    ];
    for (const user of users) {
      await tx.user.upsert({ where: { id: user.id }, update: {}, create: user });
    }
    await tx.building.upsert({ where: { id: ids.building }, update: {}, create: {
      id: ids.building, code: "A1", nameVi: "Tòa A1 (minh họa)", nameEn: "A1 (demo)",
    } });
    await tx.floor.upsert({ where: { id: ids.floor }, update: {}, create: {
      id: ids.floor, buildingId: ids.building, code: "2", nameVi: "Tầng 2", nameEn: "Floor 2",
    } });
    await tx.area.upsert({ where: { id: ids.area }, update: {}, create: {
      id: ids.area, floorId: ids.floor, code: "HALL-MID", nameVi: "Hành lang giữa", nameEn: "Middle corridor",
    } });
    await tx.floor.upsert({ where: { id: ids.groundFloor }, update: {}, create: {
      id: ids.groundFloor, buildingId: ids.building, code: "1", nameVi: "Tầng 1", nameEn: "Floor 1",
    } });
    await tx.area.upsert({ where: { id: ids.restroom }, update: {}, create: {
      id: ids.restroom, floorId: ids.groundFloor, code: "RESTROOM", nameVi: "Nhà vệ sinh", nameEn: "Restroom",
    } });
    // Only the demo category, not an approved full list of official categories.
    await tx.category.upsert({ where: { id: ids.category }, update: {}, create: {
      id: ids.category, code: "ELECTRICAL", nameVi: "Điện", nameEn: "Electrical",
    } });
    await tx.category.upsert({ where: { id: ids.plumbing }, update: {}, create: {
      id: ids.plumbing, code: "PLUMBING", nameVi: "Cấp thoát nước", nameEn: "Plumbing",
    } });
    const reports = [
      { id: "55555555-5555-4555-8555-555555555555", issueId: "66666666-6666-4666-8666-666666666666", eventId: "90000000-0000-4000-8000-000000000001", device: "H2-03", description: "Bóng đèn H2-03 ở hành lang giữa tầng 2 bị tắt" },
      { id: "50000000-0000-4000-8000-000000000002", issueId: "60000000-0000-4000-8000-000000000002", eventId: "90000000-0000-4000-8000-000000000002", device: "H2-04", description: "Bóng đèn H2-04 ở hành lang giữa tầng 2 nhấp nháy" },
      { id: "50000000-0000-4000-8000-000000000003", issueId: "60000000-0000-4000-8000-000000000003", eventId: "90000000-0000-4000-8000-000000000003", device: "TAP-1", description: "Vòi lavabo TAP-1 trong nhà vệ sinh tầng 1 bị rò nước" },
    ];
    const time = new Date("2026-11-17T02:00:00.000Z");
    for (const row of reports) {
      const restroom = row.device === "TAP-1";
      await tx.report.upsert({ where: { id: row.id }, update: {}, create: {
        id: row.id, reporterId: ids.reporter, description: row.description,
        descriptionLang: "vi", proposedCategoryId: restroom ? ids.plumbing : ids.category,
        locationKind: "INDOOR", areaId: restroom ? ids.restroom : ids.area, locationDetail: row.device,
        locationSnapshot: { buildingCode: "A1", buildingNameVi: "Tòa A1 (minh họa)", buildingNameEn: "A1 (demo)", floorNameVi: restroom ? "Tầng 1" : "Tầng 2", floorNameEn: restroom ? "Floor 1" : "Floor 2", areaNameVi: restroom ? "Nhà vệ sinh" : "Hành lang giữa", areaNameEn: restroom ? "Restroom" : "Middle corridor" },
        submittedAt: time,
      } });
      await tx.issue.upsert({ where: { id: row.issueId }, update: {}, create: {
        id: row.issueId, originReportId: row.id, status: "SUBMITTED", createdAt: time,
      } });
      await tx.issueEvent.upsert({ where: { id: row.eventId }, update: {}, create: {
        id: row.eventId, issueId: row.issueId, actorUserId: ids.reporter,
        eventType: "REPORT_SUBMITTED", details: { reportId: row.id, fixture: true }, occurredAt: time,
      } });
    }
  });
  console.log("Seed xong: 3 user demo, A1 minh họa, 2 loại demo, 3 Report + 3 Issue (H2-03, H2-04, TAP-1).");
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
