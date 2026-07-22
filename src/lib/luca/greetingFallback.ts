import type { LucaGreetingContext, SignalCle } from "./lucaContext";

const CATEGORIE_LABELS: Record<string, { one: string; many: (n: number) => string }> = {
  echeance:        { one: "une échéance à surveiller",       many: n => `${n} échéances à surveiller` },
  paiement:        { one: "une facture en attente",          many: n => `${n} factures en attente` },
  relance:         { one: "une relance à préparer",          many: n => `${n} relances à préparer` },
  notes_de_frais:  { one: "une note de frais à corriger",    many: n => `${n} notes de frais à corriger` },
  brouillon:       { one: "une facture en brouillon à finaliser", many: n => `${n} factures en brouillon à finaliser` },
};

function describeSignal(s: SignalCle): string {
  const known = CATEGORIE_LABELS[s.categorie];
  if (known) return s.count > 1 ? known.many(s.count) : known.one;
  return s.count > 1 ? `${s.count} points à vérifier (${s.categorie})` : `un point à vérifier (${s.categorie})`;
}

function joinFr(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

/**
 * Repli déterministe : jamais d'IA ici, juste un gabarit assemblé depuis le même
 * résumé factuel — toujours disponible si l'appel IA échoue.
 */
export function buildFallbackGreeting(context: LucaGreetingContext): string {
  if (context.toutAuVert) {
    return `Salut ${context.userName}, tout est au vert de mon côté — je me la coule douce ! Tu as besoin de moi ?`;
  }

  const descriptions = context.signauxCles.map(describeSignal);
  const list = joinFr(descriptions);
  const shown = context.signauxCles.reduce((sum, s) => sum + s.count, 0);
  const extra = context.nbTotal > shown ? " (et quelques autres broutilles)" : "";
  const top = context.signauxCles[0];

  return `Salut ${context.userName} ! J'ai repéré ${list}${extra}. On commence par « ${top.actionLabel} » ?`;
}
