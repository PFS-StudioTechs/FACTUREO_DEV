-- Onboarding flow: profile completion, KBIS gate, auto-role, SIRET check

-- Add onboarding fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nom TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prenom TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kbis_url TEXT,
  ADD COLUMN IF NOT EXISTS kbis_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kbis_deadline TIMESTAMPTZ;

-- Update handle_new_user to store nom/prenom from metadata and set kbis_deadline
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, pseudo, nom, prenom, kbis_deadline)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'pseudo', ''),
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    now() + interval '6 months'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Auto-assign 'user' role on signup (self-service access, no admin approval needed)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Prioritize admin role in get_user_role (admins who also have user role get 'admin' back)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END
  LIMIT 1
$$;

-- Backfill: assign 'user' role to existing users without any role
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'user'::app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Backfill: mark existing users as profile_completed (they pre-date the onboarding flow)
UPDATE public.profiles
SET profile_completed = TRUE
WHERE profile_completed = FALSE;

-- RPC: check if SIRET is not already registered in companies
CREATE OR REPLACE FUNCTION public.check_siret_available(p_siret TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.companies WHERE siret = p_siret AND siret != ''
  )
$$;

-- Storage bucket for KBIS and user documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artisan-documents',
  'artisan-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- RLS policies for artisan-documents bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Users can upload their own documents'
  ) THEN
    CREATE POLICY "Users can upload their own documents" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'artisan-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Users can read their own documents'
  ) THEN
    CREATE POLICY "Users can read their own documents" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'artisan-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Users can delete their own documents'
  ) THEN
    CREATE POLICY "Users can delete their own documents" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'artisan-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;
