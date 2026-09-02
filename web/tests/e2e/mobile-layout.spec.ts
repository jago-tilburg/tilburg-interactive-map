import { test, expect } from "@playwright/test";

// Real cross-browser-engine coverage for the mobile-responsiveness overhaul
// (see the "Mobile responsiveness overhaul" plan). These run against
// chromium (desktop), mobile-safari (WebKit — the closest automated proxy
// to iOS Safari; it cannot reproduce iOS-version-specific WebKit bugs like
// iOS 26's Liquid Glass toolbar, only ordinary layout regressions) and
// mobile-chrome (a trustworthy proxy for real Android Chrome, same Blink
// engine). No auth is exercised here — anything behind login stays
// deliberately untested by e2e, same as the rest of this codebase's e2e
// coverage today.

test.describe("map page (/) header", () => {
  test("hamburger menu button stays reachable, no horizontal overflow", async ({ page }) => {
    await page.goto("/");

    const menuBtn = page.getByRole("button", { name: "Alle 2 Happies" });
    await expect(menuBtn).toBeVisible();
    await expect(menuBtn).toBeInViewport();

    // Regression guard for the class of bug fixed in 64c24bc: the header
    // row overflowing its container and clipping the hamburger button off
    // the (narrow) viewport.
    const bodyOverflowsX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(bodyOverflowsX).toBe(false);
  });

  test("the page shell never overflows its own viewport height (the app must not be pannable/scrollable)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForTimeout(500);

    // Regression guard: this app is a fixed single-viewport shell (map +
    // header), not a scrolling document — body/html are overflow: hidden on
    // purpose. If ANY change (e.g. extra header padding for a notch/safe-area
    // buffer) makes the shell's actual content taller than the viewport, the
    // whole page becomes draggable/pannable on real mobile browsers even
    // though body says overflow: hidden — see .mainContent's min-height: 0
    // in MapExperience.module.css, which is what keeps this true regardless
    // of how tall the header ends up being.
    const overflowsY = await page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight,
    );
    expect(overflowsY).toBe(false);
  });

  test("opening the hamburger menu shows a full-height panel on mobile, no vh/dvh mismatch clipping", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "full-screen mobile treatment only applies under the 768px breakpoint");
    await page.goto("/");

    await page.getByRole("button", { name: "Alle 2 Happies" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const viewportHeight = page.viewportSize()?.height ?? 0;
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    // Full-bleed on mobile — should span (approximately) the visible
    // viewport, not overflow it or fall short due to a stale vh value.
    expect(box!.height).toBeGreaterThan(viewportHeight * 0.9);
  });
});

test.describe("map filter panel — mobile bottom sheet", () => {
  test("opens full-screen and the results button is reachable, without body scroll-lock breaking it", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "the bottom-sheet filter treatment only applies under the 768px breakpoint");
    await page.goto("/");

    const openBtn = page.getByRole("button", { name: /Filters/ });
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const closeBtn = page.getByRole("button", { name: "Filters sluiten" });
    await expect(closeBtn).toBeVisible();
    await expect(closeBtn).toBeInViewport();

    await closeBtn.click();
    await expect(closeBtn).toBeHidden();
  });
});
