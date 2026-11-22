// Isolated end-to-end verification: real Next.js, Better Auth, Prisma and UI.
// PostgreSQL 17 runs the checked-in migrations in an isolated temporary cluster.
// Only the upstream AI is a fixture.
// No production DB, .env writes, real email delivery or authentication bypass.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile, readdir, mkdir, mkdtemp } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import EmbeddedPostgres from "embedded-postgres";
import { hashPassword } from "better-auth/crypto";
import { chromium, expect } from "@playwright/test";

const port = Number(process.env.REPORTER_TEST_PORT || 3120);
const dbPort = Number(process.env.REPORTER_TEST_DB_PORT || 55439);
const aiPort = Number(process.env.REPORTER_TEST_AI_PORT || 18339);
const baseURL = `http://127.0.0.1:${port}`;
const password = randomBytes(24).toString("base64url");
const dbPassword = randomBytes(24).toString("base64url");
const testRoot = resolve("data/private");
await mkdir(testRoot, { recursive: true });
const databaseDir = await mkdtemp(join(testRoot, "reporter-flow-"));
assert.ok(!relative(testRoot, databaseDir).startsWith(".."));
const postgres = new EmbeddedPostgres({ databaseDir, user: "postgres", password: dbPassword, port: dbPort,
  persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {}, onError: () => {} });
let db, web, browser, ai, started = false;
let webLogs = "";
let failed = false;
const env = { ...process.env, DATABASE_URL: `postgresql://postgres:${dbPassword}@127.0.0.1:${dbPort}/postgres?schema=public`,
  BETTER_AUTH_URL: baseURL, BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
  VASTFIX_DEMO_AUTH: "0", FASTAPI_BASE_URL: `http://127.0.0.1:${aiPort}`, DUPLICATE_TIMEOUT_MS: "5000",
  NEXT_TELEMETRY_DISABLED: "1" };
