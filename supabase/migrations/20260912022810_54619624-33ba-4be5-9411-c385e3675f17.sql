ALTER TYPE public.tx_status ADD VALUE IF NOT EXISTS 'pending_payment';
ALTER TYPE public.tx_status ADD VALUE IF NOT EXISTS 'payment_reported';
ALTER TYPE public.tx_status ADD VALUE IF NOT EXISTS 'payment_confirmed';

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS payment_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_rejection_reason text;

CREATE TABLE IF NOT EXISTS public.transaction_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  actor_id uuid,
  action text NOT NULL,
  from_status text,
  to_status text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transaction_audit_log TO authenticated;
GRANT ALL ON public.transaction_audit_log TO service_role;
ALTER TABLE public.transaction_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view transaction audit"
  ON public.transaction_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS transaction_audit_log_transaction_idx
  ON public.transaction_audit_log(transaction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_payment_queue_idx
  ON public.transactions(status, payment_reported_at, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS mercadopago_payments_payment_id_uidx
  ON public.mercadopago_payments(mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mercadopago_payments_preference_id_uidx
  ON public.mercadopago_payments(preference_id)
  WHERE preference_id IS NOT NULL;

REVOKE UPDATE, DELETE ON public.transactions FROM authenticated;
GRANT SELECT, INSERT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

DROP POLICY IF EXISTS "Admins update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Organizadores actualizan remesas" ON public.transactions;

REVOKE INSERT, UPDATE, DELETE ON public.transaction_audit_log FROM authenticated;

CREATE OR REPLACE FUNCTION public.guard_transaction_financial_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.tracking_id IS DISTINCT FROM OLD.tracking_id
    OR NEW.origin_country IS DISTINCT FROM OLD.origin_country
    OR NEW.origin_currency IS DISTINCT FROM OLD.origin_currency
    OR NEW.destination_country IS DISTINCT FROM OLD.destination_country
    OR NEW.method_category IS DISTINCT FROM OLD.method_category
    OR NEW.delivery_method IS DISTINCT FROM OLD.delivery_method
    OR NEW.recipient_name IS DISTINCT FROM OLD.recipient_name
    OR NEW.recipient_phone IS DISTINCT FROM OLD.recipient_phone
    OR NEW.recipient_card IS DISTINCT FROM OLD.recipient_card
    OR NEW.amount_brl IS DISTINCT FROM OLD.amount_brl
    OR NEW.amount_dest IS DISTINCT FROM OLD.amount_dest
    OR NEW.dest_currency IS DISTINCT FROM OLD.dest_currency
    OR NEW.exchange_rate IS DISTINCT FROM OLD.exchange_rate
    OR NEW.fee_brl IS DISTINCT FROM OLD.fee_brl
    OR NEW.total_brl IS DISTINCT FROM OLD.total_brl
    OR NEW.pix_code IS DISTINCT FROM OLD.pix_code
  THEN
    RAISE EXCEPTION 'Los datos financieros y del destinatario son inmutables';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_transaction_financial_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_transaction_financial_fields() TO service_role;

DROP TRIGGER IF EXISTS guard_transaction_financial_fields_trigger ON public.transactions;
CREATE TRIGGER guard_transaction_financial_fields_trigger
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_transaction_financial_fields();