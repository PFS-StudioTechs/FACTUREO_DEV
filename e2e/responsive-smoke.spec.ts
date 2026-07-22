import { test, expect } from "@playwright/test";

const WIDTHS = [320, 375, 768, 1024, 1280];

const ROUTES = [
  "/",
  "/companies",
  "/clients",
  "/invoices",
  "/expense-scans",
  "/previsionnel",
  "/user-management",
  "/echeancier",
  "/coffre",
  "/assistant",
];

for (const route of ROUTES) {
  test.describe(`responsive ${route}`, () => {
    for (const width of WIDTHS) {
      test(`${width}px — pas de débordement horizontal`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(route, { waitUntil: "networkidle" });

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.body.scrollWidth,
          innerWidth: window.innerWidth,
        }));

        await page.screenshot({
          path: `e2e/results/${route.replace(/\//g, "_") || "_root"}-${width}.png`,
          fullPage: true,
        });

        expect(scrollWidth, `scrollWidth (${scrollWidth}) > innerWidth (${innerWidth}) sur ${route} à ${width}px`).toBeLessThanOrEqual(innerWidth);
      });
    }
  });
}
