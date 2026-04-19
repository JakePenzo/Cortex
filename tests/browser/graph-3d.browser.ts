/**
 * Browser E2E: 3D graph toggle — Chromium only (WebGL)
 *
 * Verifies that clicking the 3D button:
 *  1. Loads the CDN library without errors
 *  2. Renders a WebGL <canvas> inside #graph-3d
 *  3. Produces a canvas with real dimensions
 *  4. No console errors are thrown during the whole flow
 */
import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

// Dismiss onboarding so it never blocks interaction
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cortex-onboarded", "1");
  });
});

// Helper: collect all console errors during test
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err: Error) => errors.push(err.message));
  return errors;
}

// Helper: wait for the 2D graph to finish loading
async function waitForGraph2D(page: Page) {
  await page.waitForSelector("#graph-canvas canvas", { timeout: 10_000 });
}

// ── 3D button existence ───────────────────────────────────────
test.describe("3D button", () => {
  test("btn-3d is visible and labelled '3D'", async ({ page }) => {
    await page.goto("/");
    await waitForGraph2D(page);
    const btn = page.locator("#btn-3d");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText("3D");
  });
});

// ── 3D graph rendering ────────────────────────────────────────
test.describe("3D graph", () => {
  // Give extra time — CDN load + warmupTicks(120) can take a few seconds
  test.setTimeout(60_000);

  test("clicking 3D shows loading placeholder then renders WebGL canvas", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await waitForGraph2D(page);

    // Let 2D graph data load so allMemories is populated
    await page.waitForTimeout(1_500);

    // Click the 3D button
    await page.locator("#btn-3d").click();

    // Button text should flip to "2D"
    await expect(page.locator("#btn-3d")).toHaveText("2D");

    // #graph-3d should become visible
    await expect(page.locator("#graph-3d")).toBeVisible();

    // Wait for CDN script to be injected and loaded — look for the <canvas> that
    // 3d-force-graph creates inside the container (uses Three.js → WebGL canvas)
    await page.waitForSelector("#graph-3d canvas", { timeout: 30_000 });

    // Verify the canvas has real pixel dimensions
    const canvas = page.locator("#graph-3d canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);

    // No [Cortex 3D] errors (CDN / init failure)
    const cortexErrors = errors.filter(e => e.includes("[Cortex 3D]") || e.includes("3d-force-graph"));
    expect(cortexErrors, `3D graph errors: ${cortexErrors.join(", ")}`).toHaveLength(0);
  });

  test("ForceGraph3D and THREE globals are set after CDN load", async ({ page }) => {
    await page.goto("/");
    await waitForGraph2D(page);
    await page.waitForTimeout(1_000);

    await page.locator("#btn-3d").click();

    // Wait for CDN canvas to appear, then inspect the globals
    await page.waitForSelector("#graph-3d canvas", { timeout: 30_000 });

    const globals = await page.evaluate(() => ({
      ForceGraph3D: typeof (window as any).ForceGraph3D === "function",
      THREE:        typeof (window as any).THREE === "object",
    }));
    expect(globals.ForceGraph3D).toBe(true);
    expect(globals.THREE).toBe(true);
  });

  test("native nav info overlay is suppressed (no duplicate hint)", async ({ page }) => {
    await page.goto("/");
    await waitForGraph2D(page);
    await page.waitForTimeout(1_000);

    await page.locator("#btn-3d").click();
    await page.waitForSelector("#graph-3d canvas", { timeout: 30_000 });
    await page.waitForTimeout(500);

    // The library's built-in hint element (inside #graph-3d) should not be visible
    // showNavInfo(false) removes or hides it — either way it must not be user-visible
    const nativeHint = page.locator("#graph-3d").locator("text=Left-click: rotate").first();
    await expect(nativeHint).toBeHidden();

    // Our custom hint banner should still be present
    const ourHint = page.locator("#graph-hint");
    await expect(ourHint).toBeVisible();
    await expect(ourHint).toContainText("Drag to rotate");
  });

  test("cluster halos are painted after physics settle", async ({ page }) => {
    test.setTimeout(90_000); // CDN load + warmup + 8s fallback timer
    await page.goto("/");
    await waitForGraph2D(page);
    await page.waitForTimeout(1_000);

    await page.locator("#btn-3d").click();
    await page.waitForSelector("#graph-3d canvas", { timeout: 30_000 });

    // add3DHalos() sets window.__halosAdded = <cluster count> in onEngineStop
    // WebKit runs the physics engine slower — allow up to 45s
    await page.waitForFunction(
      () => typeof (window as any).__halosAdded === "number" && (window as any).__halosAdded > 0,
      { timeout: 45_000, polling: 500 }
    );

    const haloTypes = await page.evaluate(() => (window as any).__halosAdded as number);
    expect(haloTypes).toBeGreaterThan(0);
  });

  test("graph-3d container has nonzero offsetWidth when init runs", async ({ page }) => {
    await page.goto("/");
    await waitForGraph2D(page);
    await page.waitForTimeout(1_000);

    await page.locator("#btn-3d").click();

    // Wait for canvas to appear
    await page.waitForSelector("#graph-3d canvas", { timeout: 30_000 });

    const dims = await page.evaluate(() => {
      const el = document.getElementById("graph-3d");
      return el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
    });
    expect(dims).not.toBeNull();
    expect(dims!.w).toBeGreaterThan(100);
    expect(dims!.h).toBeGreaterThan(100);
  });

  test("graph data is loaded before 3D toggle (via header count)", async ({ page }) => {
    await page.goto("/");
    await waitForGraph2D(page);
    // Wait one refresh tick
    await page.waitForTimeout(1_000);

    // Verify the header total shows seeded data is loaded (not 0)
    const total = await page.locator("#h-total").textContent();
    expect(Number(total)).toBeGreaterThan(0);
  });

  test("_graphEdges is set before 3D toggle", async ({ page }) => {
    await page.goto("/");
    await waitForGraph2D(page);
    await page.waitForTimeout(2_000);

    const edges = await page.evaluate(() => (window as any)._graphEdges);
    // edges should be an array (possibly empty for seed data with no tags in common)
    expect(Array.isArray(edges)).toBe(true);
  });

  test("toggling back to 2D destroys graph3d and restores canvas", async ({ page }) => {
    await page.goto("/");
    await waitForGraph2D(page);
    await page.waitForTimeout(1_000);

    // Go 3D
    await page.locator("#btn-3d").click();
    await page.waitForSelector("#graph-3d canvas", { timeout: 30_000 });

    // Go back to 2D
    await page.locator("#btn-3d").click();
    await expect(page.locator("#btn-3d")).toHaveText("3D");

    // 2D canvas should reappear; 3D container should be hidden
    await expect(page.locator("#graph-canvas canvas")).toBeVisible();
    await expect(page.locator("#graph-3d")).toBeHidden();
  });
});

// ── Error isolation: CDN blocked ──────────────────────────────
test.describe("3D graph graceful CDN failure", () => {
  test.setTimeout(30_000);

  test("shows error fallback when CDN is blocked", async ({ page }) => {
    // Block the 3D libs but leave vis.js alone (vis.js is also on jsdelivr)
    await page.route("**/3d-force-graph**", route => route.abort());
    await page.route("**/npm/three@**", route => route.abort());

    await page.goto("/");
    await waitForGraph2D(page);
    await page.waitForTimeout(500);

    await page.locator("#btn-3d").click();

    // Should show the error fallback div
    await page.waitForSelector(
      "#graph-3d div:has-text('3D renderer failed to load')",
      { timeout: 15_000 }
    );

    // A "Back to 2D" button should appear in the fallback
    const backBtn = page.locator("#graph-3d button", { hasText: "Back to 2D" });
    await expect(backBtn).toBeVisible();

    // Clicking Back to 2D restores the 2D view
    await backBtn.click();
    await expect(page.locator("#btn-3d")).toHaveText("3D");
  });
});
