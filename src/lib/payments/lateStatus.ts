// Pure : détection de retard de paiement. Même pattern que urgency.ts
// (getUrgencyLevel) côté échéancier — jamais toISOString() (décale la
// date locale en UTC), on compare des composants Y/M/D locaux.

const UNPAID_STATUSES = new Set(["impaye", "en_cours", "partiel", "en_retard"]);

export function isUnpaid(statutPaiement: string): boolean {
  return UNPAID_STATUSES.has(statutPaiement);
}

/** Une facture non soldée dont la date limite est dépassée est en retard. */
export function isLate(dateLimitePaiement: string, statutPaiement: string, today: Date): boolean {
  if (!isUnpaid(statutPaiement)) return false;
  const [y, m, d] = dateLimitePaiement.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return due.getTime() < ref.getTime();
}

/** Dérive le statut_paiement effectif à afficher (recalcule 'en_retard' sans écrire en base). */
export function effectiveStatutPaiement(dateLimitePaiement: string, statutPaiement: string, today: Date): string {
  if (isLate(dateLimitePaiement, statutPaiement, today)) return "en_retard";
  return statutPaiement;
}
