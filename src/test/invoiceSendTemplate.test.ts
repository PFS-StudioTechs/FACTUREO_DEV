import { describe, it, expect } from "vitest";
import { buildInvoiceSendEmail } from "@/lib/payments/invoiceSendTemplate";

describe("buildInvoiceSendEmail", () => {
  it("inclut le client, le numéro, le montant et l'échéance fournis", () => {
    const body = buildInvoiceSendEmail({
      clientNom: "Client SARL", numeroFacture: "F-2026-010", montantTtc: 1234.5, dateLimitePaiement: "15/08/2026",
    });
    expect(body).toContain("Client SARL");
    expect(body).toContain("F-2026-010");
    expect(body).toContain("1234.50");
    expect(body).toContain("15/08/2026");
  });

  it("est déterministe : mêmes entrées -> même sortie", () => {
    const vars = { clientNom: "X", numeroFacture: "F-1", montantTtc: 100, dateLimitePaiement: "01/01/2027" };
    expect(buildInvoiceSendEmail(vars)).toBe(buildInvoiceSendEmail(vars));
  });
});
