import assert from "node:assert/strict";
import { prisma } from "../src/db";

async function main() {
  const reports = await prisma.report.findMany({
    where: { id: { in: ["55555555-5555-4555-8555-555555555555", "50000000-0000-4000-8000-000000000002"] } },
    include: { issue: { include: { events: true } }, area: { include: { floor: { include: { building: true } } } } },
  });
  assert.equal(reports.length, 2, "Phải có đủ 2 Report demo");
  for (const report of reports) {
    assert.ok(report.issue, "Report demo thiếu Issue");
    assert.equal(report.issue.status, "SUBMITTED");
    assert.equal(report.issue.events.filter((e) => e.eventType === "REPORT_SUBMITTED").length, 1);
    assert.equal(report.area?.floor.building.code, "A1");
  }
  const roles = await Promise.all(["REPORTER", "STAFF", "MANAGER"].map(async (role) => ({
    role, count: await prisma.user.count({ where: { role: role as "REPORTER" | "STAFF" | "MANAGER", email: { endsWith: "@demo.invalid" } } }),
  })));
  for (const role of roles) assert.equal(role.count, 1, `Phải có 1 User demo vai ${role.role}`);
  console.table(roles);
  console.log("ĐẠT: 2 Report demo giữ quan hệ với 2 Issue SUBMITTED và nhật ký tạo phiếu.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
