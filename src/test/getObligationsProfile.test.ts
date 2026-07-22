import { describe, it, expect } from "vitest";
import { getObligationsProfile } from "@/lib/obligations/getObligationsProfile";

describe("getObligationsProfile", () => {
  it("micro-entreprise en franchise de TVA : URSSAF + 2042 C PRO + suivi seuil + CFE, jamais de CA3/CA12", () => {
    const result = getObligationsProfile({ forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro" });
    const types = result.map(o => o.type);

    expect(types).toContain("urssaf_ca_micro");
    expect(types).toContain("irpp_2042_c_pro");
    expect(types).toContain("tva_suivi_seuil_franchise");
    expect(types).toContain("cfe");
    expect(types).not.toContain("tva_ca3");
    expect(types).not.toContain("tva_ca12");
  });

  it("micro-entreprise passée au réel simplifié : CA12 au lieu du suivi de franchise, toujours pas de CA3", () => {
    const result = getObligationsProfile({ forme_juridique_categorie: "micro", regime_tva: "reel_simplifie", regime_fiscal: "micro" });
    const types = result.map(o => o.type);

    expect(types).toContain("tva_ca12");
    expect(types).not.toContain("tva_suivi_seuil_franchise");
    expect(types).not.toContain("tva_ca3");
  });

  it("société (SASU) au régime réel normal : CA3 mensuelle + CFE, jamais les obligations micro", () => {
    const result = getObligationsProfile({ forme_juridique_categorie: "sasu", regime_tva: "reel_normal", regime_fiscal: "is" });
    const types = result.map(o => o.type);

    expect(types).toContain("tva_ca3");
    expect(types).toContain("cfe");
    expect(types).not.toContain("urssaf_ca_micro");
    expect(types).not.toContain("irpp_2042_c_pro");
    expect(types).not.toContain("tva_suivi_seuil_franchise");
  });

  it("CFE toujours présente quelle que soit la forme juridique", () => {
    const formes = ["micro", "ei", "eurl", "sasu", "sarl", "autre"] as const;
    for (const forme of formes) {
      const result = getObligationsProfile({ forme_juridique_categorie: forme, regime_tva: "franchise", regime_fiscal: "micro" });
      expect(result.map(o => o.type)).toContain("cfe");
    }
  });

  it("chaque obligation retournée a un type, un label et une périodicité", () => {
    const result = getObligationsProfile({ forme_juridique_categorie: "micro", regime_tva: "franchise", regime_fiscal: "micro" });
    for (const o of result) {
      expect(o.type).toBeTruthy();
      expect(o.label).toBeTruthy();
      expect(["mensuelle", "trimestrielle", "annuelle"]).toContain(o.periodicite);
    }
  });
});
