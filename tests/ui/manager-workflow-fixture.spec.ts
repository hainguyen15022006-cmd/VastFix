import { expect, test } from "@playwright/test";

const id = "66666666-6666-4666-8666-666666666666";
const reportId = "55555555-5555-4555-8555-555555555555";
const statuses = ["SUBMITTED", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "AWAITING_REVIEW", "CLOSED"] as const;
const issue = (status: typeof statuses[number]) => ({
  id, originReportId: reportId, status, categoryCode: "ELECTRICAL", priority: "P1",
  dueAt: "2026-11-28T07:00:00.000Z", createdAt: "2026-11-23T07:00:00.000Z", closedAt: status === "CLOSED" ? "2026-11-25T07:00:00.000Z" : null,
  assigneeId: null, assignee: null, version: 3, reviewRequired: false, mergedIntoIssueId: null,
  reports: [{ reportId, issueId: id, description: "Đèn H2-03 không sáng", locationLabel: "A1 · tầng 2 · hành lang giữa", submittedAt: "2026-11-23T07:00:00.000Z", photos: [] }],
  history: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", eventType: "ISSUE_TRIAGED", actorUserId: null, occurredAt: "2026-11-23T08:00:00.000Z", details: { priority: "P1" }, evidencePhotos: [] }],
});

for (const status of statuses) {
  test(`detail fixture ${status} shows sections`, async ({ page }) => {
    await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ json: { issue: issue(status), requestId: id } }));
    await page.route("**/api/manager/staff", route => route.fulfill({ json: { items: [{ id, name: "Demo staff" }], requestId: id } }));
    await page.goto(`/vi/manager/issues/${id}`);
    await expect(page.getByRole("heading", { name: "Chi tiết phiếu" })).toBeVisible();
    await expect(page.getByText("Đèn H2-03 không sáng")).toBeVisible();
    await page.getByRole("button", { name: "Xử lý" }).click();
    if (status === "SUBMITTED") await expect(page.getByRole("button", { name: "Tiếp nhận" })).toBeVisible();
    if (status === "TRIAGED") await expect(page.getByRole("button", { name: "Phân công" })).toBeVisible();
    await page.getByRole("button", { name: "Lịch sử" }).click();
    await expect(page.getByText("ISSUE_TRIAGED")).toBeVisible();
  });
}

test("manager triages with version and reloads fresh detail", async ({ page }) => {
  let current = issue("SUBMITTED");
  let sent: Record<string, unknown> | null = null;
  await page.route(`**/api/manager/issues/${id}/triage`, async route => {
    sent = route.request().postDataJSON();
    current = { ...issue("TRIAGED"), version: 4 };
    await route.fulfill({ json: { issue: current, event: { id, eventType: "ISSUE_TRIAGED" }, requestId: id } });
  });
  await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ json: { issue: current, requestId: id } }));
  await page.route("**/api/report-options", route => route.fulfill({ json: { categories: [{ code: "ELECTRICAL", nameVi: "Điện", nameEn: "Electrical" }] } }));
  await page.goto(`/vi/manager/issues/${id}`);
  await page.getByRole("button", { name: "Xử lý" }).click();
  await page.getByLabel("Loại sự cố").selectOption("ELECTRICAL");
  await page.getByLabel("Hạn xử lý").fill("2026-11-28T14:00");
  await page.getByRole("button", { name: "Tiếp nhận" }).click();
  await expect(page.getByText("Đã tiếp nhận", { exact: true })).toBeVisible();
  expect(sent).toEqual({ expectedVersion: 3, categoryCode: "ELECTRICAL", priority: "P1", dueAt: "2026-11-28T07:00:00.000Z" });
});

