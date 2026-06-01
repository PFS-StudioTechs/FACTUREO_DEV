-- Phase 0: BtoB/BtoC distinction + payment fields

-- 1. clients: add type_client and email
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS type_client text NOT NULL DEFAULT 'b2b'
    CONSTRAINT clients_type_client_check CHECK (type_client IN ('b2b', 'b2c')),
  ADD COLUMN IF NOT EXISTS email text NULL;

-- 2. invoices: add payment and reminder fields
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reminder_level int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS stripe_payment_link text NULL,
  ADD COLUMN IF NOT EXISTS stripe_session_id text NULL,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS statut_paiement text NOT NULL DEFAULT 'impaye'
    CONSTRAINT invoices_statut_paiement_check CHECK (statut_paiement IN ('impaye', 'en_cours', 'paye', 'annule'));

-- 3. payment_reminders: audit table
CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  level int NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  sent_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL
);

ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment_reminders" ON public.payment_reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment_reminders" ON public.payment_reminders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment_reminders" ON public.payment_reminders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
