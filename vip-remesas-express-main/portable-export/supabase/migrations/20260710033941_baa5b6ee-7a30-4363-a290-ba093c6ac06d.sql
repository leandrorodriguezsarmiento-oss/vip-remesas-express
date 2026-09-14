
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

CREATE POLICY "own recargas insert" ON public.recargas_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

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
