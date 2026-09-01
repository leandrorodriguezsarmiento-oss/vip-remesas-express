ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS paid_at timestamptz;

UPDATE public.transactions SET paid_at = COALESCE(paid_at, created_at) WHERE status <> 'pending';

-- El admin ya no debe recibir avisos al crearse la remesa (aún sin pagar).
DROP TRIGGER IF EXISTS trg_notify_admin_new_tx ON public.transactions;

CREATE OR REPLACE FUNCTION public.notify_admin_tx_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_id uuid;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2x4d3RyaXRjc3JnbHdpbWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzY1NjgsImV4cCI6MjA5OTExMjU2OH0._rVbxQ9JDgB5FFMVxaGgSKFTi-ozyzrlOvsEgHvJ-3o';
  v_url text := 'https://tudominio.com/api/public/push/dispatch';
BEGIN
  IF OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL THEN
    FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, title, body)
      VALUES (r.user_id, 'Remesa pagada #' || NEW.order_no,
        'Pago recibido · ' || NEW.recipient_name || ' · ' || NEW.amount_brl || ' ' || NEW.origin_currency || '.')
      RETURNING id INTO v_id;
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
        body := jsonb_build_object('notification_id', v_id));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_admin_tx_paid() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_admin_tx_paid ON public.transactions;
CREATE TRIGGER trg_notify_admin_tx_paid
AFTER UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_tx_paid();