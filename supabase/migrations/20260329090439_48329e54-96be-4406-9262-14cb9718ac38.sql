
-- 1. Fix privilege escalation: add trigger to prevent self-assigning admin role
CREATE OR REPLACE FUNCTION public.prevent_self_admin_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins can assign admin roles
  IF NEW.role = 'admin' AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign the admin role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_self_admin_assignment_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_admin_assignment();

-- 2. Re-scope ALL policies on all 8 tables from public to authenticated

-- companies
DROP POLICY IF EXISTS "Users can delete their own companies" ON companies;
DROP POLICY IF EXISTS "Users can insert their own companies" ON companies;
DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
DROP POLICY IF EXISTS "Users can view their own companies" ON companies;
CREATE POLICY "Users can delete their own companies" ON companies FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own companies" ON companies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own companies" ON companies FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own companies" ON companies FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- clients
DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
CREATE POLICY "Users can delete their own clients" ON clients FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own clients" ON clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clients" ON clients FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own clients" ON clients FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- invoices
DROP POLICY IF EXISTS "Users can delete their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
CREATE POLICY "Users can delete their own invoices" ON invoices FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoices" ON invoices FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own invoices" ON invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- forecasts
DROP POLICY IF EXISTS "Users can delete their own forecasts" ON forecasts;
DROP POLICY IF EXISTS "Users can insert their own forecasts" ON forecasts;
DROP POLICY IF EXISTS "Users can update their own forecasts" ON forecasts;
DROP POLICY IF EXISTS "Users can view their own forecasts" ON forecasts;
CREATE POLICY "Users can delete their own forecasts" ON forecasts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own forecasts" ON forecasts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own forecasts" ON forecasts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own forecasts" ON forecasts FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- forecast_months
DROP POLICY IF EXISTS "Users can delete their own forecast_months" ON forecast_months;
DROP POLICY IF EXISTS "Users can insert their own forecast_months" ON forecast_months;
DROP POLICY IF EXISTS "Users can update their own forecast_months" ON forecast_months;
DROP POLICY IF EXISTS "Users can view their own forecast_months" ON forecast_months;
CREATE POLICY "Users can delete their own forecast_months" ON forecast_months FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own forecast_months" ON forecast_months FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own forecast_months" ON forecast_months FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own forecast_months" ON forecast_months FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- invoice_settings (also add missing DELETE policy)
DROP POLICY IF EXISTS "Users can insert their own invoice settings" ON invoice_settings;
DROP POLICY IF EXISTS "Users can update their own invoice settings" ON invoice_settings;
DROP POLICY IF EXISTS "Users can view their own invoice settings" ON invoice_settings;
CREATE POLICY "Users can insert their own invoice settings" ON invoice_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoice settings" ON invoice_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own invoice settings" ON invoice_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own invoice settings" ON invoice_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
CREATE POLICY "Admins can delete roles" ON user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert roles" ON user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update roles" ON user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all roles" ON user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = user_id));
