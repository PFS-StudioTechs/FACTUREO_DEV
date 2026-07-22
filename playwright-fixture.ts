// lovable-agent-playwright-config n'est pas installé dans cet environnement
// (package Lovable-platform, absent de package.json/node_modules — cf.
// AUDIT_RESPONSIVE_2026-07-22.md). Storage state géré par global-setup.ts +
// playwright.config.ts à la place de la fixture custom du package.
export { test, expect } from "@playwright/test";
