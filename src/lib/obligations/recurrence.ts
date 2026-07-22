import type { Categorie, Recurrence, NewEcheance } from "./generateEcheances";

// N'utilise jamais toISOString() ici : elle convertit en UTC et peut décaler
// la date locale d'un jour. On formate directement les composants locaux.
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface ClosedEcheance {
  company_id: string;
  titre: string;
  categorie: Categorie;
  date_echeance: string; // YYYY-MM-DD
  recurrence: Recurrence;
  source: "manuelle" | "auto";
}

function addPeriod(date: Date, recurrence: Recurrence): Date {
  const d = new Date(date);
  if (recurrence === "mensuelle") { d.setMonth(d.getMonth() + 1); return d; }
  if (recurrence === "trimestrielle") { d.setMonth(d.getMonth() + 3); return d; }
  if (recurrence === "annuelle") { d.setFullYear(d.getFullYear() + 1); return d; }
  return d; // "aucune" — ne devrait pas être appelé (voir regenerateNextOccurrence)
}

/**
 * Pure : quand une échéance récurrente passe à "fait", calcule la suivante.
 * Retourne null si `recurrence === "aucune"` (rien à régénérer).
 */
export function regenerateNextOccurrence(closed: ClosedEcheance): NewEcheance | null {
  if (closed.recurrence === "aucune") return null;

  const [year, month, day] = closed.date_echeance.split("-").map(Number);
  const nextDate = addPeriod(new Date(year, month - 1, day), closed.recurrence);

  return {
    company_id: closed.company_id,
    titre: closed.titre,
    categorie: closed.categorie,
    date_echeance: toIsoDate(nextDate),
    statut: "a_faire",
    recurrence: closed.recurrence,
    source: closed.source,
    montant: null,
  };
}
