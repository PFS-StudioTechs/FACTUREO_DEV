
-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table (pseudo only)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, pseudo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'pseudo', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Companies table (multi-entreprise)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  denomination TEXT NOT NULL DEFAULT '',
  forme_juridique TEXT NOT NULL DEFAULT '',
  capital TEXT NOT NULL DEFAULT '',
  adresse TEXT NOT NULL DEFAULT '',
  code_postal TEXT NOT NULL DEFAULT '',
  ville TEXT NOT NULL DEFAULT '',
  telephone TEXT NOT NULL DEFAULT '',
  mail TEXT NOT NULL DEFAULT '',
  siret TEXT NOT NULL DEFAULT '',
  rcs_rm_ville TEXT NOT NULL DEFAULT '',
  code_naf TEXT NOT NULL DEFAULT '',
  tva_intracommunautaire TEXT NOT NULL DEFAULT '',
  banque_titulaire TEXT NOT NULL DEFAULT '',
  banque_nom TEXT NOT NULL DEFAULT '',
  banque_adresse TEXT NOT NULL DEFAULT '',
  bic_swift TEXT NOT NULL DEFAULT '',
  code_iban TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own companies" ON public.companies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own companies" ON public.companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own companies" ON public.companies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own companies" ON public.companies FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL DEFAULT '',
  adresse TEXT NOT NULL DEFAULT '',
  ville TEXT NOT NULL DEFAULT '',
  code_postal TEXT NOT NULL DEFAULT '',
  numero_bon_commande TEXT NOT NULL DEFAULT '',
  tjm NUMERIC(10,2) NOT NULL DEFAULT 0,
  descriptif_mission TEXT NOT NULL DEFAULT '',
  conditions_paiement INTEGER NOT NULL DEFAULT 30,
  mode_paiement TEXT NOT NULL DEFAULT 'VIREMENT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clients" ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clients" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clients" ON public.clients FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice settings table (naming format)
CREATE TABLE public.invoice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT '',
  numero_format TEXT NOT NULL DEFAULT '001',
  next_number INTEGER NOT NULL DEFAULT 1,
  suffix_date_format TEXT NOT NULL DEFAULT '',
  separator TEXT NOT NULL DEFAULT '-',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoice settings" ON public.invoice_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own invoice settings" ON public.invoice_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoice settings" ON public.invoice_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_invoice_settings_updated_at BEFORE UPDATE ON public.invoice_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_facture TEXT NOT NULL DEFAULT '',
  date_facturation DATE NOT NULL DEFAULT CURRENT_DATE,
  date_limite_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  designation TEXT NOT NULL DEFAULT '',
  nombre_jours NUMERIC(5,2) NOT NULL DEFAULT 0,
  tjm NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  taux_tva NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  montant_tva NUMERIC(12,2) NOT NULL DEFAULT 0,
  montant_ttc NUMERIC(12,2) NOT NULL DEFAULT 0,
  conditions_paiement INTEGER NOT NULL DEFAULT 30,
  mode_paiement TEXT NOT NULL DEFAULT 'VIREMENT',
  descriptif_mission TEXT NOT NULL DEFAULT '',
  numero_bon_commande TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own invoices" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoices" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own invoices" ON public.invoices FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
