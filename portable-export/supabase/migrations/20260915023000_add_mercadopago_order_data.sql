-- Datos de la Order API de Mercado Pago para pagos PIX.
ALTER TABLE public.mercadopago_payments
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS qr_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_payments_order_id
  ON public.mercadopago_payments (order_id)
  WHERE order_id IS NOT NULL;
