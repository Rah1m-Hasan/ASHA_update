import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs/promises";

const require = createRequire(import.meta.url);
const {
  chromium,
} = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.ASHA_TEST_URL || "http://127.0.0.1:4180";
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Workspace QA must use a local preview.",
);
await fs.mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
const apiCalls = [];
try {
  for (const route of ["/login", "/register"]) {
    for (const role of ["patient", "caregiver"]) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        serviceWorkers: "block",
      });
      await context.route("**/api/**", async (request) => {
        apiCalls.push({
          path: new URL(request.request().url()).pathname,
          method: request.request().method(),
        });
        await request.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "No private access in workspace QA" }),
        });
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base + route);
      await page
        .getByRole("group", { name: "Choose a dashboard view" })
        .waitFor();
      assert.equal(
        await page
          .locator(
            'input[type="password"], input[type="email"], input[name="name"]',
          )
          .count(),
        0,
      );
      assert.equal(
        await page.locator('input:not([type="radio"])').count(),
        0,
        "Only a view choice is collected",
      );
      assert.doesNotMatch(
        await page.locator("main").innerText(),
        /signing in|signed in|create (an )?account|creating account/i,
      );
      assert.equal(
        await page
          .getByRole("link", { name: "Connect with a private link" })
          .getAttribute("href"),
        "/dashboard/link",
      );
      // One app: the sign-in views no longer send people to the older Everyday and assistive apps.
      assert.equal(
        await page.locator('a[href^="/everyday.html"], a[href^="/assistive.html"]').count(),
        0,
        "No links to the older apps",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "Mobile view fits",
      );
      if (route === "/register" && role === "caregiver")
        await page.screenshot({
          path: "artifacts/demo-workspace-mobile.png",
          fullPage: true,
        });
      await page
        .getByText(role === "patient" ? "Patient" : "Caregiver", {
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Open " + role + " dashboard" })
        .click();
      await page.waitForURL("**/dashboard/" + role);
      const stored = await page.evaluate(() =>
        Object.fromEntries(Object.entries(localStorage)),
      );
      assert.deepEqual(
        stored,
        { asha_live_dashboard_role: JSON.stringify(role) },
        "Demo entry stores only the chosen view",
      );
      assert.deepEqual(
        await context.cookies(),
        [],
        "Demo entry creates no authentication cookie",
      );
      await context.close();
    }
  }
  assert.deepEqual(
    apiCalls,
    [],
    "Choosing a demo view makes no authentication/session API request",
  );

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  await context.route("**/api/**", (request) =>
    request.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Fixture access denied" }),
    }),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/login");
  await page.getByRole("link", { name: "Connect with a private link" }).click();
  await page.waitForURL("**/dashboard/link");
  await page
    .getByRole("heading", { name: "Connect your care circle" })
    .waitFor();
  assert.equal(
    // Next.js adds its own role=alert route announcer; only the page's alerts count.
    await page.locator("main [role=alert]").count(),
    0,
    "Opening pairing without an invitation is useful, not an error",
  );
  await page
    .getByRole("textbox", { name: "Private link" })
    .fill(base + "/dashboard/link?role=patient#patientId=bad&token=bad");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page
    .getByText("This link is incomplete. Copy the full private link again.")
    .waitFor();
  assert.equal(
    new URL(page.url()).pathname,
    "/dashboard/link",
    "Incomplete invitation does not enter a private workspace",
  );
  await page.screenshot({
    path: "artifacts/private-link-pairing-mobile.png",
    fullPage: true,
  });
  await context.close();
  assert.deepEqual(errors, [], "Workspace entry has no browser errors");
  console.log(
    JSON.stringify(
      {
        credentialFields: 0,
        demoRoleRoutes: 4,
        authenticationRequests: apiCalls.length,
        pairing: "reachable + invalid invitation rejected",
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
