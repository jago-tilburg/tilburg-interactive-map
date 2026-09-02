import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Closest automated proxy to iOS Safari — Playwright's WebKit is
    // desktop WebKit emulating a mobile viewport/UA, not Apple's actual
    // mobile Safari engine, so it can't reproduce iOS-Safari-version-specific
    // bugs (e.g. iOS 26's Liquid Glass toolbar). Catches ordinary layout
    // regressions; a real iPhone is still required for those.
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
    // Real proxy for Android Chrome — same Blink engine as desktop Chrome,
    // unlike iOS Safari, so this coverage is trustworthy on its own.
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
});
