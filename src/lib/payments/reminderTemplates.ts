// Gabarits déterministes de relance — pas d'IA externe (on évite la
// dépendance fragile ai.gateway.lovable.dev signalée dans l'audit).
// Substitution de variables simple, testable sans réseau.

export type ReminderLevel = "courtois" | "ferme" | "mise_en_demeure";

export interface ReminderVariables {
  clientNom: string;
  numeroFacture: string;
  montantTtc: number;
  dateEcheance: string; // déjà formatée pour affichage (ex: "15/07/2026")
}

export interface ReminderDraft {
  level: ReminderLevel;
  subject: string;
  body: string;
}

const TEMPLATES: Record<ReminderLevel, (v: ReminderVariables) => ReminderDraft> = {
  courtois: (v) => ({
    level: "courtois",
    subject: `Rappel — Facture ${v.numeroFacture}`,
    body: `Bonjour ${v.clientNom},\n\n` +
      `Sauf erreur de notre part, la facture ${v.numeroFacture} d'un montant de ${v.montantTtc.toFixed(2)} € ` +
      `(échéance au ${v.dateEcheance}) ne semble pas encore réglée.\n\n` +
      `Pourriez-vous nous confirmer son état de traitement ? N'hésitez pas à nous contacter en cas de besoin.\n\n` +
      `Cordialement`,
  }),
  ferme: (v) => ({
    level: "ferme",
    subject: `Relance — Facture ${v.numeroFacture} en retard de paiement`,
    body: `Bonjour ${v.clientNom},\n\n` +
      `Malgré notre précédent rappel, la facture ${v.numeroFacture} d'un montant de ${v.montantTtc.toFixed(2)} € ` +
      `reste impayée à ce jour (échéance dépassée depuis le ${v.dateEcheance}).\n\n` +
      `Nous vous demandons de bien vouloir régulariser cette situation dans les meilleurs délais.\n\n` +
      `Cordialement`,
  }),
  mise_en_demeure: (v) => ({
    level: "mise_en_demeure",
    subject: `Mise en demeure — Facture ${v.numeroFacture}`,
    body: `Madame, Monsieur,\n\n` +
      `Malgré nos relances précédentes, la facture ${v.numeroFacture} d'un montant de ${v.montantTtc.toFixed(2)} € ` +
      `demeure impayée (échéance au ${v.dateEcheance}).\n\n` +
      `Par la présente, nous vous mettons en demeure de procéder au règlement intégral de cette somme ` +
      `sous 8 jours à compter de la réception de ce courrier, faute de quoi nous nous réservons le droit ` +
      `d'engager toute action, y compris contentieuse, pour le recouvrement de cette créance.\n\n` +
      `Cordialement`,
  }),
};

/** Pure : génère un brouillon de relance. Aucun appel réseau/IA. */
export function generateReminderDraft(level: ReminderLevel, variables: ReminderVariables): ReminderDraft {
  return TEMPLATES[level](variables);
}

export const REMINDER_LEVELS: { value: ReminderLevel; label: string }[] = [
  { value: "courtois", label: "Rappel courtois" },
  { value: "ferme", label: "Relance ferme" },
  { value: "mise_en_demeure", label: "Mise en demeure" },
];
