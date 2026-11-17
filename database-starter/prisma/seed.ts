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
    // Only the demo category, not an approved full list of official categories.
    await tx.category.upsert({ where: { id: ids.category }, update: {}, create: {
      id: ids.category, code: "ELECTRICAL", nameVi: "Điện", nameEn: "Electrical",
    } });
    const reports = [
      { id: "55555555-5555-4555-8555-555555555555", issueId: "66666666-6666-4666-8666-666666666666", eventId: "90000000-0000-4000-8000-000000000001", device: "H2-03", description: "Bóng đèn H2-03 ở hành lang giữa tầng 2 bị tắt" },
      { id: "50000000-0000-4000-8000-000000000002", issueId: "60000000-0000-4000-8000-000000000002", eventId: "90000000-0000-4000-8000-000000000002", device: "H2-04", description: "Bóng đèn H2-04 ở hành lang giữa tầng 2 nhấp nháy" },
    ];
    const time = new Date("2026-11-17T02:00:00.000Z");
    for (const row of reports) {
      await tx.report.upsert({ where: { id: row.id }, update: {}, create: {
        id: row.id, reporterId: ids.reporter, description: row.description,
        descriptionLang: "vi", proposedCategoryId: ids.category,
        locationKind: "INDOOR", areaId: ids.area, locationDetail: row.device,
        locationSnapshot: { buildingCode: "A1", buildingNameVi: "Tòa A1 (minh họa)", buildingNameEn: "A1 (demo)", floorNameVi: "Tầng 2", floorNameEn: "Floor 2", areaNameVi: "Hành lang giữa", areaNameEn: "Middle corridor" },
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
  console.log("Seed xong: 3 user demo, A1/tầng 2/hành lang, ELECTRICAL, 2 Report + 2 Issue.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
