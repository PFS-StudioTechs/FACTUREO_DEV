import type { ActionChip } from "./lucaContext";

/**
 * Pas d'IA ici volontairement : le tout premier message d'un compte neuf doit
 * être fiable à 100%, pas soumis à la variabilité d'un appel LLM.
 */
export function buildOnboardingMessage(userName: string): string {
  return `Bienvenue sur Facturéo, ${userName} ! Je suis Luca, ton copilote. Par quoi tu veux commencer ?`;
}

export const ONBOARDING_CHIPS: ActionChip[] = [
  { label: "Créer mon premier client", route: "/clients", state: { lucaOnboarding: true } },
  { label: "Créer ma première facture", route: "/factures", state: { lucaPrefill: {} } },
  { label: "Paramétrer mes factures", route: "/parametrage", state: { lucaOnboarding: true } },
];
