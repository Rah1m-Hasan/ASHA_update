// One home about Asha, "Try Asha" to the app home, and an app home that adapts to what the person uses.
//   node tests/home-browser.mjs   (needs the dev server, NEXT_TEST_URL, default http://127.0.0.1:4180)
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.NEXT_TEST_URL || "http://127.0.0.1:4180";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true, args: ["--no-sandbox", "--no-proxy-server"] });
const errors = [];
const fakePerception = "export function getPerception(){return {on(){return()=>{}},running:false,start(){},stop(){}}}";

async function setup(viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  await context.route("**/engine/perception.js", (r) => r.fulfill({ contentType: "text/javascript", body: fakePerception }));
  await context.route("**/api/session**", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, events: [], status: null }) }));
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}
const areaOrder = (page) => page.locator("[aria-labelledby=areas-title] > ul > li").evaluateAll((li) => li.map((x) => x.querySelector(".text-lg")?.textContent));

// ---------- 1. The about page has one way in, and no links to the older apps ----------
{
  const { context, page } = await setup();
  await page.goto(base + "/");
  await page.getByRole("heading", { level: 1 }).waitFor();
  const tries = await page.getByRole("link", { name: "Try Asha", exact: true }).evaluateAll((a) => [...new Set(a.map((x) => x.getAttribute("href")))]);
  assert.deepEqual(tries, ["/dashboard/patient"], "every Try Asha opens the app home");
  assert.equal(await page.locator('a[href^="/everyday.html"], a[href^="/assistive.html"]').count(), 0, "no links to the older apps");
  await page.getByRole("link", { name: "Try Asha", exact: true }).first().click();
  await page.waitForURL("**/dashboard/patient");
  await page.getByRole("heading", { name: /What would you like to do\?/ }).waitFor();
  await context.close();
}

// ---------- 2. The app home adapts: continue, recent first, personalise, hidden areas ----------
{
  const { context, page } = await setup();
  await page.goto(base + "/dashboard/patient");
  await page.getByRole("heading", { name: /What would you like to do\?/ }).waitFor();
  assert.deepEqual(await areaOrder(page), ["Communicate", "Talk to Asha", "Exercise", "Nutrition", "Wellbeing"]);
  assert.equal(await page.getByTestId("home-continue").count(), 0, "nothing to continue on a first visit");
  await page.getByRole("button", { name: /^Water/ }).waitFor();
  assert.equal(await page.locator('nav[aria-label="Patient navigation"] a[href^="/everyday.html"], nav[aria-label="Patient navigation"] a[href^="/assistive.html"]').count(), 0);

  // Choosing Exercise opens Move, and Home then offers to continue and lists Exercise first.
  await page.getByRole("link", { name: /^Exercise/ }).last().click();
  await page.waitForURL("**/dashboard/patient/move");
  await page.getByRole("heading", { name: "Move" }).waitFor();
  assert.equal(await page.locator('nav[aria-label="Patient navigation"] [aria-current=page]').textContent(), "Exercise");
  await page.goto(base + "/dashboard/patient/vitalsense");
  assert.equal(await page.locator('nav[aria-label="Patient navigation"] [aria-current=page]').textContent(), "Wellbeing", "a module lights up its area");
  await page.goto(base + "/dashboard/patient");
  await page.getByTestId("home-continue").getByText("VitalSense").waitFor();
  assert.deepEqual((await areaOrder(page)).slice(0, 2), ["Wellbeing", "Exercise"], "most recent areas come first");

  // Personalise: hide Communicate. The quick requests go with it; the area moves to "More in Asha".
  await page.getByRole("button", { name: "Personalise" }).click();
  await page.getByRole("checkbox", { name: "Communicate" }).uncheck();
  await page.getByRole("button", { name: "Done" }).click();
  assert.equal(await page.getByRole("button", { name: /^Water/ }).count(), 0);
  assert.ok(!(await areaOrder(page)).includes("Communicate"));
  await page.getByText("More in Asha (1)").click();
  await page.getByRole("link", { name: /^Communicate/ }).last().click();
  await page.waitForURL("**/dashboard/patient/communicate");
  await page.getByRole("heading", { name: "Communicate", level: 1 }).waitFor();
  await page.getByRole("link", { name: /^FaceSpeak/ }).click();
  await page.waitForURL("**/dashboard/patient/facespeak");
  assert.equal(await page.locator('nav[aria-label="Patient navigation"] [aria-current=page]').textContent(), "Communicate");
  await page.goto(base + "/dashboard/patient");
  await page.getByRole("button", { name: /^Water/ }).waitFor(); // opening it again brought it back
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("asha_live_home_v1")));
  assert.deepEqual(Object.keys(stored).sort(), ["hidden", "recent"], "home keeps only module visits and hidden areas");
  await context.close();
}

// ---------- 3. Phone width: nothing overflows ----------
{
  const { context, page } = await setup({ width: 390, height: 844 });
  for (const path of ["/", "/dashboard/patient", "/dashboard/patient/communicate", "/dashboard/patient/wellbeing", "/login"]) {
    await page.goto(base + path);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await page.waitForTimeout(300);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(wide <= 1, `${path} overflows by ${wide}px`);
  }
  await context.close();
}

await browser.close();
assert.deepEqual(errors, [], "no page errors");
console.log("Home browser: one about page with Try Asha, adaptive app home (continue, recent first, personalise, hidden areas), area highlighting and phone layout passed");
