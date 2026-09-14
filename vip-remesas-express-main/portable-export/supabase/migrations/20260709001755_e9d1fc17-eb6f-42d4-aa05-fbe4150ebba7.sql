-- Roles system
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Rates table (per corridor + method + currency)
CREATE TABLE public.rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_country text NOT NULL,          -- 'BR' | 'EU' | 'US'
  origin_currency text NOT NULL,         -- 'BRL' | 'EUR' | 'USD'
  method_category text NOT NULL,         -- 'transferencia' | 'efectivo'
  dest_currency text NOT NULL,           -- 'CUP' | 'MLC' | 'USD'
  rate numeric NOT NULL,                 -- units of dest per 1 origin
  time_min_minutes int NOT NULL DEFAULT 15,
  time_max_minutes int NOT NULL DEFAULT 30,
  min_amount numeric NOT NULL DEFAULT 20,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (origin_country, method_category, dest_currency)
);
GRANT SELECT ON public.rates TO authenticated, anon;
GRANT ALL ON public.rates TO service_role;
ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active rates" ON public.rates FOR SELECT USING (true);
CREATE POLICY "Admins manage rates" ON public.rates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Promos (Cubacel recharges/offers)
CREATE TABLE public.promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  price_brl numeric NOT NULL,
  bonus_label text,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promos TO authenticated, anon;
GRANT ALL ON public.promos TO service_role;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads promos" ON public.promos FOR SELECT USING (true);
CREATE POLICY "Admins manage promos" ON public.promos FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Extend transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS origin_country text NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS origin_currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS method_category text NOT NULL DEFAULT 'transferencia',
  ADD COLUMN IF NOT EXISTS recipient_card text,
  ADD COLUMN IF NOT EXISTS pix_code text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Admin visibility + update on transactions
CREATE POLICY "Admins view all transactions" ON public.transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update transactions" ON public.transactions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin visibility on profiles (KYC list)
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-assign 'user' role on signup, extend existing handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed rates (BR/EU/US -> CU, transferencia CUP/MLC/USD, efectivo CUP/USD)
INSERT INTO public.rates (origin_country, origin_currency, method_category, dest_currency, rate, time_min_minutes, time_max_minutes, min_amount) VALUES
  ('BR','BRL','transferencia','CUP',   140,  15, 30, 20),
  ('BR','BRL','transferencia','MLC',    0.90,15, 30, 20),
  ('BR','BRL','transferencia','USD',    0.18,15, 60, 20),
  ('BR','BRL','efectivo',     'CUP',   135,  30, 120,20),
  ('BR','BRL','efectivo',     'USD',    0.17,60, 240,20),
  ('EU','EUR','transferencia','CUP',   380,  15, 30, 20),
  ('EU','EUR','transferencia','MLC',    0.95,15, 30, 20),
  ('EU','EUR','transferencia','USD',    1.02,15, 60, 20),
  ('EU','EUR','efectivo',     'CUP',   370,  30, 120,20),
  ('EU','EUR','efectivo',     'USD',    0.99,60, 240,20),
  ('US','USD','transferencia','CUP',   340,  15, 30, 20),
  ('US','USD','transferencia','MLC',    0.92,15, 30, 20),
  ('US','USD','transferencia','USD',    0.98,15, 60, 20),
  ('US','USD','efectivo',     'CUP',   330,  30, 120,20),
  ('US','USD','efectivo',     'USD',    0.95,60, 240,20)
ON CONFLICT (origin_country, method_category, dest_currency) DO NOTHING;

-- Seed a few promos for Recargas UI
INSERT INTO public.promos (title, description, price_brl, bonus_label) VALUES
  ('Cubacel 500 CUP + Bono', 'Recarga sencilla con bono vigente', 45, '+ 500 CUP bono'),
  ('Cubacel 1250 CUP + Datos', 'Recarga con paquete de datos', 95, '+ 2 GB datos'),
  ('Cubacel Combo Familiar', 'Recarga doble con SMS ilimitados', 180, '2x recargas + SMS')
ON CONFLICT DO NOTHING;
