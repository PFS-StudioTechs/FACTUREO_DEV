import { getUrgencyLevel } from "@/lib/obligations/urgency";
import { isUnpaid, isLate, effectiveStatutPaiement } from "@/lib/payments/lateStatus";
import { computeAutoEcheances, dedupeAgainstExisting, type NewEcheance, type ExistingEcheanceKey } from "@/lib/obligations/generateEcheances";
import type { CompanyFiscalProfile } from "@/lib/obligations/getObligationsProfile";

export type Severite = "critique" | "attention" | "info";

export interface Signal {
  id: string;
  severite: Severite;
  categorie: string;
  titre: string;
  description: string;
  actionLabel: string;
  actionRoute: string;
  date?: string;
}

const SEVERITE_ORDER: Record<Severite, number> = { critique: 0, attention: 1, info: 2 };

const UNVERIFIED_SUFFIX = " (à confirmer)";

/** Nombre de jours (calendaires locaux) entre `today` et `dateStr` (positif = dans le futur). */
function diffDaysFromToday(dateStr: string, today: Date): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - ref.getTime()) / 86400000);
}

/** Trie par sévérité (critique > attention > info) puis par date croissante (sans date = en dernier). */
export function rankSignals(signals: Signal[]): Signal[] {
  return [...signals].sort((a, b) => {
    const sevDiff = SEVERITE_ORDER[a.severite] - SEVERITE_ORDER[b.severite];
    if (sevDiff !== 0) return sevDiff;
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });
}

// ─── Règle 1 + 5 : échéances administratives ───

export interface EcheanceLite {
  id: string;
  company_id: string;
  titre: string;
  categorie: string;
  date_echeance: string;
  statut: string;
}

/**
 * Échéance vérifiée <7j → critique. Échéance non vérifiée (marqueur "(à confirmer)"
 * posé par generateEcheances.ts) qui approche (<30j) → info, distincte et moins alarmante
 * car la date est un repère calendaire, pas un calendrier fiscal officiel confirmé.
 */
export function signalsFromEcheances(echeances: EcheanceLite[], today: Date): Signal[] {
  const signals: Signal[] = [];
  for (const e of echeances) {
    if (e.statut === "fait") continue;
    const unverified = e.titre.endsWith(UNVERIFIED_SUFFIX);
    const urgency = getUrgencyLevel(e.date_echeance, e.statut, today);

    if (!unverified && urgency === "rouge") {
      signals.push({
        id: `echeance-critique-${e.id}`,
        severite: "critique",
        categorie: "echeance",
        titre: `Échéance proche : ${e.titre}`,
        description: `À traiter avant le ${e.date_echeance}.`,
        actionLabel: "Voir l'échéancier",
        actionRoute: "/echeancier",
        date: e.date_echeance,
      });
    } else if (unverified && (urgency === "rouge" || urgency === "orange")) {
      signals.push({
        id: `echeance-non-verifiee-${e.id}`,
        severite: "info",
        categorie: "echeance",
        titre: `Obligation à confirmer : ${e.titre.replace(UNVERIFIED_SUFFIX, "")}`,
        description: `Date indicative non vérifiée, à confirmer avant le ${e.date_echeance}.`,
        actionLabel: "Voir l'échéancier",
        actionRoute: "/echeancier",
        date: e.date_echeance,
      });
    }
  }
  return signals;
}

// ─── Règle 2 + 3 : factures ───

export interface InvoiceLite {
  id: string;
  numero_facture: string;
  statut_paiement: string;
  date_limite_paiement: string;
  reminder_level: number;
  last_reminder_at: string | null;
}

const RELANCE_MIN_INTERVAL_DAYS = 7;

