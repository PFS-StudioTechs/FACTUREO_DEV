import { describe, it, expect } from "vitest";
import {
  rankSignals,
  signalsFromEcheances,
  signalsFromInvoices,
  signalsFromExpenseScans,
  signalsFromMissingRecurrence,
  type Signal,
  type EcheanceLite,
  type InvoiceLite,
  type ExpenseScanLite,
  type CompanyForSync,
} from "@/lib/assistant/signals";
import { computeAutoEcheances } from "@/lib/obligations/generateEcheances";

const TODAY = new Date(2026, 6, 21); // 21 juillet 2026 (mois 0-indexé)

describe("signalsFromEcheances", () => {
  const base: EcheanceLite = {
    id: "e1", company_id: "c1", titre: "Déclaration TVA", categorie: "tva",
    date_echeance: "2026-07-25", statut: "a_faire",
  };

  it("échéance vérifiée <7j -> critique", () => {
    const signals = signalsFromEcheances([base], TODAY);
    expect(signals).toHaveLength(1);
    expect(signals[0].severite).toBe("critique");
    expect(signals[0].actionRoute).toBe("/echeancier");
  });

  it("échéance vérifiée >30j -> aucun signal", () => {
    const signals = signalsFromEcheances([{ ...base, date_echeance: "2026-12-01" }], TODAY);
    expect(signals).toHaveLength(0);
  });

  it("échéance déjà faite -> aucun signal même si proche", () => {
    const signals = signalsFromEcheances([{ ...base, statut: "fait" }], TODAY);
    expect(signals).toHaveLength(0);
  });

  it("obligation non vérifiée (à confirmer) approchant -> info, jamais critique", () => {
    const signals = signalsFromEcheances([{ ...base, titre: "CFE (à confirmer)" }], TODAY);
    expect(signals).toHaveLength(1);
    expect(signals[0].severite).toBe("info");
    expect(signals[0].titre).toContain("à confirmer");
    expect(signals[0].titre).not.toContain("(à confirmer)"); // suffixe retiré du titre affiché
  });

  it("obligation non vérifiée trop lointaine (>30j) -> aucun signal", () => {
    const signals = signalsFromEcheances([{ ...base, titre: "CFE (à confirmer)", date_echeance: "2027-01-01" }], TODAY);
    expect(signals).toHaveLength(0);
  });
});

describe("signalsFromInvoices", () => {
  const base: InvoiceLite = {
    id: "i1", numero_facture: "F-001", statut_paiement: "impaye",
    date_limite_paiement: "2026-07-10", reminder_level: 0, last_reminder_at: null,
  };

  it("facture en retard -> critique + relance possible (jamais relancée)", () => {
    const signals = signalsFromInvoices([base], TODAY);
    const severites = signals.map(s => s.severite);
    expect(severites).toContain("critique");
    expect(signals.some(s => s.categorie === "relance")).toBe(true);
  });

  it("facture en retard mais relancée récemment -> pas de nouveau signal de relance", () => {
    const signals = signalsFromInvoices([{
      ...base, reminder_level: 1, last_reminder_at: "2026-07-18T00:00:00Z",
    }], TODAY);
    expect(signals.some(s => s.categorie === "relance")).toBe(false);
    expect(signals.some(s => s.severite === "critique")).toBe(true);
  });

  it("facture en retard relancée il y a longtemps -> relance de nouveau possible", () => {
    const signals = signalsFromInvoices([{
      ...base, reminder_level: 1, last_reminder_at: "2026-07-01T00:00:00Z",
    }], TODAY);
    expect(signals.some(s => s.categorie === "relance")).toBe(true);
  });

  it("facture impayée approchant l'échéance (<7j, pas encore en retard) -> attention", () => {
    const signals = signalsFromInvoices([{ ...base, date_limite_paiement: "2026-07-25" }], TODAY);
    expect(signals).toHaveLength(1);
    expect(signals[0].severite).toBe("attention");
  });

  it("facture payée -> aucun signal", () => {
    const signals = signalsFromInvoices([{ ...base, statut_paiement: "paye" }], TODAY);
    expect(signals).toHaveLength(0);
  });

  it("facture impayée loin de l'échéance -> aucun signal", () => {
    const signals = signalsFromInvoices([{ ...base, date_limite_paiement: "2026-09-01" }], TODAY);
    expect(signals).toHaveLength(0);
  });
});

describe("signalsFromExpenseScans", () => {
  const base: ExpenseScanLite = { id: "s1", status: "à revoir", image_url: "user/images/1.jpg", merchant: "Amazon" };

  it("scan complet et hors traitement -> aucun signal", () => {
    expect(signalsFromExpenseScans([base])).toHaveLength(0);
  });

  it("scan sans fichier -> justificatif manquant", () => {
    const signals = signalsFromExpenseScans([{ ...base, image_url: null }]);
    expect(signals).toHaveLength(1);
    expect(signals[0].titre).toContain("Justificatif manquant");
  });

  it("scan bloqué en traitement -> attention", () => {
    const signals = signalsFromExpenseScans([{ ...base, status: "traitement" }]);
    expect(signals).toHaveLength(1);
    expect(signals[0].titre).toContain("Analyse bloquée");
  });
});

describe("signalsFromMissingRecurrence", () => {
  const company: CompanyForSync = {
    company_id: "c1", denomination: "Ma Boite",
    forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro",
  };

  it("aucune échéance existante -> signale les échéances candidates manquantes", () => {
    const signals = signalsFromMissingRecurrence([company], [], TODAY);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every(s => s.severite === "info")).toBe(true);
  });

  it("toutes les échéances candidates déjà présentes -> aucun signal", () => {
    const candidates = computeAutoEcheances(company, TODAY);
    const existing = candidates.map(c => ({
      company_id: c.company_id, categorie: c.categorie, date_echeance: c.date_echeance, source: c.source,
    }));
    const signals = signalsFromMissingRecurrence([company], existing, TODAY);
    expect(signals).toHaveLength(0);
  });
});

describe("rankSignals", () => {
  it("trie par sévérité (critique > attention > info) puis par date croissante", () => {
    const signals: Signal[] = [
      { id: "a", severite: "info", categorie: "x", titre: "A", description: "", actionLabel: "", actionRoute: "/", date: "2026-08-01" },
      { id: "b", severite: "critique", categorie: "x", titre: "B", description: "", actionLabel: "", actionRoute: "/", date: "2026-07-30" },
      { id: "c", severite: "critique", categorie: "x", titre: "C", description: "", actionLabel: "", actionRoute: "/", date: "2026-07-22" },
      { id: "d", severite: "attention", categorie: "x", titre: "D", description: "", actionLabel: "", actionRoute: "/" },
    ];
    const ranked = rankSignals(signals);
    expect(ranked.map(s => s.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("état vide -> tableau vide", () => {
    expect(rankSignals([])).toEqual([]);
  });
});
