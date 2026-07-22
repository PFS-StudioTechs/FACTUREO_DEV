import { describe, it, expect } from "vitest";
import { getObligationsProfile } from "@/lib/obligations/getObligationsProfile";
import { computeAutoEcheances, dedupeAgainstExisting } from "@/lib/obligations/generateEcheances";

describe("getObligationsProfile — sociétés", () => {
  it("SASU, réel normal, IS : TVA CA3 + IS (acompte+solde) + liasse + cotisations DSN + CFE, jamais le jeu micro ni TNS", () => {
    const types = getObligationsProfile({ forme_juridique_categorie: "sasu", regime_tva: "reel_normal", regime_fiscal: "is" }).map(o => o.type);

    expect(types).toEqual(expect.arrayContaining([
      "tva_ca3", "is_acompte", "is_solde", "liasse_fiscale", "cotisations_dirigeant_dsn", "cfe",
    ]));
    expect(types).not.toContain("cotisations_dirigeant_tns");
    expect(types).not.toContain("urssaf_ca_micro");
    expect(types).not.toContain("irpp_2042_c_pro");
    expect(types).not.toContain("tva_suivi_seuil_franchise");
    expect(types).not.toContain("tva_ca12");
  });

  it("EURL, réel simplifié, IS : CA12 + IS + liasse + cotisations TNS + CFE, jamais DSN ni CA3", () => {
    const types = getObligationsProfile({ forme_juridique_categorie: "eurl", regime_tva: "reel_simplifie", regime_fiscal: "is" }).map(o => o.type);

    expect(types).toEqual(expect.arrayContaining([
      "tva_ca12", "is_acompte", "is_solde", "liasse_fiscale", "cotisations_dirigeant_tns", "cfe",
    ]));
    expect(types).not.toContain("cotisations_dirigeant_dsn");
    expect(types).not.toContain("tva_ca3");
  });

  it("SARL, réel normal, option IR (pas IS) : liasse + TNS + CFE + TVA restent, mais pas d'acompte/solde IS", () => {
    const types = getObligationsProfile({ forme_juridique_categorie: "sarl", regime_tva: "reel_normal", regime_fiscal: "ir" }).map(o => o.type);

    expect(types).toEqual(expect.arrayContaining(["tva_ca3", "liasse_fiscale", "cotisations_dirigeant_tns", "cfe"]));
    expect(types).not.toContain("is_acompte");
    expect(types).not.toContain("is_solde");
  });

  it("SARL, réel simplifié, IS : jeu complet symétrique à l'EURL", () => {
    const types = getObligationsProfile({ forme_juridique_categorie: "sarl", regime_tva: "reel_simplifie", regime_fiscal: "is" }).map(o => o.type);
    expect(types).toEqual(expect.arrayContaining([
      "tva_ca12", "is_acompte", "is_solde", "liasse_fiscale", "cotisations_dirigeant_tns", "cfe",
    ]));
  });

  it("toutes les obligations société portent le marqueur non-officiel verifie=false", () => {
    const obligations = getObligationsProfile({ forme_juridique_categorie: "sasu", regime_tva: "reel_normal", regime_fiscal: "is" });
    expect(obligations.length).toBeGreaterThan(0);
    for (const o of obligations) expect(o.verifie).toBe(false);
  });

  it("la suite micro existante reste intacte (non-régression)", () => {
    const types = getObligationsProfile({ forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro" }).map(o => o.type);
    expect(types).toEqual(expect.arrayContaining(["urssaf_ca_micro", "irpp_2042_c_pro", "tva_suivi_seuil_franchise", "cfe"]));
    expect(types).not.toContain("is_acompte");
    expect(types).not.toContain("cotisations_dirigeant_dsn");
    expect(types).not.toContain("cotisations_dirigeant_tns");
  });
});

describe("computeAutoEcheances — sociétés + marqueur non-officiel", () => {
  it("les échéances société générées portent le suffixe « à confirmer » dans le titre", () => {
    const result = computeAutoEcheances(
      { company_id: "company-1", forme_juridique_categorie: "sasu", regime_tva: "reel_normal", regime_fiscal: "is" },
      new Date(2026, 6, 22),
    );
    expect(result.length).toBeGreaterThan(0);
    for (const e of result) expect(e.titre).toContain("(à confirmer)");
  });

  it("catégorise correctement les nouvelles obligations société (impot/urssaf)", () => {
    const result = computeAutoEcheances(
      { company_id: "company-1", forme_juridique_categorie: "eurl", regime_tva: "reel_simplifie", regime_fiscal: "is" },
      new Date(2026, 6, 22),
    );
    const isSolde = result.find(e => e.titre.includes("Solde"));
    const cotisations = result.find(e => e.titre.includes("TNS"));
    expect(isSolde?.categorie).toBe("impot");
    expect(cotisations?.categorie).toBe("urssaf");
  });

  it("dédup société : n'insère pas deux fois la même échéance auto déjà en base (clé sans collision de sibling)", () => {
    // is_acompte (impot, trimestrielle) est seul dans son couple catégorie/périodicité
    // pour EURL — pas de collision avec un autre type d'obligation (cf. test de
    // collision ci-dessous pour le cas où plusieurs types partagent la même clé).
    const candidates = computeAutoEcheances(
      { company_id: "company-1", forme_juridique_categorie: "eurl", regime_tva: "reel_simplifie", regime_fiscal: "is" },
      new Date(2026, 6, 22),
    );
    const acompteCandidate = candidates.find(e => e.titre.includes("Acompte"))!;
    const existing = [{ company_id: "company-1", categorie: acompteCandidate.categorie, date_echeance: acompteCandidate.date_echeance, source: "auto" }];

    const result = dedupeAgainstExisting(candidates, existing);

    expect(result.length).toBe(candidates.length - 1);
    expect(result.some(e => e.titre.includes("Acompte"))).toBe(false);
  });

  // Découverte lors de la vérification bout-en-bout (Étape 3) : la clé de dédup
  // (company_id, categorie, date_echeance) — la même que l'index unique DB —
  // ne distingue PAS deux obligations différentes si elles partagent la même
  // catégorie ET la même périodicité (donc la même date calculée). Pour une
  // SASU à l'IS, is_solde/liasse_fiscale/cfe sont toutes impot+annuelle et
  // collisionnent. C'est une limite PRÉ-EXISTANTE du moteur (le micro-catalogue
  // avait déjà irpp_2042_c_pro + cfe sur la même clé, jamais testé jusqu'ici) —
  // pas introduite par ce module, mais élargie par l'ajout des obligations
  // société. Non corrigée ici (module additif, "ne réécris pas le moteur") —
  // à traiter en dédiée : élargir la clé d'unicité pour inclure le `type`
  // d'obligation (nécessite une colonne sur `echeances`, hors scope catalogue).
  it("LIMITE CONNUE : plusieurs types d'obligations société partageant categorie+périodicité collisionnent sur la même clé de dédup", () => {
    const candidates = computeAutoEcheances(
      { company_id: "company-1", forme_juridique_categorie: "sasu", regime_tva: "reel_normal", regime_fiscal: "is" },
      new Date(2026, 6, 22),
    );
    const impotAnnuelleCandidates = candidates.filter(e => e.categorie === "impot" && e.recurrence === "annuelle");
    // is_solde, liasse_fiscale, cfe sont bien 3 obligations distinctes...
    expect(impotAnnuelleCandidates.length).toBeGreaterThanOrEqual(3);
    // ...mais elles partagent toutes la même clé (company_id, categorie, date_echeance)
    const uniqueKeys = new Set(impotAnnuelleCandidates.map(e => `${e.company_id}|${e.categorie}|${e.date_echeance}`));
    expect(uniqueKeys.size).toBe(1);
  });
});
