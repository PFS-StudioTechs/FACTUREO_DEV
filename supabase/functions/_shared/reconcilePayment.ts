// Pure : décide statut_paiement + montant_paye à partir du montant reçu
// (Stripe) vs le montant total de la facture. Aucun I/O.
//
// Copie volontaire de src/lib/payments/reconcilePayment.ts (testée côté
// Vitest) : les Edge Functions Deno ne peuvent référencer que des fichiers
// sous supabase/functions/ (bundle isolé au déploiement), donc pas d'import
// cross vers src/.

export interface ReconcileResult {
  statut_paiement: "paye" | "partiel";
  montant_paye: number;
}

export function reconcilePayment(montantTtc: number, montantRecu: number): ReconcileResult {
  const montant_paye = Math.round(montantRecu * 100) / 100;
  const statut_paiement = montant_paye >= montantTtc ? "paye" : "partiel";
  return { statut_paiement, montant_paye };
}
