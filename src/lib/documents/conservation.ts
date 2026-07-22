export type DocumentType = "facture" | "facturx" | "justificatif" | "contrat" | "autre";

export interface DocumentInsertPayload {
  user_id: string;
  company_id: string | null;
  type: DocumentType;
  titre: string;
  storage_bucket: string;
  storage_path: string;
  related_type: string | null;
  related_id: string | null;
  date_document: string;
  date_conservation_min: string | null;
}

// Repères indicatifs non certifiés — l'app assiste, elle ne délivre pas de conseil juridique.
// Durée légale réelle à vérifier avec un expert-comptable / avocat selon la situation.
export const DUREE_CONSERVATION_ANS: Record<DocumentType, number | null> = {
  facture: 10,
  facturx: 10,
  justificatif: 10,
  contrat: 5,
  autre: null,
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calcule la date de conservation minimale indicative à partir de la date du document.
 * `overrideYears` permet de surcharger la durée par défaut du type.
 * Retourne null si aucune durée n'est connue pour ce type et qu'aucune surcharge n'est fournie.
 */
export function computeDateConservationMin(
  dateDocument: string,
  type: DocumentType,
  overrideYears?: number
): string | null {
  const years = overrideYears ?? DUREE_CONSERVATION_ANS[type];
  if (years == null) return null;

  const [y, m, d] = dateDocument.split("-").map(Number);
  const base = new Date(y, (m ?? 1) - 1, d ?? 1);
  base.setFullYear(base.getFullYear() + years);
  return toIsoDate(base);
}
