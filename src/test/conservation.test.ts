import { describe, it, expect } from "vitest";
import { computeDateConservationMin } from "@/lib/documents/conservation";

describe("computeDateConservationMin", () => {
  it("facture -> 10 ans", () => {
    expect(computeDateConservationMin("2026-01-15", "facture")).toBe("2036-01-15");
  });

  it("facturx -> 10 ans", () => {
    expect(computeDateConservationMin("2026-01-15", "facturx")).toBe("2036-01-15");
  });

  it("justificatif -> 10 ans", () => {
    expect(computeDateConservationMin("2026-06-30", "justificatif")).toBe("2036-06-30");
  });

  it("contrat -> 5 ans", () => {
    expect(computeDateConservationMin("2026-01-15", "contrat")).toBe("2031-01-15");
  });

  it("autre -> pas de durée par défaut (null)", () => {
    expect(computeDateConservationMin("2026-01-15", "autre")).toBeNull();
  });

  it("surcharge explicite prioritaire sur la durée par défaut", () => {
    expect(computeDateConservationMin("2026-01-15", "facture", 3)).toBe("2029-01-15");
  });

  it("surcharge fonctionne aussi pour un type sans durée par défaut", () => {
    expect(computeDateConservationMin("2026-01-15", "autre", 2)).toBe("2028-01-15");
  });

  it("ne décale pas le jour local (pas de bug UTC)", () => {
    // Formatage local (getFullYear/getMonth/getDate), jamais toISOString() qui pourrait
    // décaler la date d'un jour selon le fuseau horaire.
    expect(computeDateConservationMin("2026-12-31", "facture", 1)).toBe("2027-12-31");
  });
});