test("manager close requires evidence review", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  const review = { ...issue("AWAITING_REVIEW"), history: [{ id, eventType: "WORK_SUBMITTED", actorUserId: null, occurredAt: "2026-11-25T08:00:00.000Z", details: { completionNote: "Đã thay đèn" }, evidencePhotos: [{ photoId: reportId, url: `/api/photos/${reportId}` }] }] };
  await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ json: { issue: review, requestId: id } }));
  await page.route(`**/api/manager/issues/${id}/close`, route => { sent = route.request().postDataJSON(); return route.fulfill({ json: { issue: review, event: { id }, requestId: id } }); });
  await page.route(`**/api/photos/${reportId}`, route => route.fulfill({ status: 404 }));
  await page.goto(`/vi/manager/issues/${id}`);
  await page.getByRole("button", { name: "Xử lý" }).click();
  await expect(page.getByText("Đã thay đèn")).toBeVisible();
  await expect(page.getByRole("button", { name: "Duyệt và đóng" })).toBeDisabled();
  await page.getByLabel("Tôi đã xem ảnh minh chứng").check();
  await page.getByRole("button", { name: "Duyệt và đóng" }).click();
  expect(sent).toEqual({ expectedVersion: 3, evidenceReviewed: true });
});

test("manager assigns verified staff and sends current version", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ json: { issue: issue("TRIAGED"), requestId: id } }));
  await page.route("**/api/manager/staff", route => route.fulfill({ json: { items: [{ id: reportId, name: "Demo staff" }], requestId: id } }));
  await page.route(`**/api/manager/issues/${id}/assign`, route => { sent = route.request().postDataJSON(); return route.fulfill({ json: { issue: issue("ASSIGNED"), event: { id }, requestId: id } }); });
  await page.goto(`/vi/manager/issues/${id}`);
  await page.getByRole("button", { name: "Xử lý" }).click();
  await page.getByLabel("Nhân viên được giao").selectOption(reportId);
  await page.getByRole("button", { name: "Phân công" }).click();
  expect(sent).toEqual({ expectedVersion: 3, assigneeId: reportId });
});

test("conflict reloads issue and shows stale version warning", async ({ page }) => {
  let current = issue("TRIAGED");
  await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ json: { issue: current, requestId: id } }));
  await page.route("**/api/manager/staff", route => route.fulfill({ json: { items: [{ id: reportId, name: "Demo staff" }], requestId: id } }));
  await page.route(`**/api/manager/issues/${id}/assign`, route => { current = { ...issue("ASSIGNED"), version: 4 }; return route.fulfill({ status: 409, json: { error: { code: "WORKFLOW_CONFLICT", message: "internal" }, requestId: id } }); });
  await page.goto(`/vi/manager/issues/${id}`);
  await page.getByRole("button", { name: "Xử lý" }).click();
  await page.getByLabel("Nhân viên được giao").selectOption(reportId);
  await page.getByRole("button", { name: "Phân công" }).click();
  await expect(page.locator(".vf-workflow-alert[role=alert]")).toContainText("Phiếu đã thay đổi");
  await expect(page.getByText("Phiên bản 4")).toBeVisible();
  await expect(page.getByText("internal")).toHaveCount(0);
});

for (const [status, action, label] of [["AWAITING_REVIEW", "return-work", "Trả lại việc"], ["CLOSED", "reopen", "Mở lại"], ["IN_PROGRESS", "return-to-triage", "Đưa về tiếp nhận"]] as const) {
  test(`${action} sends reason and version`, async ({ page }) => {
    let sent: Record<string, unknown> | null = null;
    await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ json: { issue: issue(status), requestId: id } }));
    await page.route(`**/api/manager/issues/${id}/${action}`, route => { sent = route.request().postDataJSON(); return route.fulfill({ json: { issue: issue(status), event: { id }, requestId: id } }); });
    await page.goto(`/vi/manager/issues/${id}`);
    await page.getByRole("button", { name: "Xử lý" }).click();
    await page.getByLabel("Lý do").fill("Cần kiểm tra lại");
    await page.getByRole("button", { name: label }).click();
    expect(sent).toEqual({ expectedVersion: 3, reason: "Cần kiểm tra lại" });
  });
}

