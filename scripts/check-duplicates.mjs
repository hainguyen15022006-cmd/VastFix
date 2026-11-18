// Run with a dedicated development web instance configured as documented.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import pg from "pg";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3319";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) throw new Error("Local demo only");
const query = { description: "Đèn thử", location: { kind: "OUTDOOR", detail: crypto.randomUUID() } };
const session = await fetch(base + "/api/dev/session", { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "reporter@demo.invalid", password: process.env.VASTFIX_DEMO_REPORTER_PASSWORD }) });
assert.equal(session.status, 200);
const cookie = session.headers.get("set-cookie").split(";")[0];
async function post(path, input, authenticated = true) {
  return fetch(base + "/api/" + path, { method: "POST", headers: { "content-type": "application/json", ...(authenticated ? { cookie } : {}) },
    body: JSON.stringify(input) });
}
const suggest = async (input = query) => {
  const response = await post("duplicate-suggestions", input);
  assert.equal(response.status, 200);
  return response.json();
};
let payload;
let mode = "ok";
const mock = createServer(async (req, res) => {
  if (req.url !== "/duplicates" || req.method !== "POST") { res.writeHead(404).end(); return; }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  payload = JSON.parse(raw);
  if (mode === "timeout") return;
  if (mode === "error") { res.writeHead(503).end(); return; }
  res.setHeader("Content-Type", "application/json");
  const suggestions = payload.candidates.map((c, i) => ({ report_id: c.report_id, score: (i + 1) / (payload.candidates.length + 1),
    reason_codes: ["SIMILAR_DESCRIPTION"] }));
  res.end(JSON.stringify({ request_id: payload.request_id, model_version: "contract-test", suggestions: [
    { report_id: crypto.randomUUID(), score: 1, reason_codes: [] }, ...suggestions, suggestions[0],
  ] }));
});
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await new Promise((resolve, reject) => { mock.once("error", reject); mock.listen(18319, "127.0.0.1", resolve); });
  assert.equal((await post("duplicate-suggestions", query, false)).status, 401);
  assert.equal((await post("duplicate-suggestions", { ...query, location: {} })).status, 422);
  const empty = await suggest();
  assert.deepEqual([empty.aiStatus, empty.suggestions, payload], ["ok", [], undefined]);
  const reports = [];
  for (let i = 0; i < 4; i++) {
    const response = await post("reports", query);
    assert.equal(response.status, 201);
    reports.push(await response.json());
  }
  await db.query('UPDATE "Issue" SET status=\'CLOSED\' WHERE id=$1', [reports[2].issue.id]);
  await db.query(`INSERT INTO "IssueMerge" (id,"sourceIssueId","targetIssueId","mergedByUserId",reason)
    SELECT $1,$2,$3,id,'test' FROM "User" WHERE email='manager@demo.invalid'`,
    [crypto.randomUUID(), reports[3].issue.id, reports[0].issue.id]);
  const ranked = await suggest();
  assert.equal(ranked.aiStatus, "ok");
  assert.deepEqual(payload.candidates.map(c => c.report_id).sort(), reports.slice(0,2).map(r => r.report.id).sort());
  assert.deepEqual(ranked.suggestions.map(s => s.score), [2/3, 1/3]);
  assert.equal(payload.request_id, ranked.requestId);
  assert.ok(Number.isFinite(Date.parse(payload.query_time)));
  for (const c of payload.candidates) assert.deepEqual(Object.keys(c).sort(), ["category_code","created_at","description","issue_id","location","report_id"]);
  const indoor = { kind: "INDOOR", buildingId: "11111111-1111-4111-8111-111111111111",
    floorId: "22222222-2222-4222-8222-222222222222", areaId: "33333333-3333-4333-8333-333333333333" };
  const inside = await suggest({ ...query, location: indoor });
  assert.equal(inside.aiStatus, "ok");
  assert.equal(payload.query.location.area_id, indoor.areaId);
  assert.ok(payload.candidates.every(c => c.location.building_id === indoor.buildingId));
  for (mode of ["error", "timeout"]) {
    const fallback = await suggest();
    assert.deepEqual([fallback.aiStatus, fallback.suggestions], ["unavailable", []]);
  }
  assert.equal((await post("reports", query)).status, 201);
  console.log("PASS: empty, indoor/outdoor candidates, closed/merged exclusions, ranking, unknown IDs, timeout, fallback and submission.");
} finally {
  mock.closeAllConnections();
  mock.close();
  await db.end();
}
