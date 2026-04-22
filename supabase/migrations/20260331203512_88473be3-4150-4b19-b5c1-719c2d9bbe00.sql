
CREATE OR REPLACE FUNCTION public.archive_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can archive users';
  END IF;
  UPDATE public.profiles SET archived = true WHERE user_id = _user_id;
END;
$$;
