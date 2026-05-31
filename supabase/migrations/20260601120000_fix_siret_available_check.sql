-- Fix check_siret_available: ignore orphan company records from incomplete signups
CREATE OR REPLACE FUNCTION public.check_siret_available(p_siret TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.user_id = c.user_id
    WHERE c.siret = p_siret
      AND p_siret != ''
      AND p.profile_completed = TRUE
  )
$$;
