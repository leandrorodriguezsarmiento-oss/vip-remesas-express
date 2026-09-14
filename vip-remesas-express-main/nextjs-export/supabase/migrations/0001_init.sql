
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'es',
  balance_brl NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Recipients (frequent contacts)
CREATE TABLE public.recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  account_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipients TO authenticated;
GRANT ALL ON public.recipients TO service_role;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recipients" ON public.recipients FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transactions
CREATE TYPE public.tx_status AS ENUM ('pending','processing','completed','rejected');

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracking_id TEXT NOT NULL UNIQUE,
  destination_country TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  amount_brl NUMERIC(12,2) NOT NULL,
  amount_dest NUMERIC(14,2) NOT NULL,
  dest_currency TEXT NOT NULL,
  exchange_rate NUMERIC(14,6) NOT NULL,
  fee_brl NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_brl NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
-- NOTE: No INSERT policy for clients. Transactions are created ONLY via the
-- server route /api/transactions (service_role) which recomputes amount, rate
-- and fee from public.rates. Prevents tx_amount_trust tampering.

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, '')
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
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
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;create table public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  code text not null,
  type text not null default 'email',
  expires_at timestamptz not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.verification_codes to authenticated;
grant all on public.verification_codes to service_role;

alter table public.verification_codes enable row level security;

create policy "Users can read own verification codes"
on public.verification_codes
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own verification codes"
on public.verification_codes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own verification codes"
on public.verification_codes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
-- 1) Auto-grant admin role to the fixed owner email (only after verification)
CREATE OR REPLACE FUNCTION public.grant_owner_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'leandrorodriguezsarmiento@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_owner ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_owner
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin_role();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_owner ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_owner
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_owner_admin_role();

-- Backfill if user already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE lower(email) = 'leandrorodriguezsarmiento@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Recargas API config (single row managed by admin)
CREATE TABLE public.recargas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'mock',
  api_base_url text,
  api_key_name text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recargas_config TO authenticated;
GRANT ALL ON public.recargas_config TO service_role;
ALTER TABLE public.recargas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage recargas config" ON public.recargas_config
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.recargas_config (provider, notes) VALUES ('mock', 'Slot inicial. Edita provider y api_base_url cuando elijas proveedor.');

-- 3) In-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  tx_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins insert notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Trigger: when a transaction status changes to 'completed', insert notification
CREATE OR REPLACE FUNCTION public.notify_tx_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO public.notifications (user_id, title, body, tx_id)
    VALUES (
      NEW.user_id,
      '¡Remesa completada!',
      'Tu remesa ' || NEW.tracking_id || ' para ' || NEW.recipient_name || ' fue entregada.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tx_completed ON public.transactions;
CREATE TRIGGER trg_notify_tx_completed
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_tx_completed();

REVOKE EXECUTE ON FUNCTION public.grant_owner_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_tx_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 1. Banners table
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text,
  link_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banners"
  ON public.banners FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage banners"
  ON public.banners FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Restrict admin role strictly to leandro
CREATE OR REPLACE FUNCTION public.enforce_single_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_email text;
BEGIN
  IF NEW.role = 'admin' THEN
    SELECT lower(email) INTO target_email FROM auth.users WHERE id = NEW.user_id;
    IF target_email IS DISTINCT FROM 'leandrorodriguezsarmiento@gmail.com' THEN
      RAISE EXCEPTION 'Only the owner account can be admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_admin ON public.user_roles;
CREATE TRIGGER trg_enforce_single_admin
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_admin();

-- Clean any stray admin rows
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id NOT IN (
    SELECT id FROM auth.users WHERE lower(email) = 'leandrorodriguezsarmiento@gmail.com'
  );

-- 3. updated_at trigger for banners
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_banners_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE POLICY "Public read banners"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'banners');

CREATE POLICY "Admins upload banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete banners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'banners' AND public.has_role(auth.uid(), 'admin'));

-- ============ RECARGAS REQUESTS ============
CREATE TYPE public.recarga_status AS ENUM ('pending','processing','completed','rejected');

CREATE TABLE public.recargas_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  promo_id UUID REFERENCES public.promos(id) ON DELETE SET NULL,
  promo_title TEXT NOT NULL,
  price_brl NUMERIC(12,2) NOT NULL,
  status public.recarga_status NOT NULL DEFAULT 'pending',
  provider_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.recargas_requests TO authenticated;
GRANT ALL ON public.recargas_requests TO service_role;

ALTER TABLE public.recargas_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own recargas read" ON public.recargas_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- NOTE: No INSERT policy for clients. Recharge requests are created ONLY via
-- the server route /api/recargas (service_role) which validates promo price
-- server-side. Prevents price tampering.

CREATE POLICY "admin update recargas" ON public.recargas_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER touch_recargas_requests
  BEFORE UPDATE ON public.recargas_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PAYMENT METHODS (US / EU / BR alternos) ============
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_country TEXT NOT NULL,          -- 'US' | 'EU' | 'BR'
  label TEXT NOT NULL,                    -- 'Zelle' | 'IBAN SEPA' | 'PIX'
  instructions TEXT NOT NULL,             -- multilínea: banco, titular, email/número/IBAN...
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_methods TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read active payment methods" ON public.payment_methods
  FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "admin manages payment methods" ON public.payment_methods
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER touch_payment_methods
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed inicial: PIX BR (el que dio el usuario) + placeholders US/EU
INSERT INTO public.payment_methods (origin_country, label, instructions, sort_order) VALUES
('BR','PIX (Brasil)', E'Titular: ARANCH99\nTeléfono PIX: +55 95 98100 6775\nCiudad: São Paulo\n\nEl monto se genera automáticamente en el paso de pago.', 1),
('US','Zelle', E'Titular: (editar en panel admin)\nEmail Zelle: (editar)\nBanco: (editar)\n\nUsa como concepto tu código de seguimiento (VIP-XXXX).', 1),
('US','Wire / ACH', E'Beneficiario: (editar)\nBanco: (editar)\nRouting: (editar)\nCuenta: (editar)', 2),
('EU','SEPA IBAN', E'Titular: (editar)\nIBAN: (editar)\nBIC/SWIFT: (editar)\nConcepto: tu código de seguimiento.', 1);

REVOKE EXECUTE ON FUNCTION public.notify_tx_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_owner_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_single_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
