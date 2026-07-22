-- Module Échéancier : échéances administratives/fiscales par entreprise.
-- Manuelles (saisies par l'utilisateur) ou auto (générées depuis
-- getObligationsProfile, cf. src/lib/obligations/).

CREATE TABLE public.echeances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  titre text NOT NULL,
  categorie text NOT NULL DEFAULT 'autre'
    CONSTRAINT echeances_categorie_check
    CHECK (categorie IN ('tva', 'urssaf', 'impot', 'facture', 'contrat', 'autre')),
  date_echeance date NOT NULL,
  statut text NOT NULL DEFAULT 'a_faire'
    CONSTRAINT echeances_statut_check
    CHECK (statut IN ('a_faire', 'fait', 'en_retard')),
  montant numeric(10, 2) NULL,
  recurrence text NOT NULL DEFAULT 'aucune'
    CONSTRAINT echeances_recurrence_check
    CHECK (recurrence IN ('aucune', 'mensuelle', 'trimestrielle', 'annuelle')),
  source text NOT NULL DEFAULT 'manuelle'
    CONSTRAINT echeances_source_check
    CHECK (source IN ('manuelle', 'auto')),
  document_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Anti-doublon pour la génération auto : une seule échéance auto par
-- entreprise/catégorie/date. N'empêche pas les échéances manuelles (source
-- = 'manuelle') d'avoir les mêmes valeurs — l'utilisateur reste libre.
CREATE UNIQUE INDEX echeances_auto_dedup_idx
  ON public.echeances (company_id, categorie, date_echeance)
  WHERE source = 'auto';

CREATE INDEX echeances_user_id_idx ON public.echeances (user_id);
CREATE INDEX echeances_company_id_idx ON public.echeances (company_id);
CREATE INDEX echeances_date_echeance_idx ON public.echeances (date_echeance);

ALTER TABLE public.echeances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own echeances" ON public.echeances
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own echeances" ON public.echeances
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own echeances" ON public.echeances
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own echeances" ON public.echeances
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_echeances_updated_at
  BEFORE UPDATE ON public.echeances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
