-- Suivi des paiements — complète les colonnes déjà posées par
-- 20260601180000_btob_btoc_payment.sql (statut_paiement, paid_at,
-- reminder_level, last_reminder_at, payment_reminders existent déjà).
-- Ici : montant_paye (absent), + élargissement du CHECK statut_paiement
-- pour couvrir 'partiel' et 'en_retard' sans casser 'en_cours'/'annule'
-- déjà utilisés par create-payment-link / le reste du code.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS montant_paye numeric(10, 2) NULL;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_statut_paiement_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_statut_paiement_check
  CHECK (statut_paiement IN ('impaye', 'en_cours', 'partiel', 'paye', 'en_retard', 'annule'));

-- date_limite_paiement (déjà NOT NULL DEFAULT CURRENT_DATE depuis la
-- création de la table) fait déjà office de date d'échéance — pas de
-- nouvelle colonne "date_echeance" pour ne pas dupliquer.
