
-- Table for forecast missions
CREATE TABLE public.forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission_name text NOT NULL DEFAULT '',
  tjm numeric NOT NULL DEFAULT 0,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own forecasts" ON public.forecasts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own forecasts" ON public.forecasts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own forecasts" ON public.forecasts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own forecasts" ON public.forecasts FOR DELETE USING (auth.uid() = user_id);

-- Table for monthly forecast data
CREATE TABLE public.forecast_months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES public.forecasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  planned_days numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(forecast_id, month)
);

ALTER TABLE public.forecast_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own forecast_months" ON public.forecast_months FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own forecast_months" ON public.forecast_months FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own forecast_months" ON public.forecast_months FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own forecast_months" ON public.forecast_months FOR DELETE USING (auth.uid() = user_id);
