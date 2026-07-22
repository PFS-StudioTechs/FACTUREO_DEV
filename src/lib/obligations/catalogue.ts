// Catalogue déclaratif des obligations administratives françaises.
// Pure donnée — aucune logique ici. Ajouter une obligation "société" plus
// tard = ajouter une entrée (ou élargir un `appliesTo`), jamais réécrire
// getObligationsProfile.

export type FormeJuridiqueCategorie = "micro" | "ei" | "eurl" | "sasu" | "sarl" | "autre";
export type RegimeTva = "franchise" | "reel_simplifie" | "reel_normal";
export type RegimeFiscal = "micro" | "ir" | "is";
export type Periodicite = "mensuelle" | "trimestrielle" | "annuelle";

export interface ObligationRule {
  type: string;
  label: string;
  periodicite: Periodicite;
  /** Chaque axe listé restreint la règle ; un axe absent = pas de restriction sur cet axe. */
  appliesTo: {
    formeJuridiqueCategorie?: FormeJuridiqueCategorie[];
    regimeTva?: RegimeTva[];
    regimeFiscal?: RegimeFiscal[];
  };
}

export const OBLIGATIONS_CATALOGUE: ObligationRule[] = [
  // --- Micro-entreprise ---
  {
    type: "urssaf_ca_micro",
    label: "Déclaration de chiffre d'affaires URSSAF",
    periodicite: "mensuelle",
    appliesTo: { formeJuridiqueCategorie: ["micro"] },
  },
  {
    type: "irpp_2042_c_pro",
    label: "Déclaration complémentaire de revenus (2042 C PRO)",
    periodicite: "annuelle",
    appliesTo: { formeJuridiqueCategorie: ["micro"], regimeFiscal: ["micro"] },
  },

  // --- TVA (orthogonal à la forme juridique) ---
  {
    type: "tva_suivi_seuil_franchise",
    label: "Suivi du seuil de franchise en base de TVA",
    periodicite: "annuelle",
    appliesTo: { regimeTva: ["franchise"] },
  },
  {
    type: "tva_ca3",
    label: "Déclaration de TVA (CA3)",
    periodicite: "mensuelle",
    appliesTo: { regimeTva: ["reel_normal"] },
  },
  {
    type: "tva_ca12",
    label: "Déclaration de TVA (CA12 — régime réel simplifié)",
    periodicite: "annuelle",
    appliesTo: { regimeTva: ["reel_simplifie"] },
  },

  // --- Commune à toutes les formes ---
  {
    type: "cfe",
    label: "Cotisation Foncière des Entreprises (CFE)",
    periodicite: "annuelle",
    appliesTo: {},
  },
];
