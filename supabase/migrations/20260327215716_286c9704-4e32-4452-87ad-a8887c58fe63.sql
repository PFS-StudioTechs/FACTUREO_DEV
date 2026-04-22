-- Create storage bucket for expense scans
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-scans', 'expense-scans', true);

-- Storage policies
CREATE POLICY "Users can upload expense scans" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'expense-scans' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view their expense scans" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'expense-scans' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Public read expense scans" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'expense-scans');

-- Create expense_scans table
CREATE TABLE public.expense_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'à envoyer',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own expense scans" ON public.expense_scans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own expense scans" ON public.expense_scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own expense scans" ON public.expense_scans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own expense scans" ON public.expense_scans FOR DELETE TO authenticated USING (auth.uid() = user_id);