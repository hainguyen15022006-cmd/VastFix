import { expect, test, type Page } from "@playwright/test";

const requestId = "44444444-4444-4444-8444-444444444444";
const buildingId = "11111111-1111-4111-8111-111111111111";
const floorId = "22222222-2222-4222-8222-222222222222";
const areaId = "33333333-3333-4333-8333-333333333333";
const catalog = { requestId, buildings: [
  { id: buildingId, code: "A1", nameVi: "Tòa A1", nameEn: "Building A1", floors: [
    { id: floorId, nameVi: "Tầng 2", nameEn: "Floor 2", areas: [{ id: areaId, nameVi: "Hành lang giữa", nameEn: "Middle corridor" }] },
  ] },
  { id: "11111111-1111-4111-8111-111111111112", code: "A2", nameVi: "Tòa A2", nameEn: "Building A2", floors: [] },
], categories: [{ code: "ELECTRICAL", nameVi: "Điện", nameEn: "Electrical" }] };
const receipt = { requestId, report: { id: "77777777-7777-4777-8777-777777777777", submittedAt: "2026-11-21T03:00:00Z" }, issue: { id: "88888888-8888-4888-8888-888888888888", status: "SUBMITTED" } };
const suggestion = { reportId: receipt.report.id, issueId: receipt.issue.id, score: 0.87, reasonCodes: ["SAME_AREA", "SIMILAR_DESCRIPTION"], summary: "Đèn H2-03 không sáng", locationLabel: "A1 · tầng 2", createdAt: "2026-11-21T02:00:00Z" };
async function start(page: Page, locale = "vi") {
  await page.route("**/api/report-options", route => route.fulfill({ json: catalog }));
  await page.goto(`/${locale}/reports/new`);
  await expect(page.locator("#description")).toBeEnabled();
}
async function indoor(page: Page, description = "  Đèn H2-03 bị tắt\nTừ sáng nay  ") {
  await page.locator("#description").fill(description);
  await page.getByRole("combobox", { name: "Tòa nhà *", exact: true }).selectOption(buildingId);
  await page.getByRole("combobox", { name: "Tầng *", exact: true }).selectOption(floorId);
  await page.getByRole("combobox", { name: "Khu vực *", exact: true }).selectOption(areaId);
}

test("submits exact v1 data once without requesting suggestions and shows receipt", async ({ page }) => {
  let posts = 0, hints = 0;
  await page.route("**/api/duplicate-suggestions?*", r => { hints++; return r.fulfill({ json: {} }); });
  await page.route("**/api/reports", async r => {
    posts++;
    expect(r.request().postDataJSON()).toEqual({ description: "  Đèn H2-03 bị tắt\nTừ sáng nay  ", location: { kind: "INDOOR", buildingId, floorId, areaId, detail: "" } });
    await new Promise(resolve => setTimeout(resolve, 200));
    await r.fulfill({ status: 201, json: receipt });
  });
  await start(page); await indoor(page);
  await page.getByRole("button", { name: "Gửi báo cáo mới" }).dblclick();
  await expect(page.getByRole("heading", { name: "Cảm ơn bạn đã lên tiếng." })).toBeFocused();
  await expect(page.getByText(receipt.issue.id)).toBeVisible();
  expect(posts).toBe(1); expect(hints).toBe(0);
  await page.getByRole("button", { name: "Báo một sự cố khác" }).click();
  await expect(page.locator("#description")).toHaveValue("");
});

