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
  /**
   * false = date/périodicité dérivée d'un repère calendaire générique
   * (cf. generateEcheances.ts), PAS un calendrier fiscal officiel vérifié.
   * Vrai pour toutes les entrées actuelles — aucune n'a encore été
   * confirmée contre le calendrier fiscal réel (dates exactes URSSAF/DGFiP).
   */
  verifie: boolean;
}

export const OBLIGATIONS_CATALOGUE: ObligationRule[] = [
  // --- Micro-entreprise ---
  {
    type: "urssaf_ca_micro",
    label: "Déclaration de chiffre d'affaires URSSAF",
    periodicite: "mensuelle",
    appliesTo: { formeJuridiqueCategorie: ["micro"] },
    verifie: false,
  },
  {
    type: "irpp_2042_c_pro",
    label: "Déclaration complémentaire de revenus (2042 C PRO)",
    periodicite: "annuelle",
    appliesTo: { formeJuridiqueCategorie: ["micro"], regimeFiscal: ["micro"] },
    verifie: false,
  },

  // --- TVA (orthogonal à la forme juridique — s'applique aussi aux sociétés
  // en réel simplifié/normal, cf. eurl/sarl/sasu ci-dessous) ---
  {
    type: "tva_suivi_seuil_franchise",
    label: "Suivi du seuil de franchise en base de TVA",
    periodicite: "annuelle",
    appliesTo: { regimeTva: ["franchise"] },
    verifie: false,
  },
  {
    type: "tva_ca3",
    label: "Déclaration de TVA (CA3)",
    periodicite: "mensuelle",
    appliesTo: { regimeTva: ["reel_normal"] },
    verifie: false,
  },
  {
    type: "tva_ca12",
    label: "Déclaration de TVA (CA12 — régime réel simplifié)",
    periodicite: "annuelle",
    appliesTo: { regimeTva: ["reel_simplifie"] },
    verifie: false,
  },

  // --- Sociétés (SASU/SAS, EURL, SARL) — impôt sur les sociétés ---
  // NB : le type FormeJuridiqueCategorie n'a pas de valeur "sas" distincte
  // de "sasu" (même contrainte DB, migration profil-fiscal) — "sasu" couvre
  // ici SASU et SAS.
  {
    type: "is_acompte",
    label: "Acompte d'impôt sur les sociétés (IS)",
    periodicite: "trimestrielle",
    appliesTo: { formeJuridiqueCategorie: ["sasu", "eurl", "sarl"], regimeFiscal: ["is"] },
    verifie: false,
  },
  {
    type: "is_solde",
    label: "Solde de l'impôt sur les sociétés (IS)",
    periodicite: "annuelle",
    appliesTo: { formeJuridiqueCategorie: ["sasu", "eurl", "sarl"], regimeFiscal: ["is"] },
    verifie: false,
  },

  // --- Sociétés — liasse fiscale (indépendante du régime IR/IS retenu) ---
  {
    type: "liasse_fiscale",
    label: "Liasse fiscale (déclaration de résultats)",
    periodicite: "annuelle",
    appliesTo: { formeJuridiqueCategorie: ["sasu", "eurl", "sarl"] },
    verifie: false,
  },

  // --- Cotisations sociales du dirigeant — régime selon la forme ---
  // SASU/SAS : président assimilé salarié, cotisations via la paie (DSN).
  {
    type: "cotisations_dirigeant_dsn",
    label: "Cotisations sociales du dirigeant (DSN — assimilé salarié)",
    periodicite: "mensuelle",
    appliesTo: { formeJuridiqueCategorie: ["sasu"] },
    verifie: false,
  },
  // EURL/SARL : gérant majoritaire TNS, cotisations URSSAF/SSI. Simplification
  // documentée : on modélise le cas dominant (gérant majoritaire) — un gérant
  // minoritaire de SARL serait assimilé salarié comme un président de SASU,
  // distinction non trackée par le profil fiscal actuel (companies).
  {
    type: "cotisations_dirigeant_tns",
    label: "Cotisations sociales du dirigeant (URSSAF/SSI — gérant majoritaire TNS)",
    periodicite: "trimestrielle",
    appliesTo: { formeJuridiqueCategorie: ["eurl", "sarl"] },
    verifie: false,
  },

  // --- Commune à toutes les formes ---
  {
    type: "cfe",
    label: "Cotisation Foncière des Entreprises (CFE)",
    periodicite: "annuelle",
    appliesTo: {},
    verifie: false,
  },
];
