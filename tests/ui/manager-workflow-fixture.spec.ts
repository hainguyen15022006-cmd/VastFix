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
  test(`detail fixture ${status} shows sections and keeps mutation disabled`, async ({ page }) => {
    await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ json: { issue: issue(status), requestId: id } }));
    await page.route("**/api/manager/staff", route => route.fulfill({ json: { items: [{ id, name: "Demo staff" }], requestId: id } }));
    await page.goto(`/vi/manager/issues/${id}`);
    await expect(page.getByRole("heading", { name: "Chi tiết phiếu" })).toBeVisible();
    await expect(page.getByText("Đèn H2-03 không sáng")).toBeVisible();
    await page.getByRole("button", { name: "Xử lý" }).click();
    await expect(page.getByRole("button", { name: "Chờ nối API CP2" })).toBeDisabled();
    await page.getByRole("button", { name: "Lịch sử" }).click();
    await expect(page.getByText("ISSUE_TRIAGED")).toBeVisible();
  });
}

test("detail distinguishes missing and forbidden responses", async ({ page }) => {
  await page.route(`**/api/manager/issues/${id}?*`, route => route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "private diagnostic" }, requestId: id } }));
  await page.goto(`/en/manager/issues/${id}`);
  await expect(page.getByRole("heading", { name: "Issue not found" })).toBeVisible();
  await expect(page.getByText("private diagnostic")).toHaveCount(0);
});