test("outdoor payload has no indoor IDs and requires a coordinate pair", async ({ page }) => {
  let payload: unknown;
  await page.route("**/api/reports", r => { payload = r.request().postDataJSON(); return r.fulfill({ status: 201, json: receipt }); });
  await start(page); await indoor(page);
  await page.getByRole("radio", { name: "Ngoài trời" }).check();
  await page.locator("#location-detail").fill("  Cạnh cổng 18-2  ");
  await page.getByText("Thêm tọa độ (không bắt buộc)", { exact: true }).click();
  await page.getByLabel("Vĩ độ", { exact: true }).fill("21.04");
  await page.getByRole("button", { name: "Gửi báo cáo mới" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("đủ cả vĩ độ và kinh độ");
  expect(payload).toBeUndefined();
  await page.getByLabel("Kinh độ", { exact: true }).fill("105.8");
  await page.getByRole("button", { name: "Gửi báo cáo mới" }).click();
  await expect(page.getByText(receipt.report.id)).toBeVisible();
  expect(payload).toEqual({ description: "  Đèn H2-03 bị tắt\nTừ sáng nay  ", location: { kind: "OUTDOOR", detail: "  Cạnh cổng 18-2  ", latitude: 21.04, longitude: 105.8 } });
});

test("changing building clears dependent fields and whitespace does not submit", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/reports", r => { posts++; return r.fulfill({ status: 201, json: receipt }); });
  await start(page); await indoor(page);
  await page.getByRole("combobox", { name: "Tòa nhà *", exact: true }).selectOption(catalog.buildings[1].id);
  await expect(page.getByRole("combobox", { name: "Tầng *", exact: true })).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Khu vực *", exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Gửi báo cáo mới" }).click();
  expect(posts).toBe(0);
  await indoor(page, "    ");
  await page.getByRole("button", { name: "Gửi báo cáo mới" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("không chỉ khoảng trắng");
  expect(posts).toBe(0);
});

test("suggestions render safe text and localized reasons without probabilities", async ({ page }, info) => {
  const summary = '<img src=x onerror="alert(1)"> Đèn H2-03';
  await page.route("**/api/duplicate-suggestions?*", r => r.fulfill({ json: { requestId, aiStatus: "ok", suggestions: [{ ...suggestion, summary }] } }));
  await start(page); await indoor(page);
  await page.getByRole("button", { name: "Kiểm tra gợi ý" }).click();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await expect(page.getByText("Cùng khu vực", { exact: true })).toBeVisible();
  await expect(page.locator(".vf-suggestion-list img")).toHaveCount(0);
  await expect(page.getByText("87%")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("report-desktop.png"), fullPage: true });
  await page.locator("#description").fill("Một sự cố khác");
  await expect(page.getByText(summary, { exact: true })).toHaveCount(0);
});

for (const aiStatus of ["ok", "unavailable"] as const) {
  test(`${aiStatus} with empty suggestions has a distinct message and permits submission`, async ({ page }) => {
    await page.route("**/api/duplicate-suggestions?*", r => r.fulfill({ json: { requestId, aiStatus, suggestions: [] } }));
    await page.route("**/api/reports", r => r.fulfill({ status: 201, json: receipt }));
    await start(page); await indoor(page);
    await page.getByRole("button", { name: "Kiểm tra gợi ý" }).click();
    await expect(page.getByText(aiStatus === "ok" ? "Chưa tìm thấy gợi ý phù hợp. Bạn có thể gửi báo cáo mới." : "Gợi ý tạm không khả dụng. Bạn vẫn có thể gửi báo cáo mới.")).toBeVisible();
    await page.getByRole("button", { name: "Gửi báo cáo mới" }).click();
    await expect(page.getByText(receipt.report.id)).toBeVisible();
  });
}

