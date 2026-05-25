-- French TVA intracommunautaire: FR + 2-digit key + SIREN
-- key = (12 + 3 × (SIREN % 97)) % 97

CREATE OR REPLACE FUNCTION compute_tva_intracom(siret text)
RETURNS text AS $$
DECLARE
  siren text;
  siren_num bigint;
  key_val int;
BEGIN
  siren := regexp_replace(coalesce(siret, ''), '\s', '', 'g');
  siren := left(siren, 9);
  IF length(siren) <> 9 OR siren !~ '^\d+$' THEN
    RETURN NULL;
  END IF;
  siren_num := siren::bigint;
  key_val := (12 + 3 * (siren_num % 97)) % 97;
  RETURN 'FR' || lpad(key_val::text, 2, '0') || siren;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION trigger_set_tva_intracom()
RETURNS trigger AS $$
BEGIN
  IF NEW.siret IS NOT NULL AND NEW.siret != '' THEN
    NEW.tva_intracommunautaire := compute_tva_intracom(NEW.siret);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS companies_auto_tva ON companies;

CREATE TRIGGER companies_auto_tva
  BEFORE INSERT OR UPDATE OF siret ON companies
  FOR EACH ROW EXECUTE FUNCTION trigger_set_tva_intracom();

-- Backfill existing companies
UPDATE companies
SET tva_intracommunautaire = compute_tva_intracom(siret)
WHERE siret IS NOT NULL AND siret != '';
