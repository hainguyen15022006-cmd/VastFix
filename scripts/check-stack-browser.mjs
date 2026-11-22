// Runs against an already-started local Compose stack. Creates clearly marked test data.
// Reporter uses real signup/email verification/login; manager uses the explicit local demo session.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import pg from "pg";

if (!process.argv.includes("--write")) throw new Error("This check creates test reports. Run with --write on a local test stack.");
const WEB = (process.env.WEB_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const MAIL = (process.env.MAIL_URL || "http://127.0.0.1:8025").replace(/\/$/, "");
const databaseUrl = process.env.STACK_DATABASE_URL || `postgresql://vastfix_dev:vastfix_dev_only@127.0.0.1:${process.env.VASTFIX_DB_PORT || 5434}/vastfix_dev`;
for (const url of [WEB, MAIL, databaseUrl]) {
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Local stack only");
}
assert.ok(process.env.VASTFIX_DEMO_MANAGER_PASSWORD, "Run npm run demo:env first");
const marker = randomUUID();
const email = `browser-check-${marker}@usth.edu.vn`;
const password = randomBytes(28).toString("base64url");
const output = "test-results/stack-browser";
const results = { reporterAuth: "real", managerAuth: "explicit local demo" };
const db = new pg.Client({ connectionString: databaseUrl });
let browser;
try {
  await db.connect();
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
  const reporter = await browser.newContext({ baseURL: WEB, viewport: { width: 1440, height: 1000 } });
  const page = await reporter.newPage();
  page.setDefaultTimeout(30_000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/register");
  await page.getByLabel("Họ tên", { exact: true }).fill("Browser integration fixture");
  await page.getByLabel("Email USTH", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng ký và nhận thư xác minh", exact: true }).click();
  await expect(page.getByText("Nếu đăng ký hợp lệ, thư xác minh đã được gửi.", { exact: false })).toBeVisible({ timeout: 30_000 });
  let message;
  for (let i = 0; i < 20 && !message; i++) {
    const inbox = await (await fetch(MAIL + "/api/v1/messages")).json();
    message = inbox.messages?.find(item => item.To?.some(to => to.Address === email));
    if (!message) await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert.ok(message, "Verification email received by local Mailpit");
  const mailBody = await (await fetch(MAIL + "/api/v1/message/" + message.ID)).json();
  const link = mailBody.Text.match(/https?:\/\/\S+/)?.[0];
  assert.ok(link && new URL(link).origin === WEB, "Verification link has the correct stack origin");
  assert.ok((await reporter.request.get(link, { maxRedirects: 0 })).status() < 400);
  await page.goto("/login");
  await page.getByLabel("Email USTH", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tài khoản đang đăng nhập" })).toBeVisible({ timeout: 30_000 });
  assert.equal(new URL(page.url()).searchParams.has("password"), false);
  results.signupVerificationAndLogin = "PASS";

  const description = `  Đèn H2-03 ở hành lang giữa tầng 2 không sáng\nMã kiểm tra browser-${marker}  `;
  await page.goto("/vi/reports/new");
  await expect(page.locator("#description")).toBeEnabled({ timeout: 30_000 });
  await page.locator("#description").fill(description);
  for (const [name, id] of [["Tòa nhà *", "11111111-1111-4111-8111-111111111111"], ["Tầng *", "22222222-2222-4222-8222-222222222222"], ["Khu vực *", "33333333-3333-4333-8333-333333333333"]]) {
    await page.getByRole("combobox", { name, exact: true }).selectOption(id);
  }
  await page.getByLabel("Loại sự cố (không bắt buộc)").selectOption("ELECTRICAL");
  await page.locator("#location-detail").fill("đèn H2-03");
  const suggested = page.waitForResponse(response => new URL(response.url()).pathname === "/api/duplicate-suggestions");
  await page.getByRole("button", { name: "Kiểm tra gợi ý", exact: true }).click();
  const suggestionResponse = await suggested, suggestions = await suggestionResponse.json();
  assert.equal(suggestionResponse.status(), 200);
  assert.equal(suggestions.aiStatus, "ok");
  assert.ok(suggestions.suggestions.length > 0 && suggestions.suggestions.length <= 5);
  // Repeated checks leave newer H2-03 reports. Any real open H2-03 candidate can
  // outrank the older seed; the fixed two-candidate AI test checks exact IDs.
  assert.ok(suggestions.suggestions.some(item => item.summary.includes("H2-03")));
  const known = await db.query('SELECT id,description FROM "Report" WHERE id=ANY($1::uuid[])', [suggestions.suggestions.map(item => item.reportId)]);
  assert.equal(known.rows.length, suggestions.suggestions.length);
  for (const item of suggestions.suggestions) assert.equal(known.rows.find(row => row.id === item.reportId).description, item.summary);
  await expect(page.locator(".vf-suggestion-list")).toBeVisible();
  await page.screenshot({ path: `${output}/reporter-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await page.locator(".vf-app").count(), 1);
  await page.screenshot({ path: `${output}/reporter-mobile-top.png` });
  await page.getByRole("button", { name: "Gửi báo cáo mới", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/reporter-mobile-submit.png` });
  const created = page.waitForResponse(response => new URL(response.url()).pathname === "/api/reports" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Gửi báo cáo mới", exact: true }).click();
  const receiptResponse = await created, receipt = await receiptResponse.json();
  assert.equal(receiptResponse.status(), 201);
  await expect(page.getByRole("heading", { name: "Cảm ơn bạn đã lên tiếng." })).toBeVisible();
  const saved = await db.query('SELECT r.description,u.email,i.status,e."eventType" FROM "Report" r JOIN "User" u ON u.id=r."reporterId" JOIN "Issue" i ON i."originReportId"=r.id JOIN "IssueEvent" e ON e."issueId"=i.id WHERE r.id=$1', [receipt.report.id]);
  assert.deepEqual(saved.rows, [{ description, email, status: "SUBMITTED", eventType: "REPORT_SUBMITTED" }]);
  results.realAiAndOriginalReportPersistence = "PASS";

  const manager = await browser.newContext({ baseURL: WEB, viewport: { width: 1440, height: 1000 } });
  assert.equal((await manager.request.post("/api/dev/session", { data: { email: "manager@demo.invalid", password: process.env.VASTFIX_DEMO_MANAGER_PASSWORD } })).status(), 200);
  const managerPage = await manager.newPage();
  managerPage.setDefaultTimeout(30_000);
  await managerPage.goto("/vi/manager/issues");
  let row = managerPage.getByRole("row").filter({ hasText: receipt.issue.id.slice(0, 8) });
  await expect(row).toBeVisible({ timeout: 30_000 });
  assert.equal(await row.locator(".vf-issue-summary").textContent(), description);
  await managerPage.reload();
  await expect(row).toBeVisible();
  const status = managerPage.getByRole("combobox", { name: "Trạng thái", exact: true });
  await expect(status).toBeDisabled();
  await expect(status.locator("option")).toHaveCount(1);
  await managerPage.getByRole("link", { name: "English", exact: true }).click();
  await expect(managerPage.getByRole("heading", { name: "Issue queue", exact: true })).toBeVisible();
  row = managerPage.getByRole("row").filter({ hasText: receipt.issue.id.slice(0, 8) });
  await expect(row.locator(".vf-location")).toContainText("Middle corridor");
  assert.equal(await row.locator(".vf-issue-summary").textContent(), description);
  await managerPage.screenshot({ path: `${output}/manager-english.png`, fullPage: true });
  results.managerReloadAndLocalizedLocation = "PASS";

  for (let i = 0; i < 26; i++) {
    assert.equal((await reporter.request.post("/api/reports", { data: { description: `Pagination fixture ${marker} ${i}`, location: { kind: "OUTDOOR", detail: "Synthetic browser-test location" } } })).status(), 201);
  }
  await managerPage.reload();
  await expect(managerPage.getByRole("button", { name: "Load more issues", exact: true })).toBeVisible();
  await managerPage.getByRole("searchbox").fill(`Mã kiểm tra browser-${marker}`);
  await expect(row).toHaveCount(0);
  for (let attempt = 0; attempt < 10 && await row.count() === 0; attempt++) {
    await managerPage.getByRole("button", { name: "Load more issues", exact: true }).click();
    await expect(managerPage.getByRole("button", { name: "Loading more…", exact: true })).toHaveCount(0);
  }
  await expect(row).toHaveCount(1);
  assert.equal(await row.locator(".vf-issue-summary").textContent(), description);
  results.paginationBeyond25Issues = "PASS";
  assert.equal((await reporter.request.get("/api/manager/issues?status=SUBMITTED")).status(), 403);
  assert.deepEqual(errors, []);
  await page.goto("/account");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
  assert.equal((await reporter.request.get("/api/report-options")).status(), 401);
  results.permissionsAndLogout = "PASS";
  console.log("PASS: Docker browser signup, verification, login, real AI, exact Report/Issue/event, manager reload, vi/en locations, pagination beyond 25, permissions and logout.");
} catch (error) {
  results.failure = error.message.split("\n").slice(0, 7).join("\n");
  console.error("Browser stack check failed:", results.failure);
  process.exitCode = 1;
} finally {
  await browser?.close(); await db.end();
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2) + "\n");
}
