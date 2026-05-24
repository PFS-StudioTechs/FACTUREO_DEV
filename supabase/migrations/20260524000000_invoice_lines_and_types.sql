
-- Add type, type_piece, facture_source_id to invoices
ALTER TABLE public.invoices
  ADD COLUMN type TEXT NOT NULL DEFAULT 'vente',
  ADD COLUMN type_piece TEXT NOT NULL DEFAULT 'facture',
  ADD COLUMN facture_source_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.invoices ADD CONSTRAINT invoices_type_check
  CHECK (type IN ('vente', 'achat'));
ALTER TABLE public.invoices ADD CONSTRAINT invoices_type_piece_check
  CHECK (type_piece IN ('facture', 'avoir'));

-- Make nombre_jours and tjm nullable (backward compat — old invoices keep data, new ones use lines)
ALTER TABLE public.invoices ALTER COLUMN nombre_jours DROP NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN nombre_jours SET DEFAULT NULL;
ALTER TABLE public.invoices ALTER COLUMN tjm DROP NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN tjm SET DEFAULT NULL;

-- invoice_lines table
CREATE TABLE public.invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  designation TEXT NOT NULL DEFAULT '',
  quantite NUMERIC(10,3) NOT NULL DEFAULT 1,
  unite TEXT NOT NULL DEFAULT 'Unité',
  prix_unitaire_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  remise NUMERIC(5,2) NOT NULL DEFAULT 0,
  taux_tva NUMERIC(5,2) NOT NULL DEFAULT 20,
  motif_exoneration TEXT NOT NULL DEFAULT '',
  montant_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  montant_tva NUMERIC(12,2) NOT NULL DEFAULT 0,
  montant_ttc NUMERIC(12,2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoice lines" ON public.invoice_lines
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own invoice lines" ON public.invoice_lines
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoice lines" ON public.invoice_lines
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own invoice lines" ON public.invoice_lines
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_invoice_lines_updated_at
  BEFORE UPDATE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
