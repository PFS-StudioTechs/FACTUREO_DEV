import { getObligationsProfile, type CompanyFiscalProfile } from "./getObligationsProfile";
import type { Periodicite } from "./catalogue";

export type Categorie = "tva" | "urssaf" | "impot" | "facture" | "contrat" | "autre";
export type Recurrence = "aucune" | "mensuelle" | "trimestrielle" | "annuelle";

export interface NewEcheance {
  company_id: string;
  titre: string;
  categorie: Categorie;
  date_echeance: string; // YYYY-MM-DD
  statut: "a_faire";
  recurrence: Recurrence;
  source: "manuelle" | "auto";
  montant: null;
}

export interface ExistingEcheanceKey {
  company_id: string;
  categorie: string;
  date_echeance: string;
  source: string;
}

// NB : dates placeholder — alignement calendaire simple (début de la
// prochaine période), pas un calendrier fiscal officiel vérifié. À affiner
// obligation par obligation (ex: CFE = 15 décembre) quand ces dates réelles
// seront confirmées.
const CATEGORIE_BY_TYPE: Record<string, Categorie> = {
  urssaf_ca_micro: "urssaf",
  irpp_2042_c_pro: "impot",
  tva_suivi_seuil_franchise: "tva",
  tva_ca3: "tva",
  tva_ca12: "tva",
  cfe: "impot",
};

function nextPeriodStart(from: Date, periodicite: Periodicite): Date {
  const year = from.getFullYear();
  const month = from.getMonth();
  if (periodicite === "mensuelle") return new Date(year, month + 1, 1);
  if (periodicite === "trimestrielle") {
    const quarter = Math.floor(month / 3);
    return new Date(year, (quarter + 1) * 3, 1);
  }
  return new Date(year + 1, 0, 1); // annuelle
}

// N'utilise jamais toISOString() ici : elle convertit en UTC et peut décaler
// la date locale d'un jour. On formate directement les composants locaux.
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Pure : dérive les échéances candidates depuis le profil fiscal. Aucun I/O. */
export function computeAutoEcheances(
  company: CompanyFiscalProfile & { company_id: string },
  today: Date,
): NewEcheance[] {
  const obligations = getObligationsProfile(company);
  return obligations.map(o => ({
    company_id: company.company_id,
    titre: o.label,
    categorie: CATEGORIE_BY_TYPE[o.type] ?? "autre",
    date_echeance: toIsoDate(nextPeriodStart(today, o.periodicite)),
    statut: "a_faire",
    recurrence: o.periodicite,
    source: "auto",
    montant: null,
  }));
}

/** Pure : retire les candidats qui existent déjà (même clé company/catégorie/date, source auto). */
export function dedupeAgainstExisting(
  candidates: NewEcheance[],
  existing: ExistingEcheanceKey[],
): NewEcheance[] {
  const existingKeys = new Set(
    existing
      .filter(e => e.source === "auto")
      .map(e => `${e.company_id}|${e.categorie}|${e.date_echeance}`),
  );
  return candidates.filter(c => !existingKeys.has(`${c.company_id}|${c.categorie}|${c.date_echeance}`));
}
