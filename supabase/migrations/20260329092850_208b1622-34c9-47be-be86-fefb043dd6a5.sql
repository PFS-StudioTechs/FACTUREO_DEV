-- Make the expense-scans bucket private
UPDATE storage.buckets SET public = false WHERE id = 'expense-scans';

-- Drop existing public policies on the bucket
DROP POLICY IF EXISTS "Users can upload expense scans" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their expense scans" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for expense scans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload expense scans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read their expense scans" ON storage.objects;

-- Create proper RLS policies for authenticated access only
CREATE POLICY "Auth users can upload expense scans"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'expense-scans' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users can read own expense scans"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'expense-scans' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users can delete own expense scans"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'expense-scans' AND (storage.foldername(name))[1] = auth.uid()::text);