import { describe, it, expect } from "vitest";
import { reconcilePayment } from "@/lib/payments/reconcilePayment";

describe("reconcilePayment", () => {
  it("montant reçu = montant facture → paye", () => {
    expect(reconcilePayment(120, 120)).toEqual({ statut_paiement: "paye", montant_paye: 120 });
  });
  it("montant reçu > montant facture (arrondi Stripe) → paye", () => {
    expect(reconcilePayment(120, 120.0001)).toEqual({ statut_paiement: "paye", montant_paye: 120 });
  });
  it("montant reçu < montant facture → partiel", () => {
    expect(reconcilePayment(120, 50)).toEqual({ statut_paiement: "partiel", montant_paye: 50 });
  });
});
