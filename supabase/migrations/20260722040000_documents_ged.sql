-- Coffre documentaire (GED) : index unifié pointant vers le Storage existant.
-- Aucune duplication de fichier : documents.storage_path référence un objet
-- déjà présent dans un bucket existant (invoices, expense-scans, artisan-documents).

CREATE TABLE public.documents (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id             UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  type                   TEXT NOT NULL CHECK (type IN ('facture', 'facturx', 'justificatif', 'contrat', 'autre')),
  titre                  TEXT NOT NULL,
  storage_bucket         TEXT NOT NULL,
  storage_path           TEXT NOT NULL,
  related_type           TEXT,
  related_id             UUID,
  date_document          DATE NOT NULL,
  date_conservation_min  DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own documents" ON public.documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON public.documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON public.documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX documents_user_id_idx ON public.documents (user_id);
CREATE INDEX documents_company_id_idx ON public.documents (company_id);
CREATE INDEX documents_type_idx ON public.documents (type);
CREATE INDEX documents_date_document_idx ON public.documents (date_document);
-- Empêche une double indexation du même objet Storage
CREATE UNIQUE INDEX documents_storage_uniq_idx ON public.documents (storage_bucket, storage_path);

-- ============================================================
-- Backfill unique : indexe les documents déjà présents ailleurs
-- ============================================================

-- 1. Notes de frais déjà scannées (bucket expense-scans, image_url = chemin brut)
INSERT INTO public.documents (user_id, type, titre, storage_bucket, storage_path, related_type, related_id, date_document)
SELECT
  es.user_id,
  'justificatif',
  COALESCE(NULLIF(es.merchant, ''), 'Note de frais') || ' (' || to_char(es.created_at, 'DD/MM/YYYY') || ')',
  'expense-scans',
  es.image_url,
  'expense_scan',
  es.id,
  COALESCE(es.expense_date, es.created_at::date)
FROM public.expense_scans es
WHERE es.image_url IS NOT NULL AND es.image_url <> ''
ON CONFLICT (storage_bucket, storage_path) DO NOTHING;

-- 2. Kbis déjà uploadés (bucket artisan-documents, kbis_url = URL publique historique
--    -> on en extrait le chemin relatif au bucket pour ne stocker qu'une référence Storage)
INSERT INTO public.documents (user_id, type, titre, storage_bucket, storage_path, related_type, related_id, date_document)
SELECT
  p.user_id,
  'autre',
  'Extrait Kbis',
  'artisan-documents',
  regexp_replace(p.kbis_url, '^.*artisan-documents/', ''),
  'profile',
  p.user_id,
  COALESCE(p.kbis_uploaded_at::date, p.created_at::date)
FROM public.profiles p
WHERE p.kbis_url IS NOT NULL AND p.kbis_url <> ''
ON CONFLICT (storage_bucket, storage_path) DO NOTHING;
