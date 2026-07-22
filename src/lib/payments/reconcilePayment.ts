// Pure : décide statut_paiement + montant_paye à partir du montant reçu
// (Stripe) vs le montant total de la facture. Aucun I/O.

export interface ReconcileResult {
  statut_paiement: "paye" | "partiel";
  montant_paye: number;
}

export function reconcilePayment(montantTtc: number, montantRecu: number): ReconcileResult {
  const montant_paye = Math.round(montantRecu * 100) / 100;
  const statut_paiement = montant_paye >= montantTtc ? "paye" : "partiel";
  return { statut_paiement, montant_paye };
}
