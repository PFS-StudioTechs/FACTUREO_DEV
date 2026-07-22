import { describe, it, expect } from "vitest";
import { isLate, isUnpaid, effectiveStatutPaiement } from "@/lib/payments/lateStatus";

describe("isUnpaid", () => {
  it("impaye/en_cours/partiel/en_retard sont non soldées", () => {
    expect(isUnpaid("impaye")).toBe(true);
    expect(isUnpaid("en_cours")).toBe(true);
    expect(isUnpaid("partiel")).toBe(true);
    expect(isUnpaid("en_retard")).toBe(true);
  });
  it("paye/annule ne sont pas non soldées", () => {
    expect(isUnpaid("paye")).toBe(false);
    expect(isUnpaid("annule")).toBe(false);
  });
});

describe("isLate", () => {
  const today = new Date(2026, 6, 22); // 22 juillet 2026

  it("facture non soldée avec échéance dépassée → en retard", () => {
    expect(isLate("2026-07-01", "impaye", today)).toBe(true);
  });
  it("facture non soldée avec échéance future → pas en retard", () => {
    expect(isLate("2026-08-01", "impaye", today)).toBe(false);
  });
  it("échéance dépassée mais déjà payée → pas en retard", () => {
    expect(isLate("2026-07-01", "paye", today)).toBe(false);
  });
  it("échéance = aujourd'hui → pas encore en retard", () => {
    expect(isLate("2026-07-22", "impaye", today)).toBe(false);
  });
});

describe("effectiveStatutPaiement", () => {
  it("recalcule en_retard sans écrire en base (statut stocké différent)", () => {
    expect(effectiveStatutPaiement("2026-07-01", "impaye", new Date(2026, 6, 22))).toBe("en_retard");
  });
  it("laisse le statut inchangé si pas en retard", () => {
    expect(effectiveStatutPaiement("2026-08-01", "impaye", new Date(2026, 6, 22))).toBe("impaye");
  });
});
