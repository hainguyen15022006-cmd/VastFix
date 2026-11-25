import { expect, test, type Page } from "@playwright/test";

// Browser-only API fixtures. No mock endpoint, auth bypass or fixtures ship in src/.
const rows = [
  {
    issueId: "66666666-6666-4666-8666-666666666666",
    originReportId: "55555555-5555-4555-8555-555555555555",
    summary: "Đèn H2-03 ở hành lang giữa tầng 2 không sáng",
    locationLabel: "A1 · tầng 2 · hành lang giữa",
    status: "SUBMITTED",
    createdAt: "2026-11-19T02:30:00Z",
  },
  {
    issueId: "60000000-0000-4000-8000-000000000002",
    originReportId: "50000000-0000-4000-8000-000000000002",
    summary: "Water leaking near the laboratory entrance",
    locationLabel: "A2 · tầng 1 · phòng thí nghiệm",
    status: "SUBMITTED",
    createdAt: "2026-11-18T09:15:00Z",
  },
];
const body = (items = rows, nextCursor: string | null = null) => ({ items, nextCursor, requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
const endpoint = "**/api/manager/issues?*";
async function mockQueue(page: Page, data: unknown = body(), status = 200) {
  await page.route(endpoint, (route) => route.fulfill({ status, json: data }));
}

test("queue uses the contract and keeps descriptions unchanged across languages", async ({ page }, info) => {
  const requests: URL[] = [];
  await page.route(endpoint, (route) => {
    requests.push(new URL(route.request().url()));
    return route.fulfill({ json: body() });
  });
  await page.goto("/vi/manager/issues");
  await expect(page.getByRole("heading", { name: "Hàng đợi sự cố", exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByText(rows[0].summary, { exact: true })).toBeVisible();
  await expect(page.getByText("Hiển thị 2 / 2 phiếu đã tải")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await page.screenshot({ path: info.outputPath("queue-desktop-vi.png"), fullPage: true });
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/manager\/issues$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Issue queue", exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByText(rows[0].summary, { exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByText(rows[1].summary, { exact: true })).toBeVisible();
  expect(requests.length).toBeGreaterThan(0);
  for (const url of requests) {
    expect(url.searchParams.get("status")).toBe("SUBMITTED");
    expect(["vi", "en"]).toContain(url.searchParams.get("locale"));
  }
  expect(requests.some(url => url.searchParams.get("locale") === "en")).toBe(true);
});

test("local search handles Vietnamese without accents and is limited to loaded rows", async ({ page }) => {
  await mockQueue(page, body(rows, "opaque-next-page"));
  await page.goto("/vi/manager/issues");
  await expect(page.getByText("Hiển thị 2 / 2 phiếu đã tải")).toBeVisible();
  await page.getByLabel("Tìm trong danh sách đã tải").fill("den h2-03");
  await expect(page.getByText("Hiển thị 1 / 2 phiếu đã tải")).toBeVisible();
  await expect(page.getByText(rows[1].summary, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("note")).toContainText("một phần danh sách");
  await page.getByLabel("Tìm trong danh sách đã tải").fill("not-in-loaded-results");
  await expect(page.getByRole("heading", { name: "Không tìm thấy phiếu phù hợp" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa tìm kiếm" }).click();
  await expect(page.getByText("Hiển thị 2 / 2 phiếu đã tải")).toBeVisible();
});

test("empty success is distinct from request failure", async ({ page }) => {
  await mockQueue(page, body([]));
  await page.goto("/vi/manager/issues");
  await expect(page.getByRole("heading", { name: "Chưa có phiếu ở trạng thái này" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toHaveCount(0);
});

for (const [status, title] of [[401, "Cần đăng nhập"], [403, "Bạn chưa có quyền xem hàng đợi"], [500, "Chưa thể tải hàng đợi"]] as const) {
  test(`${status} has a distinct safe state and does not render response data`, async ({ page }) => {
    await mockQueue(page, { ...body(), error: { code: "TEST_ERROR", message: "private server diagnostic" } }, status);
    await page.goto("/vi/manager/issues");
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByText(rows[0].summary, { exact: true })).toHaveCount(0);
    await expect(page.getByText("private server diagnostic")).toHaveCount(0);
    await expect(page.getByText("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).toBeVisible();
  });
}

test("network failure can be retried successfully", async ({ page }) => {
  let failed = true;
  await page.route(endpoint, (route) => failed ? route.abort() : route.fulfill({ json: body() }));
  await page.goto("/en/manager/issues");
  await expect(page.getByRole("heading", { name: "Unable to load the queue" })).toBeVisible();
  failed = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Showing 2 of 2 loaded issues")).toBeVisible();
});

test("malformed successful response is not presented as an empty queue", async ({ page }) => {
  await mockQueue(page, { ...body(), items: [{ ...rows[0], createdAt: "invalid-date" }] });
  await page.goto("/vi/manager/issues");
  await expect(page.getByRole("heading", { name: "Chưa thể tải hàng đợi" })).toBeVisible();
  await expect(page.getByText("Chưa có phiếu ở trạng thái này")).toHaveCount(0);
});

test("all six workflow statuses are offered and locale changes ignore late responses", async ({ page }) => {
  let releaseOld: () => void = () => {};
  const old = new Promise<void>(resolve => { releaseOld = resolve; });
  await page.route(endpoint, async route => {
    if (new URL(route.request().url()).searchParams.get("locale") === "vi") {
      await old;
      await route.fulfill({ json: body([rows[0]]) }).catch(() => {});
    } else await route.fulfill({ json: body([rows[1]]) });
  });
  await page.goto("/vi/manager/issues");
  const status = page.getByRole("combobox", { name: "Trạng thái", exact: true });
  await expect(status).toBeEnabled();
  await expect(status.locator("option")).toHaveCount(6);
  await expect(status).toHaveValue("SUBMITTED");
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page.getByRole("table").getByText(rows[1].summary, { exact: true })).toBeVisible();
  releaseOld();
  await expect(page.getByRole("table").getByText(rows[0].summary, { exact: true })).toHaveCount(0);
});

test("mobile queue and accessible detail dialog fit the screen", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockQueue(page);
  await page.goto("/vi/manager/issues");
  const opener = page.getByRole("button", { name: `Xem thông tin: ${rows[0].summary}`, exact: true });
  await expect(opener).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("queue-mobile-vi.png"), fullPage: true });
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText(rows[0].originReportId, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(opener).toBeFocused();
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Issue queue", exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("reporter content is rendered as text, never as HTML", async ({ page }) => {
  const summary = '<img src=x onerror="window.reportExecuted=true">';
  await mockQueue(page, body([{ ...rows[0], summary }]));
  await page.goto("/vi/manager/issues");
  await expect(page.getByRole("table").getByText(summary, { exact: true })).toBeVisible();
  await expect(page.getByRole("table").locator("img")).toHaveCount(0);
});

test("production keeps development DB page private and health route unlocalized", async ({ page, request }) => {
  const response = await request.get("/dev/database");
  expect(response.status()).toBe(404);
  const health = await request.get("/api/health");
  expect([200, 503]).toContain(health.status());
  expect(health.url()).toBe("http://127.0.0.1:3100/api/health");
  await page.goto("/vi");
  await expect(page.getByRole("link", { name: "Mở hàng đợi quản lý" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mở trang kiểm tra DB" })).toHaveCount(0);
});

test("integrated real backend requires a session without demo fallback", async ({ page }) => {
  await page.goto("/vi/manager/issues");
  await expect(page.getByRole("heading", { name: "Cần đăng nhập", exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("pagination sends the cursor, deduplicates rows and can retry a failed page", async ({ page }) => {
  let pageCalls = 0;
  await page.route(endpoint, route => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get("locale")).toBe("vi");
    if (!query.has("cursor")) return route.fulfill({ json: body([rows[0]], "next-page") });
    expect(query.get("cursor")).toBe("next-page");
    pageCalls++;
    return pageCalls === 1 ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: body([rows[0], rows[1]]) });
  });
  await page.goto("/vi/manager/issues");
  await page.getByRole("button", { name: "Tải thêm phiếu" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Chưa tải được trang tiếp theo");
  await expect(page.getByRole("table").getByText(rows[0].summary, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tải thêm phiếu" }).click();
  await expect(page.getByText("Hiển thị 2 / 2 phiếu đã tải")).toBeVisible();
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Tải thêm phiếu" })).toHaveCount(0);
});

test("losing manager permission during pagination clears previously loaded rows", async ({ page }) => {
  await page.route(endpoint, route => new URL(route.request().url()).searchParams.has("cursor")
    ? route.fulfill({ status: 403, json: { requestId: "permission-revoked" } })
    : route.fulfill({ json: body([rows[0]], "next-page") }));
  await page.goto("/vi/manager/issues");
  await page.getByRole("button", { name: "Tải thêm phiếu" }).click();
  await expect(page.getByRole("heading", { name: "Bạn chưa có quyền xem hàng đợi" })).toBeVisible();
  await expect(page.getByText(rows[0].summary, { exact: true })).toHaveCount(0);
});

test("refresh aborts a pending page and never appends its stale response", async ({ page }) => {
  let release: () => void = () => {};
  let firstPageCalls = 0;
  const oldPage = new Promise<void>(resolve => { release = resolve; });
  await page.route(endpoint, async route => {
    if (new URL(route.request().url()).searchParams.has("cursor")) {
      await oldPage;
      await route.fulfill({ json: body([rows[0]]) }).catch(() => {});
    } else {
      firstPageCalls++;
      await route.fulfill({ json: firstPageCalls === 1 ? body([rows[0]], "next-page") : body([rows[1]]) });
    }
  });
  await page.goto("/vi/manager/issues");
  await page.getByRole("button", { name: "Tải thêm phiếu" }).click();
  await expect(page.getByRole("button", { name: "Đang tải thêm…" })).toBeDisabled();
  await page.getByRole("button", { name: "Làm mới", exact: true }).click();
  await expect(page.getByRole("table").getByText(rows[1].summary, { exact: true })).toBeVisible();
  release();
  await expect(page.getByRole("table").getByText(rows[0].summary, { exact: true })).toHaveCount(0);
});
