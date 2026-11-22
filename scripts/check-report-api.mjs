import assert from "node:assert/strict";
import pg from "pg";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Local demo only");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
async function api(path, method, payload, cookie, status) {
  const response = await fetch(base + path, {
    method, headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  assert.ok(result.requestId);
  return { result, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
const report = "/api/reports";
const queue = "/api/manager/issues?status=SUBMITTED";
const session = "/api/dev/session";
const input = { description: "  Demo " + crypto.randomUUID() + "  ",
  location: { kind: "OUTDOOR", detail: "Sân thử nghiệm" } };
const cookies = {};
try {
  await api(report, "POST", input, null, 401);
  await api(queue, "GET", undefined, null, 401);
  for (const role of ["reporter", "staff", "manager"]) {
    const password = process.env["VASTFIX_DEMO_" + role.toUpperCase() + "_PASSWORD"];
    assert.ok(password, "Missing demo password for " + role);
    cookies[role] = (await api(session, "POST", { email: role + "@demo.invalid", password }, null, 200)).cookie;
  }
  await api(queue, "GET", undefined, cookies.reporter, 403);
  await api(queue, "GET", undefined, cookies.staff, 403);
  const indoor = { kind: "INDOOR", buildingId: "11111111-1111-4111-8111-111111111111",
    floorId: "22222222-2222-4222-8222-222222222222", areaId: "33333333-3333-4333-8333-333333333333" };
  await api(report, "POST", { ...input, location: { ...indoor, floorId: crypto.randomUUID() } }, cookies.reporter, 422);
  await api(report, "POST", { ...input, proposedCategoryCode: "INVALID" }, cookies.reporter, 422);
  await api(report, "POST", { ...input, role: "MANAGER" }, cookies.reporter, 422);
  assert.equal((await db.query('SELECT id FROM "Report" WHERE description=$1', [input.description])).rowCount, 0);
  for (const role of ["reporter", "staff", "manager"]) {
    const data = { ...input, description: input.description + role, location: role === "staff" ? indoor : input.location };
    const { result } = await api(report, "POST", data, cookies[role], 201);
    assert.equal(result.issue.status, "SUBMITTED");
    const saved = await db.query(`SELECT r.id AS report, i.id AS issue, u.email, e."eventType"
      FROM "Report" r JOIN "Issue" i ON i."originReportId"=r.id JOIN "User" u ON u.id=r."reporterId"
      JOIN "IssueEvent" e ON e."issueId"=i.id AND e."actorUserId"=u.id WHERE r.description=$1`, [data.description]);
    assert.deepEqual(saved.rows, [{ report: result.report.id, issue: result.issue.id, email: role + "@demo.invalid", eventType: "REPORT_SUBMITTED" }]);
    const page = (await api(queue, "GET", undefined, cookies.manager, 200)).result;
    assert.ok(page.items.some(item => item.issueId === result.issue.id && item.originReportId === result.report.id));
    if (role === "staff") {
      const english = (await api(queue + "&locale=en", "GET", undefined, cookies.manager, 200)).result;
      const item = english.items.find(item => item.issueId === result.issue.id);
      assert.equal(item.locationLabel, "A1 · Floor 2 · Middle corridor");
      assert.equal(item.summary, data.description);
    }
  }
  await api(queue + "&locale=fr", "GET", undefined, cookies.manager, 400);
  await api("/api/duplicate-suggestions?locale=fr", "POST", input, cookies.reporter, 400);
  await api(session, "DELETE", undefined, cookies.manager, 200);
  await api(queue, "GET", undefined, cookies.manager, 401);
  console.log("PASS: authentication, authorization, validation, three-role writes, database events, queue, logout.");
} finally {
  await db.end();
}
