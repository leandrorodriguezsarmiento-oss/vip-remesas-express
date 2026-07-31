CREATE TABLE public.mercadopago_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tracking_id text NOT NULL,
  preference_id text,
  checkout_url text,
  mp_payment_id text,
  mp_status text,
  internal_status text NOT NULL DEFAULT 'created',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_mp_payments_tracking ON public.mercadopago_payments (tracking_id);
CREATE INDEX idx_mp_payments_created ON public.mercadopago_payments (created_at DESC);

GRANT SELECT ON public.mercadopago_payments TO authenticated;
GRANT ALL ON public.mercadopago_payments TO service_role;

ALTER TABLE public.mercadopago_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all mp payments" ON public.mercadopago_payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own mp payments" ON public.mercadopago_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_mp_payments_updated_at
  BEFORE UPDATE ON public.mercadopago_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();