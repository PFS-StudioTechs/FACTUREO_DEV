// Gabarit déterministe pour l'envoi d'une facture brouillon — même logique que
// reminderTemplates.ts : pas d'IA externe, substitution de variables simple et testable.

export interface InvoiceSendVariables {
  clientNom: string;
  numeroFacture: string;
  montantTtc: number;
  dateLimitePaiement: string; // déjà formatée pour affichage (ex: "15/07/2026")
}

/** Pure : génère le corps de l'email d'envoi d'une facture. Aucun appel réseau/IA. */
export function buildInvoiceSendEmail(v: InvoiceSendVariables): string {
  return `Bonjour ${v.clientNom},\n\n` +
    `Veuillez trouver ci-joint la facture ${v.numeroFacture} d'un montant de ${v.montantTtc.toFixed(2)} € TTC, ` +
    `à régler avant le ${v.dateLimitePaiement}.\n\n` +
    `N'hésitez pas à me contacter pour toute question.\n\n` +
    `Cordialement`;
}
