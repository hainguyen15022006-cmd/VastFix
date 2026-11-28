// Run after npm run build. This uses an isolated PostgreSQL and real Better Auth.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { hashPassword } from "better-auth/crypto";

const port = Number(process.env.WORKFLOW_TEST_PORT || 3121);
const dbPort = Number(process.env.WORKFLOW_TEST_DB_PORT || 55440);
const base = "http://127.0.0.1:" + port;
const password = randomBytes(24).toString("base64url");
const dbPassword = randomBytes(24).toString("base64url");
const root = resolve("data/private");
await mkdir(root, { recursive: true });
const database = new EmbeddedPostgres({
  databaseDir: await mkdtemp(join(root, "workflow-")),
  user: "postgres", password: dbPassword, port: dbPort, persistent: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"], postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {}, onError: console.error,
});
const env = {
  ...process.env, DATABASE_URL: "postgresql://postgres:" + dbPassword + "@127.0.0.1:" + dbPort + "/postgres?schema=public",
  BETTER_AUTH_URL: base, BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
  VASTFIX_DEMO_AUTH: "0", NEXT_TELEMETRY_DISABLED: "1",
};
const users = {};
let db, web, started = false, logs = "";

function run(args) {
  const child = spawn(process.execPath, args, { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", chunk => { logs += chunk; });
  child.stderr.on("data", chunk => { logs += chunk; });
  return child;
}

async function call(user, path, input, expected = 200) {
  const headers = { origin: base };
  if (user) headers.cookie = users[user].cookie;
  if (input !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(base + "/api/" + path, {
    method: input === undefined ? "GET" : "POST", headers, body: JSON.stringify(input),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await response.json();
  assert.equal(response.status, expected, path + " " + JSON.stringify(data));
  assert.equal(typeof data.requestId, "string");
  return data;
}

async function makeIssue(description) {
  return call("reporter", "reports", { description, location: { kind: "OUTDOOR", detail: "Sân kiểm thử" } }, 201);
}

async function photo(issueId, { owner = "staffA", purpose = "WORK_EVIDENCE", saved = true } = {}) {
  const id = randomUUID();
  await db.query(
    'INSERT INTO "Photo" (id,"issueId","ownerUserId",purpose,"storedAt","storageKey","mimeType","sizeBytes") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, issueId, users[owner].id, purpose, saved ? new Date() : null, "workflow-test/" + id + ".jpg", "image/jpeg", 128],
  );
  return id;
}

const triage = { categoryCode: "ELECTRICAL", priority: "P1", dueAt: "2026-11-26T14:00:00+07:00" };
const workflow = "manager/issues/";
const assigned = "staff/issues/";
try {
  await database.initialise();
  await database.start();
  started = true;
  db = database.getPgClient();
  await db.connect();
  const migrations = "database-starter/prisma/migrations";
  const entries = await readdir(migrations, { withFileTypes: true });
  for (const folder of entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
    await db.query(await readFile(join(migrations, folder, "migration.sql"), "utf8"));
  }
  assert.equal((await once(run(["--import", "tsx", "database-starter/prisma/seed.ts"]), "exit"))[0], 0, logs);
  const hash = await hashPassword(password);
  for (const [name, role] of Object.entries({ reporter: "REPORTER", manager: "MANAGER", staffA: "STAFF", staffB: "STAFF" })) {
    const id = randomUUID(), email = name.toLowerCase() + ".workflow@usth.edu.vn";
    await db.query('INSERT INTO "User" (id,email,name,role,"emailVerified") VALUES ($1,$2,$3,$4,true)', [id, email, name, role]);
    await db.query('INSERT INTO "Account" (id,"userId","accountId","providerId",password) VALUES ($1,$2,$3,\'credential\',$4)', [randomUUID(), id, id, hash]);
    users[name] = { id, email };
  }
  web = run(["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)]);
  let ready = false;
  for (let i = 0; i < 45 && web.exitCode === null; i++) {
    try {
      if ((await fetch(base + "/api/health", { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  assert.ok(ready, logs);
  for (const user of Object.values(users)) {
    const signIn = () => fetch(base + "/api/auth/sign-in/email", {
      method: "POST", headers: { "Content-Type": "application/json", origin: base },
      body: JSON.stringify({ email: user.email, password }),
    });
    let response = await signIn();
    if (response.status === 429) {
      const retrySeconds = Number(response.headers.get("x-retry-after") || 10);
      await response.body?.cancel();
      await new Promise(resolve => setTimeout(resolve, (retrySeconds + 1) * 1000));
      response = await signIn();
    }
    assert.equal(response.status, 200);
    user.cookie = response.headers.getSetCookie().map(cookie => cookie.split(";")[0]).join("; ");
    assert.ok(user.cookie);
  }

  await call(null, "manager/staff", undefined, 401);
  await call("reporter", "manager/staff", undefined, 403);
  await call("reporter", "staff/issues", undefined, 403);
  assert.deepEqual((await call("manager", "manager/staff")).items.map(u => u.id).sort(), [users.staffA.id, users.staffB.id].sort());

  const original = await makeIssue("Đèn khu C không sáng");
  const id = original.issue.id;
  const detail = async () => (await call("manager", workflow + id)).issue;
  const manager = (action, version, input = {}, code = 200) =>
    call("manager", workflow + id + "/" + action, { expectedVersion: version, ...input }, code);
  const staff = (action, version, input = {}, code = 200) =>
    call("staffA", assigned + id + "/" + action, { expectedVersion: version, ...input }, code);
  const queue = async status => (await call("manager", "manager/issues?status=" + status)).items;
  let version = (await detail()).version;
  assert.equal(version, 1);
  assert.ok((await call("manager", "manager/issues")).items.some(item => item.issueId === id));
  await call("manager", "manager/issues?status=UNKNOWN", undefined, 400);
  await manager("triage", version, { ...triage, dueAt: "2026-02-30T14:00:00+07:00" }, 400);
  await manager("triage", version, { ...triage, actorUserId: users.staffA.id }, 400);
  let changed = (await manager("triage", version, triage)).issue;
  version = changed.version;
  assert.equal(changed.status, "TRIAGED");
  assert.equal(changed.dueAt, "2026-11-26T07:00:00.000Z");
  await manager("assign", version, { assigneeId: users.reporter.id }, 400);
  const competing = await Promise.all([users.staffA.id, users.staffB.id].map(assigneeId =>
    fetch(base + "/api/" + workflow + id + "/assign", {
      method: "POST", headers: { cookie: users.manager.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: version, assigneeId }),
    })));
  assert.deepEqual(competing.map(response => response.status).sort(), [200, 409]);
  assert.equal((await detail()).history.filter(event => event.eventType === "ISSUE_ASSIGNED").length, 1);
  changed = await detail();
  if (changed.assigneeId !== users.staffA.id) {
    changed = (await manager("return-to-triage", changed.version, { reason: "Chuyển sang ca A" })).issue;
    changed = (await manager("assign", changed.version, { assigneeId: users.staffA.id })).issue;
  }
  version = changed.version;
  assert.equal((await queue("ASSIGNED")).some(item => item.issueId === id), true);
  assert.equal((await call("staffA", "staff/issues?status=ASSIGNED")).items[0].issueId, id);
  assert.equal((await call("staffB", "staff/issues")).items.length, 0);
  await call("staffB", assigned + id, undefined, 404);
  await call("staffB", assigned + id + "/start", { expectedVersion: version }, 404);
  await call("manager", assigned + id + "/start", { expectedVersion: version }, 403);
  version = (await staff("start", version)).issue.version;
  const note = "Kiểm dây\nĐã ngắt điện";
  version = (await staff("progress", version, { progressNote: note, materials: "Một bóng LED" })).issue.version;
  assert.equal((await detail()).history.at(-1).details.progressNote, note);
  await staff("submit", version, { completionNote: "Xong", evidencePhotoIds: [] }, 400);
  // Production migrations now create Photo. Unknown IDs are invalid evidence,
  // while missing storage remains a distinct 503 that must roll back the write.
  await staff("submit", version, { completionNote: "Xong", evidencePhotoIds: [randomUUID()] }, 400);
  assert.equal((await detail()).version, version);
  await db.query('ALTER TABLE "Photo" RENAME TO "PhotoUnavailableForTest"');
  try {
    await staff("submit", version, { completionNote: "Xong", evidencePhotoIds: [randomUUID()] }, 503);
    assert.equal((await detail()).version, version);
  } finally {
    await db.query('ALTER TABLE "PhotoUnavailableForTest" RENAME TO "Photo"');
  }

  const other = await makeIssue("Phiếu ngoài phạm vi");
  const wrongOwner = await photo(id, { owner: "staffB" });
  const wrongIssue = await photo(other.issue.id);
  const wrongPurpose = await photo(id, { purpose: "REPORT" });
  const notStored = await photo(id, { saved: false });
  const valid = await photo(id);
  for (const invalid of [wrongOwner, wrongIssue, wrongPurpose, notStored]) {
    await staff("submit", version, { completionNote: "Xong", evidencePhotoIds: [valid, invalid] }, 400);
  }
  assert.equal((await detail()).version, version);
  let submission = await staff("submit", version, { completionNote: "Đã thay bóng", evidencePhotoIds: [valid] });
  version = submission.issue.version;
  assert.equal(submission.issue.status, "AWAITING_REVIEW");
  assert.equal((await detail()).history.find(event => event.id === submission.event.id).evidencePhotos[0].photoId, valid);
  await manager("return-work", version, { reason: " " }, 400);
  version = (await manager("return-work", version, { reason: "Kiểm tra thêm công tắc" })).issue.version;
  await staff("submit", version, { completionNote: "Xong", evidencePhotoIds: [valid] }, 400);
  const second = await photo(id);
  submission = await staff("submit", version, { completionNote: "Đã kiểm tra công tắc", evidencePhotoIds: [second] });
  version = submission.issue.version;
  await manager("close", version, {}, 400);
  await call("staffA", workflow + id + "/close", { expectedVersion: version, evidenceReviewed: true }, 403);
  changed = (await manager("close", version, { evidenceReviewed: true })).issue;
  assert.ok(changed.closedAt);
  assert.equal(changed.status, "CLOSED");
  await manager("close", version, { evidenceReviewed: true }, 409);
  changed = (await manager("reopen", changed.version, { reason: "Cần sửa thêm đầu nối" })).issue;
  assert.equal(changed.status, "TRIAGED");
  assert.equal(changed.closedAt, null);
  assert.equal(changed.assigneeId, null);
  await call("staffA", assigned + id, undefined, 404);

  const history = (await detail()).history;
  assert.deepEqual(history.flatMap(event => event.evidencePhotos.map(photo => photo.photoId)), [valid, second]);
  assert.ok(history.filter(event => event.eventType === "WORK_SUBMITTED").every(event => event.actorUserId === users.staffA.id));
  assert.equal(history.filter(event => event.eventType === "ISSUE_CLOSED").length, 1);

  const target = await makeIssue("Đích gộp");
  const source = await makeIssue("Nguồn gộp");
  await db.query('INSERT INTO "IssueMerge" (id,"sourceIssueId","targetIssueId","mergedByUserId",reason) VALUES ($1,$2,$3,$4,$5)',
    [randomUUID(), source.issue.id, target.issue.id, users.manager.id, "fixture"]);
  assert.equal((await queue("SUBMITTED")).some(item => item.issueId === source.issue.id), false);
  assert.equal((await call("manager", workflow + target.issue.id)).issue.reports[1].reportId, source.report.id);
  await call("manager", workflow + source.issue.id + "/triage", { expectedVersion: 1, ...triage }, 409);
  await db.query('UPDATE "IssueMerge" SET "reversedAt"=now() WHERE "sourceIssueId"=$1', [source.issue.id]);
  await db.query('UPDATE "Issue" SET "reviewRequired"=true WHERE id=$1', [source.issue.id]);
  await call("manager", workflow + source.issue.id + "/triage", { expectedVersion: 1, ...triage }, 409);

  for (let i = 0; i < 26; i++) await makeIssue("Phân trang " + i);
  const first = await call("manager", "manager/issues");
  assert.equal(first.items.length, 25);
  assert.ok(first.nextCursor);
  const next = await call("manager", "manager/issues?cursor=" + first.nextCursor);
  assert.ok(next.items.length > 0 && next.items.every(item => !first.items.some(old => old.issueId === item.issueId)));

  console.log("PASS CP2 workflow: Better Auth, scope, transitions, evidence metadata (production Photo migration), events, concurrent writes, merge guard and pagination.");
} catch (error) {
  console.error(error);
  console.error(logs);
  process.exitCode = 1;
} finally {
  if (web && web.exitCode === null) {
    const stopped = once(web, "exit");
    web.kill();
    await stopped;
  }
  if (db) await db.end();
  if (started) await database.stop();
}