export function signalsFromInvoices(invoices: InvoiceLite[], today: Date): Signal[] {
  const signals: Signal[] = [];
  for (const inv of invoices) {
    const effStatut = effectiveStatutPaiement(inv.date_limite_paiement, inv.statut_paiement, today);

    if (effStatut === "en_retard") {
      signals.push({
        id: `facture-retard-${inv.id}`,
        severite: "critique",
        categorie: "paiement",
        titre: `Facture en retard : ${inv.numero_facture}`,
        description: `Échéance dépassée le ${inv.date_limite_paiement}.`,
        actionLabel: "Voir la facture",
        actionRoute: "/factures",
        date: inv.date_limite_paiement,
      });

      const lastReminderDate = inv.last_reminder_at ? inv.last_reminder_at.slice(0, 10) : null;
      const daysSinceReminder = lastReminderDate ? -diffDaysFromToday(lastReminderDate, today) : null;
      const canRelance = inv.reminder_level === 0 || lastReminderDate === null || (daysSinceReminder ?? Infinity) >= RELANCE_MIN_INTERVAL_DAYS;

      if (canRelance) {
        signals.push({
          id: `facture-relance-${inv.id}`,
          severite: "attention",
          categorie: "relance",
          titre: `Relance possible : ${inv.numero_facture}`,
          description: "Facture en retard sans relance récente.",
          actionLabel: "Préparer une relance",
          actionRoute: "/relances",
          date: inv.date_limite_paiement,
        });
      }
    } else if (isUnpaid(inv.statut_paiement) && !isLate(inv.date_limite_paiement, inv.statut_paiement, today)) {
      const daysLeft = diffDaysFromToday(inv.date_limite_paiement, today);
      if (daysLeft >= 0 && daysLeft <= 7) {
        signals.push({
          id: `facture-approche-${inv.id}`,
          severite: "attention",
          categorie: "paiement",
          titre: `Facture bientôt échue : ${inv.numero_facture}`,
          description: `Échéance le ${inv.date_limite_paiement}.`,
          actionLabel: "Voir la facture",
          actionRoute: "/factures",
          date: inv.date_limite_paiement,
        });
      }
    }
  }
  return signals;
}

export interface DraftInvoiceLite {
  id: string;
  numero_facture: string;
  status: string;
}

/** Facture restée en brouillon : jamais envoyée, jamais réglée — à finaliser. */
export function signalsFromInvoiceDrafts(invoices: DraftInvoiceLite[]): Signal[] {
  return invoices
    .filter(inv => !inv.status || inv.status === "brouillon")
    .map(inv => ({
      id: `facture-brouillon-${inv.id}`,
      severite: "attention" as const,
      categorie: "brouillon",
      titre: `Facture à finaliser : ${inv.numero_facture}`,
      description: "Cette facture est restée en brouillon, jamais envoyée.",
      actionLabel: "Finaliser et envoyer",
      actionRoute: "/factures",
    }));
}

// ─── Règle 4 : justificatifs ───

export interface ExpenseScanLite {
  id: string;
  status: string;
  image_url: string | null;
  merchant: string | null;
}

export function signalsFromExpenseScans(scans: ExpenseScanLite[]): Signal[] {
  const signals: Signal[] = [];
  for (const s of scans) {
    if (!s.image_url) {
      signals.push({
        id: `justificatif-manquant-${s.id}`,
        severite: "attention",
        categorie: "notes_de_frais",
        titre: `Justificatif manquant${s.merchant ? ` : ${s.merchant}` : ""}`,
        description: "Aucun fichier associé à cette note de frais.",
        actionLabel: "Voir les notes de frais",
        actionRoute: "/notes-de-frais",
      });
    } else if (s.status === "traitement") {
      signals.push({
        id: `scan-bloque-${s.id}`,
        severite: "attention",
        categorie: "notes_de_frais",
        titre: `Analyse bloquée${s.merchant ? ` : ${s.merchant}` : ""}`,
        description: "Ce scan est resté en statut « traitement ».",
        actionLabel: "Voir les notes de frais",
        actionRoute: "/notes-de-frais",
      });
    }
  }
  return signals;
}

// ─── Règle 6 : échéance récurrente attendue mais absente ───

export interface CompanyForSync extends CompanyFiscalProfile {
  company_id: string;
  denomination: string;
}

/**
 * Réutilise computeAutoEcheances/dedupeAgainstExisting (déjà utilisés par Echeancier.tsx
 * pour l'auto-alimentation) : si une échéance candidate n'existe pas encore côté BDD,
 * c'est soit qu'elle n'a jamais été synchronisée, soit un oubli à signaler.
 */
export function signalsFromMissingRecurrence(
  companies: CompanyForSync[],
  existingEcheances: ExistingEcheanceKey[],
  today: Date,
): Signal[] {
  const candidates: NewEcheance[] = companies.flatMap(c => computeAutoEcheances(c, today));
  const missing = dedupeAgainstExisting(candidates, existingEcheances);
  const nameByCompanyId = new Map(companies.map(c => [c.company_id, c.denomination]));

  return missing.map(m => ({
    id: `echeance-manquante-${m.company_id}-${m.categorie}-${m.date_echeance}`,
    severite: "info" as const,
    categorie: "echeance",
    titre: `Échéance non générée : ${m.titre}`,
    description: `${nameByCompanyId.get(m.company_id) ?? "Entreprise"} — aucune échéance trouvée pour cette période.`,
    actionLabel: "Voir l'échéancier",
    actionRoute: "/echeancier",
    date: m.date_echeance,
  }));
}
