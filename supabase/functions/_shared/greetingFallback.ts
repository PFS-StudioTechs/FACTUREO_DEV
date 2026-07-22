// Duplique src/lib/luca/greetingFallback.ts + lucaContext.ts (types) : le bundler
// Supabase Edge Functions ne packagent que le dossier de la fonction + _shared/,
// jamais src/ (cf. supabase/functions/_shared/reconcilePayment.ts pour le même motif).

export interface SignalCle {
  categorie: string;
  severite: "critique" | "attention" | "info";
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

const CATEGORIE_LABELS: Record<string, { one: string; many: (n: number) => string }> = {
  echeance:        { one: "une échéance à surveiller",       many: n => `${n} échéances à surveiller` },
  paiement:        { one: "une facture en attente",          many: n => `${n} factures en attente` },
  relance:         { one: "une relance à préparer",          many: n => `${n} relances à préparer` },
  notes_de_frais:  { one: "une note de frais à corriger",    many: n => `${n} notes de frais à corriger` },
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
