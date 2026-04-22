const isDev = import.meta.env.DEV;

const WEBHOOK_DEV = import.meta.env.VITE_MAKE_WEBHOOK_DEV ?? "";
const WEBHOOK_PROD = import.meta.env.VITE_MAKE_WEBHOOK_PROD ?? "";

export const MAKE_WEBHOOK_URL = isDev ? WEBHOOK_DEV : WEBHOOK_PROD;

export const WEBHOOK_URLS = {
  EXPENSE_SCANS: MAKE_WEBHOOK_URL,
  INVOICES: MAKE_WEBHOOK_URL,
} as const;