test("late suggestions cannot overwrite an edited draft and AI cannot block submit", async ({ page }) => {
  let release: () => void = () => {};
  await page.route("**/api/duplicate-suggestions?*", async r => {
    await new Promise<void>(resolve => { release = resolve; });
    await r.fulfill({ json: { requestId, aiStatus: "ok", suggestions: [suggestion] } }).catch(() => {});
  });
  await page.route("**/api/reports", r => r.fulfill({ status: 201, json: receipt }));
  await start(page); await indoor(page);
  await page.getByRole("button", { name: "Kiểm tra gợi ý" }).click();
  await expect(page.getByRole("button", { name: "Đang tìm gợi ý…" })).toBeVisible();
  await page.locator("#location-detail").fill("Đèn H2-04"); release();
  await expect(page.getByText(suggestion.summary, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Kiểm tra gợi ý" }).click();
  await page.getByRole("button", { name: "Gửi báo cáo mới" }).click(); release();
  await expect(page.getByText(receipt.report.id)).toBeVisible();
});

test("unknown reason codes and malformed AI results never appear as valid suggestions", async ({ page }) => {
  await page.route("**/api/duplicate-suggestions?*", r => r.fulfill({ json: { requestId, aiStatus: "ok", suggestions: [{ ...suggestion, reasonCodes: ["MADE_UP"] }] } }));
  await start(page); await indoor(page);
  await page.getByRole("button", { name: "Kiểm tra gợi ý" }).click();
  await expect(page.getByText("Gợi ý tạm không khả dụng. Bạn vẫn có thể gửi báo cáo mới.")).toBeVisible();
  await expect(page.getByText(suggestion.summary, { exact: true })).toHaveCount(0);
});

test("expired session preserves the draft and offers sign-in in another tab", async ({ page }) => {
  await page.route("**/api/reports", r => r.fulfill({ status: 401, json: { requestId, error: { code: "UNAUTHENTICATED", message: "internal" } } }));
  await start(page); await indoor(page);
  await page.getByRole("button", { name: "Gửi báo cáo mới" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("phiên đã hết hạn");
  await expect(page.locator("#description")).toHaveValue("  Đèn H2-03 bị tắt\nTừ sáng nay  ");
  await expect(page.getByRole("link", { name: "Mở đăng nhập trong tab mới" })).toHaveAttribute("target", "_blank");
  await expect(page.getByText("internal", { exact: true })).toHaveCount(0);
});

test("uncertain submission is not retried automatically or reported as success", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/reports", r => { calls++; return r.abort(); });
  await start(page); await indoor(page);
  await page.getByRole("button", { name: "Gửi báo cáo mới" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Báo cáo có thể đã được lưu");
  expect(calls).toBe(1);
  await expect(page.getByText("Cảm ơn bạn đã lên tiếng.")).toHaveCount(0);
});

test("catalog failure retries and empty catalog still permits outdoor reporting", async ({ page }) => {
  let fail = true;
  await page.route("**/api/report-options", r => fail ? r.fulfill({ status: 503, json: {} }) : r.fulfill({ json: { ...catalog, buildings: [], categories: [] } }));
  await page.goto("/vi/reports/new");
  await expect(page.locator("main").getByRole("alert")).toContainText("Chưa tải được dữ liệu");
  await expect(page.getByRole("button", { name: "Gửi báo cáo mới" })).toBeDisabled();
  fail = false;
  await page.getByRole("button", { name: "Tải lại danh mục" }).click();
  await expect(page.getByText(/Chưa có danh mục vị trí trong nhà/)).toBeVisible();
  await page.getByRole("radio", { name: "Ngoài trời" }).check();
  await expect(page.locator("#location-detail")).toBeEnabled();
});

test("English mobile form is usable and long results fit viewport", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, "en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await expect(page.getByRole("link", { name: "Skip to content" })).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.locator("#description").fill("Đèn bị tắt");
  await page.getByRole("radio", { name: "Outdoors" }).check();
  await page.locator("#location-detail").fill("Near the gate");
  await page.route("**/api/duplicate-suggestions?*", r => r.fulfill({ json: { requestId, aiStatus: "ok", suggestions: [{ ...suggestion, summary: "X".repeat(150) }] } }));
  await page.getByRole("button", { name: "Check suggestions" }).click();
  await expect(page.getByText("Same area", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("report-mobile-en.png"), fullPage: true });
});

test("auth routes retain original URLs after locale integration", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
  await page.goto("/register");
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: "Tạo tài khoản VastFix" })).toBeVisible();
});
