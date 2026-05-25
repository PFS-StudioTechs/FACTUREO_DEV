
CREATE TABLE public.vacation_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.vacation_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vacation_days" ON public.vacation_days FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own vacation_days" ON public.vacation_days FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own vacation_days" ON public.vacation_days FOR DELETE TO authenticated USING (auth.uid() = user_id);
