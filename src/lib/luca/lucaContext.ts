import { rankSignals, type Signal, type Severite } from "@/lib/assistant/signals";

const SEVERITE_ORDER: Record<Severite, number> = { critique: 0, attention: 1, info: 2 };
const MAX_SIGNAUX_CLES = 3;

export interface SignalCle {
  categorie: string;
  severite: Severite;
  count: number;
  actionLabel: string;
  actionRoute: string;
}

export interface LucaGreetingContext {
  userName: string;
  toutAuVert: boolean;
  signauxCles: SignalCle[];
  nbTotal: number;
}

/**
 * Pure : agrège les signaux du moteur Assistant (déjà en main, non recodé ici) en un
 * résumé factuel structuré, sans aucune phrase — l'IA (ou le repli déterministe)
 * se charge de la formulation à partir de ces faits.
 */
export function buildLucaContext(signals: Signal[], userName: string): LucaGreetingContext {
  const ranked = rankSignals(signals);
  if (ranked.length === 0) {
    return { userName, toutAuVert: true, signauxCles: [], nbTotal: 0 };
  }

  const groups = new Map<string, SignalCle>();
  for (const s of ranked) {
    const existing = groups.get(s.categorie);
    if (existing) {
      existing.count += 1;
      // `ranked` est déjà trié par sévérité : le premier signal vu pour cette
      // catégorie porte la sévérité/action la plus prioritaire, on ne la remplace pas.
    } else {
      groups.set(s.categorie, {
        categorie: s.categorie, severite: s.severite, count: 1,
        actionLabel: s.actionLabel, actionRoute: s.actionRoute,
      });
    }
  }

  const signauxCles = Array.from(groups.values())
    .sort((a, b) => SEVERITE_ORDER[a.severite] - SEVERITE_ORDER[b.severite])
    .slice(0, MAX_SIGNAUX_CLES);

  return { userName, toutAuVert: false, signauxCles, nbTotal: ranked.length };
}

export interface ActionChip {
  label: string;
  route: string;
  state?: Record<string, unknown>;
}

/** Pure : dérive les puces d'action (lien profond uniquement, aucune exécution) depuis les signaux clés. */
export function getActionChips(context: LucaGreetingContext): ActionChip[] {
  return context.signauxCles.map(s => ({ label: s.actionLabel, route: s.actionRoute }));
}
