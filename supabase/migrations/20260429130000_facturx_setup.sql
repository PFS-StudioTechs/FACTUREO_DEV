-- ============================================================
-- Factur-X BASIC setup
-- 1. Champs manquants sur clients et companies (EN 16931)
-- 2. Colonnes facturx sur invoices
-- 3. Storage bucket invoices
-- ============================================================

-- 1a. clients : ajout siret, tva_intracommunautaire, email, pays
ALTER TABLE public.clients
  ADD COLUMN siret                  TEXT NOT NULL DEFAULT '',
  ADD COLUMN tva_intracommunautaire TEXT NOT NULL DEFAULT '',
  ADD COLUMN email                  TEXT NOT NULL DEFAULT '',
  ADD COLUMN pays                   TEXT NOT NULL DEFAULT 'FR';

-- 1b. companies : ajout pays (code ISO-3166-1 alpha-2)
ALTER TABLE public.companies
  ADD COLUMN pays TEXT NOT NULL DEFAULT 'FR';

-- 2. invoices : statut, URL PDF Factur-X, date d'envoi
ALTER TABLE public.invoices
  ADD COLUMN status       TEXT        NOT NULL DEFAULT 'brouillon',
  ADD COLUMN facturx_url  TEXT,
  ADD COLUMN sent_at      TIMESTAMPTZ;

-- Index pour filtrer rapidement par statut
CREATE INDEX invoices_status_idx ON public.invoices (status);

-- Policy service_role pour que n8n puisse mettre à jour les invoices
CREATE POLICY "Service role can update invoices"
  ON public.invoices
  FOR UPDATE
  TO service_role
  USING (true);

-- 3. Storage bucket pour les PDF Factur-X
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false);

-- Seul le propriétaire peut uploader/lire ses factures
CREATE POLICY "Users can upload their invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- n8n (service_role) peut uploader et lire sans restriction
CREATE POLICY "Service role full access invoices storage"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'invoices')
  WITH CHECK (bucket_id = 'invoices');
