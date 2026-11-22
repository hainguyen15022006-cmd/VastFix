import { expect, test } from "@playwright/test";

for (const path of ["/login", "/register"]) {
  test(`${path} cannot submit credentials before JavaScript is ready`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:3100${path}`);
      await expect(page.getByRole("alert")).toContainText("bật JavaScript");
      await expect(page.getByLabel("Email USTH", { exact: true })).toBeDisabled();
      await expect(page.getByLabel("Mật khẩu", { exact: true })).toBeDisabled();
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
      await expect(page.locator("form")).toHaveAttribute("method", "post");
      // If a browser extension forces native submission, no credential goes in the URL.
      const outgoing = page.waitForRequest(request => request.isNavigationRequest());
      await page.route(`**${path}`, route => route.fulfill({ status: 200, body: "Native fallback blocked from processing credentials" }));
      await page.evaluate(() => {
        const form = document.querySelector("form")!;
        form.querySelector("fieldset")!.disabled = false;
        (form.elements.namedItem("email") as HTMLInputElement).value = "dummy@usth.edu.vn";
        (form.elements.namedItem("password") as HTMLInputElement).value = "NOT_A_REAL_CREDENTIAL";
        HTMLFormElement.prototype.submit.call(form);
      });
      const request = await outgoing;
      expect(request.method()).toBe("POST");
      expect(new URL(request.url()).search).toBe("");
    } finally { await context.close(); }
  });
}
