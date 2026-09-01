-- 1) Trigger de remesas (la función ya existe pero no estaba conectada)
DROP TRIGGER IF EXISTS trg_notify_tx_status_change ON public.transactions;
CREATE TRIGGER trg_notify_tx_status_change
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_tx_status_change();

-- 2) Avisos para pagos de Mercado Pago
CREATE OR REPLACE FUNCTION public.notify_mp_payment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title text;
  v_body text;
  v_notification_id uuid;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2x4d3RyaXRjc3JnbHdpbWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzY1NjgsImV4cCI6MjA5OTExMjU2OH0._rVbxQ9JDgB5FFMVxaGgSKFTi-ozyzrlOvsEgHvJ-3o';
  v_dispatch_url text := 'https://tudominio.com/api/public/push/dispatch';
BEGIN
  IF COALESCE(NEW.mp_status,'') IS DISTINCT FROM COALESCE(OLD.mp_status,'')
     OR NEW.internal_status IS DISTINCT FROM OLD.internal_status THEN

    IF NEW.mp_status IN ('approved','authorized') THEN
      v_title := 'Pago aprobado';
      v_body := 'Recibimos tu pago de la remesa ' || NEW.tracking_id || '. Ya está en proceso.';
    ELSIF NEW.mp_status IN ('pending','in_process') THEN
      v_title := 'Pago pendiente';
      v_body := 'Tu pago de la remesa ' || NEW.tracking_id || ' está siendo verificado.';
    ELSIF NEW.mp_status IN ('rejected','cancelled') THEN
      v_title := 'Pago rechazado';
      v_body := 'El pago de la remesa ' || NEW.tracking_id || ' fue rechazado. Intenta de nuevo.';
    ELSIF NEW.mp_status IN ('refunded','charged_back') THEN
      v_title := 'Pago devuelto';
      v_body := 'El pago de la remesa ' || NEW.tracking_id || ' fue devuelto.';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, body, tx_id)
    VALUES (NEW.user_id, v_title, v_body, NEW.transaction_id)
    RETURNING id INTO v_notification_id;

    PERFORM net.http_post(
      url := v_dispatch_url,
      headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
      body := jsonb_build_object('notification_id', v_notification_id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_mp_payment_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_mp_payment_status_change ON public.mercadopago_payments;
CREATE TRIGGER trg_notify_mp_payment_status_change
AFTER UPDATE ON public.mercadopago_payments
FOR EACH ROW
EXECUTE FUNCTION public.notify_mp_payment_status_change();