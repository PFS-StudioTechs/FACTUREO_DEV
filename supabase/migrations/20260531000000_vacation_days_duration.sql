
-- Add duration support to vacation_days (1.0 = full day, 0.5 = half day)
ALTER TABLE public.vacation_days
  ADD COLUMN IF NOT EXISTS duration NUMERIC(3,1) NOT NULL DEFAULT 1.0;