function child(args) { return spawn(process.execPath, args, { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); }
async function command(args) {
  const proc = child(args);
  let output = "";
  proc.stdout.on("data", chunk => output += chunk);
  proc.stderr.on("data", chunk => output += chunk);
  const [code] = await once(proc, "exit");
  if (code !== 0) throw new Error(`Test setup failed: ${output}`);
}
const ok = message => console.log(`PASS ${message}`);
try {
  await postgres.initialise();
  await postgres.start(); started = true;
  db = postgres.getPgClient();
  await db.connect();
  const migrations = (await readdir("database-starter/prisma/migrations", { withFileTypes: true })).filter(x => x.isDirectory()).map(x => x.name).sort();
  for (const folder of migrations) await db.query(await readFile(`database-starter/prisma/migrations/${folder}/migration.sql`, "utf8"));
  await command(["--import", "tsx", "database-starter/prisma/seed.ts"]);
  const hashed = await hashPassword(password);
  for (const role of ["REPORTER", "MANAGER", "STAFF"]) {
    const id = randomUUID();
    await db.query('INSERT INTO "User" (id,email,name,role,"emailVerified") VALUES ($1,$2,$3,$4,true)', [id, `${role.toLowerCase()}.flow@usth.edu.vn`, `Flow ${role}`, role]);
    await db.query('INSERT INTO "Account" (id,"userId","accountId","providerId",password) VALUES ($1,$2,$3,\'credential\',$4)', [randomUUID(), id, id, hashed]);
  }
  let upstreamCalls = 0;
  ai = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const input = JSON.parse(raw);
    assert.equal(req.url, "/duplicates");
    assert.ok(input.candidates.length > 0);
    assert.equal(input.query.description, "Đèn H2-03 ở hành lang giữa tầng 2 không sáng");
    assert.ok(input.query_time);
    upstreamCalls++;
    const candidate = input.candidates.find(c => c.description.includes("H2-03"));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ request_id: input.request_id, model_version: "test-fixture-v1", suggestions: [{ report_id: candidate.report_id, score: 0.87, reason_codes: ["SAME_AREA", "SIMILAR_DESCRIPTION"] }] }));
  });
  ai.listen(aiPort, "127.0.0.1"); await once(ai, "listening");
  web = child(["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)]);
  web.stdout.on("data", chunk => webLogs += chunk);
  web.stderr.on("data", chunk => webLogs += chunk);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (web.exitCode !== null) throw new Error(`Web exited: ${webLogs}`);
    try { if ((await fetch(`${baseURL}/vi/reports/new`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, "web server ready");
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
  const reporter = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1050 } });
  const page = await reporter.newPage();
  const consoleErrors = [];
  page.on("pageerror", error => consoleErrors.push(error.message));
  assert.equal((await reporter.request.get("/api/report-options")).status(), 401);
  ok("anonymous catalog request rejected");
  await page.goto("/login");
  await page.getByLabel("Email USTH", { exact: true }).fill("reporter.flow@usth.edu.vn");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tài khoản đang đăng nhập" })).toBeVisible();
  await expect(page.getByText("reporter.flow@usth.edu.vn", { exact: true })).toBeVisible();
  ok("real Better Auth sign-in through the existing login UI");
  assert.equal((await reporter.request.get("/api/manager/issues?status=SUBMITTED")).status(), 403);
  await page.goto("/vi/reports/new");
  await expect(page.locator("#description")).toBeEnabled();
  await page.locator("#description").fill("Đèn H2-03 ở hành lang giữa tầng 2 không sáng");
  await page.getByRole("combobox", { name: "Tòa nhà *", exact: true }).selectOption("11111111-1111-4111-8111-111111111111");
  await page.getByRole("combobox", { name: "Tầng *", exact: true }).selectOption("22222222-2222-4222-8222-222222222222");
  await page.getByRole("combobox", { name: "Khu vực *", exact: true }).selectOption("33333333-3333-4333-8333-333333333333");
  await page.getByLabel("Loại sự cố (không bắt buộc)").selectOption("ELECTRICAL");
  await page.locator("#location-detail").fill("đèn H2-03");
  const suggestionsResponse = page.waitForResponse(r => new URL(r.url()).pathname === "/api/duplicate-suggestions");
  await page.getByRole("button", { name: "Kiểm tra gợi ý" }).click();
  const suggestionsHttp = await suggestionsResponse;
  const suggestionsBody = await suggestionsHttp.json();
  assert.equal(suggestionsHttp.status(), 200, JSON.stringify(suggestionsBody));
  assert.equal(suggestionsBody.aiStatus, "ok", JSON.stringify(suggestionsBody));
  assert.equal(suggestionsBody.suggestions.length, 1, JSON.stringify(suggestionsBody));
  await expect(page.getByText("Bóng đèn H2-03 ở hành lang giữa tầng 2 bị tắt", { exact: true })).toBeVisible();
  assert.equal(upstreamCalls, 1);
  await mkdir("test-results/reporter-flow", { recursive: true });
  await page.screenshot({ path: "test-results/reporter-flow/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: "test-results/reporter-flow/mobile.png", fullPage: true });
  ok("DB catalogs and real Next.js candidate retrieval reach fixture AI and render suggestions");
  await new Promise(resolve => ai.close(resolve)); ai = undefined;
  await page.getByRole("button", { name: "Kiểm tra gợi ý" }).click();
  await expect(page.getByText("Gợi ý tạm không khả dụng. Bạn vẫn có thể gửi báo cáo mới.")).toBeVisible();
  const created = page.waitForResponse(r => r.url().endsWith("/api/reports") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Gửi báo cáo mới" }).click();
  const response = await created;
  assert.equal(response.status(), 201);
  const receipt = await response.json();
  await expect(page.getByRole("heading", { name: "Cảm ơn bạn đã lên tiếng." })).toBeVisible();
  const saved = await db.query('SELECT r.description, u.email, i.status, e."eventType" FROM "Report" r JOIN "User" u ON u.id=r."reporterId" JOIN "Issue" i ON i."originReportId"=r.id JOIN "IssueEvent" e ON e."issueId"=i.id WHERE r.id=$1', [receipt.report.id]);
  assert.equal(saved.rows.length, 1);
  assert.deepEqual(saved.rows[0], { description: "Đèn H2-03 ở hành lang giữa tầng 2 không sáng", email: "reporter.flow@usth.edu.vn", status: "SUBMITTED", eventType: "REPORT_SUBMITTED" });
  ok("AI unavailable still creates exactly one Report, Issue and event for the signed-in reporter");
  const manager = await browser.newContext({ baseURL });
  const signIn = await manager.request.post("/api/auth/sign-in/email", { data: { email: "manager.flow@usth.edu.vn", password }, headers: { Origin: baseURL } });
  assert.equal(signIn.status(), 200);
  const managerPage = await manager.newPage();
  await managerPage.goto("/vi/manager/issues");
  await expect(managerPage.getByRole("table").getByText("Đèn H2-03 ở hành lang giữa tầng 2 không sáng", { exact: true })).toBeVisible();
  ok("Sơn's manager UI shows the report just submitted through Dương's form");
  const staff = await browser.newContext({ baseURL });
  assert.equal((await staff.request.post("/api/auth/sign-in/email", { data: { email: "staff.flow@usth.edu.vn", password }, headers: { Origin: baseURL } })).status(), 200);
  assert.equal((await staff.request.get("/api/report-options")).status(), 200);
  assert.equal((await staff.request.get("/api/manager/issues?status=SUBMITTED")).status(), 403);
  ok("staff can access report catalogs but cannot access manager queue");
  assert.equal((await reporter.request.post("/api/auth/sign-out", { data: {}, headers: { Origin: baseURL } })).status(), 200);
  assert.equal((await reporter.request.get("/api/report-options")).status(), 401);
  assert.deepEqual(consoleErrors, []);
  ok("sign-out revokes access; reporter UI has no uncaught browser errors");
  console.log("Reporter integration passed. Database: isolated PostgreSQL 17; AI: test fixture, not ranking evaluation.");
} catch (error) {
  failed = true;
  console.error("Reporter integration failed:", error.message);
  console.error(webLogs.split("\n").filter(line => /API request failed|Duplicate ranking unavailable|Error/.test(line)).join("\n"));
} finally {
  await browser?.close();
  if (web && web.exitCode === null) {
    const stopped = once(web, "exit"); web.kill(); await stopped;
  }
  if (ai) await new Promise(resolve => ai.close(resolve));
  await db?.end();
  if (started) await postgres.stop();
}
process.exitCode = failed ? 1 : 0;
