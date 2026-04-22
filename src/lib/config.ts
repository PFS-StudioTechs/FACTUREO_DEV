// Webhook URLs - environment-aware configuration
const isDev = window.location.hostname === "localhost" || window.location.hostname.includes("lovable.app");

export const MAKE_WEBHOOK_URL = isDev
  ? "https://hook.eu1.make.com/3hj9e037cw2w6dbsq0ywludhaogewygi"
  : "https://hook.eu1.make.com/75qulvbf3yyjd6761usa8rzltde90oxc";

export const WEBHOOK_URLS = {
  EXPENSE_SCANS: MAKE_WEBHOOK_URL,
  INVOICES: MAKE_WEBHOOK_URL,
} as const;
