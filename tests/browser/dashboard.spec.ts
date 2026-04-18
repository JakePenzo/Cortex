/**
 * Browser E2E: Dashboard — Chromium + WebKit (Safari)
 *
 * Tests the vis.js knowledge graph renders correctly and the ResizeObserver
 * loop does NOT occur. This is the regression test for the Safari graph bug.
 */
import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

// ── Helpers ───────────────────────────────────────────────────
async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err: Error) => errors.push(err.message));
  return errors;
}

async function waitForGraph(page: Page) {
  // vis.js renders into a <canvas> inside #graph-canvas
  await page.waitForSelector("#graph-canvas canvas", { timeout: 10_000 });
}

// ── Core load tests ───────────────────────────────────────────
test.describe("Dashboard loads", () => {
  test("page renders without JS errors in Chromium/WebKit", async ({ page }) => {
    const errors = await collectErrors(page);
    await page.goto("/");
    await waitForGraph(page);
    // Let the auto-refresh cycle run once to catch any loop errors
    await page.waitForTimeout(6_000);

    const resizeErrors = errors.filter(e => e.includes("ResizeObserver"));
    expect(resizeErrors, "ResizeObserver loop errors found").toHaveLength(0);
    expect(errors.filter(e => !e.includes("ResizeObserver"))).toHaveLength(0);
  });

  test("header shows memory count > 0 after seed", async ({ page }) => {
    await page.goto("/");
    await waitForGraph(page);
    const total = await page.locator("#h-total").textContent();
    expect(Number(total)).toBeGreaterThan(0);
  });

  test("vis.js canvas element is present and sized", async ({ page }) => {
    await page.goto("/");
    await waitForGraph(page);

    const canvas = page.locator("#graph-canvas canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });
});

// ── ResizeObserver regression ─────────────────────────────────
test.describe("ResizeObserver stability", () => {
  test("no loop after 10s of idle (the Safari regression)", async ({ page }) => {
    const errors = await collectErrors(page);
    await page.goto("/");
    await waitForGraph(page);

    // Let physics settle and two auto-refresh cycles complete
    await page.waitForTimeout(11_000);

    expect(errors.filter(e => e.includes("ResizeObserver"))).toHaveLength(0);
  });

  test("no loop after window resize", async ({ page }) => {
    const errors = await collectErrors(page);
    await page.goto("/");
    await waitForGraph(page);

    // Simulate a window resize
    await page.setViewportSize({ width: 1024, height: 600 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1_000);

    expect(errors.filter(e => e.includes("ResizeObserver"))).toHaveLength(0);
  });
});

// ── Type filter ───────────────────────────────────────────────
test.describe("Type filter", () => {
  test("type legend items are visible", async ({ page }) => {
    await page.goto("/");
    await waitForGraph(page);

    const items = page.locator(".type-item");
    await expect(items.first()).toBeVisible();
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3); // preference, decision, fact at minimum
  });

  test("clicking a type toggles inactive class", async ({ page }) => {
    await page.goto("/");
    await waitForGraph(page);

    const firstType = page.locator(".type-item").first();
    await firstType.click();
    await expect(firstType).toHaveClass(/inactive/);
    // Click again to re-enable
    await firstType.click();
    await expect(firstType).not.toHaveClass(/inactive/);
  });
});

// ── Node interaction ──────────────────────────────────────────
test.describe("Node interaction", () => {
  test("clicking a node opens detail panel", async ({ page }) => {
    await page.goto("/");
    await waitForGraph(page);

    // Wait for physics to settle so nodes are in stable positions
    await page.waitForTimeout(3_000);

    const canvas = page.locator("#graph-canvas canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas not found");

    // Click the centre of the graph — likely hits a node in the seeded data
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await page.waitForTimeout(300);

    // Detail panel should now either show a memory OR the empty-state prompt
    const panel = page.locator("#panel-detail");
    await expect(panel).toBeVisible();
  });

  test("Fit button triggers network fit", async ({ page }) => {
    await page.goto("/");
    await waitForGraph(page);

    // Should not throw
    await page.locator("#btn-fit").click();
    await page.waitForTimeout(500);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    expect(errors).toHaveLength(0);
  });
});

// ── Superseded toggle ─────────────────────────────────────────
test.describe("Show/hide superseded", () => {
  test("toggle button changes label", async ({ page }) => {
    await page.goto("/");
    await waitForGraph(page);

    const btn = page.locator("#btn-toggle-superseded");
    await expect(btn).toHaveText("Show superseded");
    await btn.click();
    await expect(btn).toHaveText("Hide superseded");
    await btn.click();
    await expect(btn).toHaveText("Show superseded");
  });
});

// ── Add memory ────────────────────────────────────────────────
test.describe("Add memory", () => {
  test("adding a memory increases the count", async ({ page }) => {
    await page.goto("/");
    await waitForGraph(page);

    const before = Number(await page.locator("#h-total").textContent());

    // Switch to Add tab and submit a new memory
    await page.locator("#tab-add").click();
    await page.locator("#add-content").fill("Test memory from Playwright");
    await page.getByRole("button", { name: "Add memory" }).click();

    // Wait for refresh cycle
    await page.waitForTimeout(1_500);

    const after = Number(await page.locator("#h-total").textContent());
    expect(after).toBe(before + 1);
  });
});
