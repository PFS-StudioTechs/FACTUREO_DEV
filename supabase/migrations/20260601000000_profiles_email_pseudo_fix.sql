-- Add email column to profiles and fix handle_new_user for wizard signup

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';

-- Update trigger: store email, and use prenom+nom as pseudo fallback
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, pseudo, nom, prenom, email, kbis_deadline)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'pseudo', ''),
      TRIM(
        COALESCE(NEW.raw_user_meta_data->>'prenom', '') || ' ' ||
        COALESCE(NEW.raw_user_meta_data->>'nom', '')
      )
    ),
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    COALESCE(NEW.email, ''),
    now() + interval '6 months'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill email for existing profiles from auth.users
UPDATE public.profiles p
SET email = COALESCE(u.email, '')
FROM auth.users u
WHERE p.user_id = u.id
  AND p.email = '';
