const isDev = import.meta.env.DEV;

const WEBHOOK_DEV = import.meta.env.VITE_MAKE_WEBHOOK_DEV ?? "";
const WEBHOOK_PROD = import.meta.env.VITE_MAKE_WEBHOOK_PROD ?? "";

export const MAKE_WEBHOOK_URL = isDev ? WEBHOOK_DEV : WEBHOOK_PROD;

export const WEBHOOK_URLS = {
  INVOICES: MAKE_WEBHOOK_URL,
} as const;

export const N8N_EXPENSE_WEBHOOK = import.meta.env.VITE_N8N_EXPENSE_WEBHOOK ?? "";
export const N8N_INVOICE_WEBHOOK = import.meta.env.VITE_N8N_INVOICE_WEBHOOK ?? "";