test("merge comparison stays disabled until merge API is available", async ({ page }) => {
  await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ json: { issue: issue("TRIAGED"), requestId: id } }));
  await page.route(`**/api/manager/issues/${reportId}?*`, route => route.fulfill({ json: { issue: { ...issue("SUBMITTED"), id: reportId }, requestId: id } }));
  await page.goto(`/vi/manager/issues/${id}`);
  await page.getByRole("button", { name: "Quan hệ gộp" }).click();
  await page.getByLabel("Mã phiếu nguồn").fill(reportId);
  await page.getByRole("button", { name: "Xem phiếu nguồn" }).click();
  await expect(page.getByRole("heading", { name: "Nguồn" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chờ API gộp của nhóm" })).toBeDisabled();
});

test("merged sources and review-required issue stay read-only", async ({ page }) => {
  const merged = { ...issue("TRIAGED"), reviewRequired: true, reports: [...issue("TRIAGED").reports, { reportId: id, issueId: reportId, description: "Ống nước rò rỉ", locationLabel: "A1 · tầng 2", submittedAt: "2026-11-23T07:00:00.000Z", photos: [] }] };
  await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ json: { issue: merged, requestId: id } }));
  await page.goto(`/vi/manager/issues/${id}`);
  await expect(page.getByText("Phiếu nguồn cần được quản lý rà lại sau khi hủy gộp.")).toBeVisible();
  await page.getByRole("button", { name: "Xử lý" }).click();
  await expect(page.getByRole("button", { name: "Phân công" })).toHaveCount(0);
  await page.getByRole("button", { name: "Quan hệ gộp" }).click();
  await expect(page.getByText("Ống nước rò rỉ")).toBeVisible();
  await expect(page.getByRole("button", { name: "Chờ API hủy gộp và mergeId" })).toBeDisabled();
});

test("changing source during fetch clears stale comparison", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ json: { issue: issue("TRIAGED"), requestId: id } }));
  await page.route(`**/api/manager/issues/${reportId}?*`, async route => { await pending; await route.fulfill({ json: { issue: { ...issue("SUBMITTED"), id: reportId }, requestId: id } }).catch(() => {}); });
  await page.goto(`/vi/manager/issues/${id}`);
  await page.getByRole("button", { name: "Quan hệ gộp" }).click();
  await page.getByLabel("Mã phiếu nguồn").fill(reportId);
  await page.getByRole("button", { name: "Xem phiếu nguồn" }).click();
  await expect(page.getByRole("button", { name: "Đang tải phiếu nguồn…" })).toBeDisabled();
  await page.getByLabel("Mã phiếu nguồn").fill("77777777-7777-4777-8777-777777777777");
  release();
  await expect(page.getByRole("heading", { name: "Nguồn" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Xem phiếu nguồn" })).toBeEnabled();
});

test("detail distinguishes missing and forbidden responses", async ({ page }) => {
  await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "private diagnostic" }, requestId: id } }));
  await page.goto(`/en/manager/issues/${id}`);
  await expect(page.getByRole("heading", { name: "Issue not found" })).toBeVisible();
  await expect(page.getByText("private diagnostic")).toHaveCount(0);
});

test("English mobile detail keeps original report text and keyboard tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ json: { issue: issue("TRIAGED"), requestId: id } }));
  await page.goto(`/en/manager/issues/${id}`);
  await expect(page.getByRole("heading", { name: "Issue details" })).toBeVisible();
  await expect(page.getByText("Đèn H2-03 không sáng")).toBeVisible();
  const handling = page.getByRole("button", { name: "Handling" });
  await handling.focus();
  await page.keyboard.press("Enter");
  await expect(handling).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("forbidden detail shows a safe message", async ({ page }) => {
  await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ status: 403, json: { error: { message: "private" }, requestId: id } }));
  await page.goto(`/vi/manager/issues/${id}`);
  await expect(page.getByRole("heading", { name: "Bạn không có quyền xem phiếu" })).toBeVisible();
  await expect(page.getByText("private")).toHaveCount(0);
});
