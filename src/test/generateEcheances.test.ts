import { describe, it, expect } from "vitest";
import { computeAutoEcheances, dedupeAgainstExisting } from "@/lib/obligations/generateEcheances";

describe("computeAutoEcheances", () => {
  it("génère une échéance par obligation applicable, avec source=auto et statut=a_faire", () => {
    const today = new Date(2026, 6, 22); // 22 juillet 2026
    const result = computeAutoEcheances(
      { company_id: "company-1", forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro" },
      today,
    );

    expect(result.length).toBeGreaterThan(0);
    for (const e of result) {
      expect(e.company_id).toBe("company-1");
      expect(e.statut).toBe("a_faire");
      expect(e.source).toBe("auto");
      expect(e.montant).toBeNull();
    }
  });

  it("aligne l'échéance mensuelle sur le 1er du mois suivant", () => {
    const today = new Date(2026, 6, 22); // 22 juillet
    const result = computeAutoEcheances(
      { company_id: "company-1", forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro" },
      today,
    );
    const urssaf = result.find(e => e.titre.includes("URSSAF"));
    expect(urssaf?.date_echeance).toBe("2026-08-01");
    expect(urssaf?.categorie).toBe("urssaf");
    expect(urssaf?.recurrence).toBe("mensuelle");
  });

  it("aligne l'échéance annuelle sur le 1er janvier de l'année suivante", () => {
    const today = new Date(2026, 6, 22);
    const result = computeAutoEcheances(
      { company_id: "company-1", forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro" },
      today,
    );
    const cfe = result.find(e => e.titre.includes("CFE"));
    expect(cfe?.date_echeance).toBe("2027-01-01");
    expect(cfe?.categorie).toBe("impot");
  });

  it("ne génère pas les obligations réel simplifié/normal pour une entreprise en franchise", () => {
    const today = new Date(2026, 6, 22);
    const result = computeAutoEcheances(
      { company_id: "company-1", forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro" },
      today,
    );
    expect(result.some(e => e.titre.includes("CA3"))).toBe(false);
    expect(result.some(e => e.titre.includes("CA12"))).toBe(false);
  });
});

describe("dedupeAgainstExisting", () => {
  it("retire les candidats déjà présents (même company/catégorie/date, source auto)", () => {
    const candidates = computeAutoEcheances(
      { company_id: "company-1", forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro" },
      new Date(2026, 6, 22),
    );
    const alreadyThere = { company_id: "company-1", categorie: "urssaf", date_echeance: "2026-08-01", source: "auto" };

    const result = dedupeAgainstExisting(candidates, [alreadyThere]);

    expect(result.some(e => e.categorie === "urssaf" && e.date_echeance === "2026-08-01")).toBe(false);
    expect(result.length).toBe(candidates.length - 1);
  });

  it("ignore les échéances manuelles existantes — n'empêchent pas la génération auto", () => {
    const candidates = computeAutoEcheances(
      { company_id: "company-1", forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro" },
      new Date(2026, 6, 22),
    );
    const manuelle = { company_id: "company-1", categorie: "urssaf", date_echeance: "2026-08-01", source: "manuelle" };

    const result = dedupeAgainstExisting(candidates, [manuelle]);

    expect(result.length).toBe(candidates.length);
  });

  it("ne retire rien si aucune échéance existante ne correspond", () => {
    const candidates = computeAutoEcheances(
      { company_id: "company-1", forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro" },
      new Date(2026, 6, 22),
    );
    const result = dedupeAgainstExisting(candidates, []);
    expect(result.length).toBe(candidates.length);
  });
});
