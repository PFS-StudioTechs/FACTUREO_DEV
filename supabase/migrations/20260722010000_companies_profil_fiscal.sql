-- Socle "profil fiscal" — évolutif micro-entreprise -> société.
--
-- forme_juridique existe déjà sur companies (TEXT libre, raison sociale
-- affichée ex. "SASU"). On ne la touche pas : nouvelle colonne dédiée à la
-- catégorie fiscale/juridique structurée, utilisée par getObligationsProfile.
--
-- Convention text + CHECK (pas de CREATE TYPE ENUM) pour rester cohérent
-- avec les migrations récentes (type_client, statut_paiement) : ajouter une
-- valeur plus tard = modifier un CHECK, pas gérer une transaction ALTER TYPE.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS forme_juridique_categorie text NOT NULL DEFAULT 'micro'
    CONSTRAINT companies_forme_juridique_categorie_check
    CHECK (forme_juridique_categorie IN ('micro', 'ei', 'eurl', 'sasu', 'sarl', 'autre')),
  ADD COLUMN IF NOT EXISTS regime_tva text NOT NULL DEFAULT 'franchise'
    CONSTRAINT companies_regime_tva_check
    CHECK (regime_tva IN ('franchise', 'reel_simplifie', 'reel_normal')),
  ADD COLUMN IF NOT EXISTS regime_fiscal text NOT NULL DEFAULT 'micro'
    CONSTRAINT companies_regime_fiscal_check
    CHECK (regime_fiscal IN ('micro', 'ir', 'is'));

-- Défauts choisis pour ne rien casser : la base d'utilisateurs actuelle
-- (freelances/TPE, cf. PROJET_NOTES.md) est très majoritairement en
-- micro-entreprise + franchise en base de TVA (déjà le seul régime géré
-- par le sélecteur de taux 0% + motif d'exonération sur les factures).
