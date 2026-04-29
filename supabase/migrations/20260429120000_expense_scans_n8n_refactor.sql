-- Refactor expense_scans for n8n workflow
-- New columns: image_url (raw photo), pdf_url (n8n-generated PDF),
--              amount, merchant, category, expense_date, notes
-- New statuses: "traitement" | "à revoir" | "transmis"

ALTER TABLE public.expense_scans
  ADD COLUMN image_url  text,
  ADD COLUMN pdf_url    text,
  ADD COLUMN amount     numeric(10, 2),
  ADD COLUMN merchant   text,
  ADD COLUMN category   text,
  ADD COLUMN expense_date date,
  ADD COLUMN notes      text;

-- Migrate existing records: file_url was the PDF in the old flow
UPDATE public.expense_scans
SET pdf_url = file_url
WHERE pdf_url IS NULL AND file_url <> '';

-- Allow service_role (n8n) to update any expense_scan row
CREATE POLICY "Service role can update expense scans"
  ON public.expense_scans
  FOR UPDATE
  TO service_role
  USING (true);
