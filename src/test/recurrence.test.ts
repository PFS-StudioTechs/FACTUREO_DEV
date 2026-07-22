import { describe, it, expect } from "vitest";
import { regenerateNextOccurrence } from "@/lib/obligations/recurrence";

describe("regenerateNextOccurrence", () => {
  it("retourne null pour une échéance non récurrente (recurrence=aucune)", () => {
    const result = regenerateNextOccurrence({
      company_id: "company-1", titre: "Facture ponctuelle", categorie: "facture",
      date_echeance: "2026-07-20", recurrence: "aucune", source: "manuelle",
    });
    expect(result).toBeNull();
  });

  it("régénère +1 mois pour une récurrence mensuelle", () => {
    const result = regenerateNextOccurrence({
      company_id: "company-1", titre: "Déclaration URSSAF", categorie: "urssaf",
      date_echeance: "2026-08-01", recurrence: "mensuelle", source: "auto",
    });
    expect(result?.date_echeance).toBe("2026-09-01");
    expect(result?.statut).toBe("a_faire");
    expect(result?.source).toBe("auto");
    expect(result?.recurrence).toBe("mensuelle");
  });

  it("régénère +3 mois pour une récurrence trimestrielle", () => {
    const result = regenerateNextOccurrence({
      company_id: "company-1", titre: "TVA trimestrielle", categorie: "tva",
      date_echeance: "2026-01-15", recurrence: "trimestrielle", source: "manuelle",
    });
    expect(result?.date_echeance).toBe("2026-04-15");
  });

  it("régénère +1 an pour une récurrence annuelle, en gérant le changement d'année", () => {
    const result = regenerateNextOccurrence({
      company_id: "company-1", titre: "CFE", categorie: "impot",
      date_echeance: "2026-12-15", recurrence: "annuelle", source: "auto",
    });
    expect(result?.date_echeance).toBe("2027-12-15");
  });

  it("conserve titre/catégorie/company_id/source de l'échéance clôturée", () => {
    const result = regenerateNextOccurrence({
      company_id: "company-42", titre: "Suivi seuil franchise", categorie: "tva",
      date_echeance: "2026-01-01", recurrence: "annuelle", source: "auto",
    });
    expect(result).toMatchObject({
      company_id: "company-42", titre: "Suivi seuil franchise", categorie: "tva", montant: null,
    });
  });
});
