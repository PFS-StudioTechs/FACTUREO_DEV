
-- Add email and telephone columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telephone text NOT NULL DEFAULT '';

-- Update handle_new_user to capture email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, pseudo, email, telephone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'pseudo', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'telephone', '')
  );
  RETURN NEW;
END;
$$;

-- Allow admins to view all profiles (needed for user management screen)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
