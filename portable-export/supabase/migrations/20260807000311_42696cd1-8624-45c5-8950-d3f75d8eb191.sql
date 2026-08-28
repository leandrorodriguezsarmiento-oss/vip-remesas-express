CREATE OR REPLACE FUNCTION public.notify_tx_status_change()
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
  v_dispatch_url text := 'https://project--f318d839-9858-4e78-a02b-1da8134720f0.lovable.app/api/public/push/dispatch';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'processing' THEN
      v_title := 'Remesa en proceso';
      v_body := 'Tu remesa para ' || NEW.recipient_name || ' está siendo procesada.';
    ELSIF NEW.status = 'completed' THEN
      v_title := '¡Remesa completada!';
      v_body := 'Tu remesa para ' || NEW.recipient_name || ' fue entregada.';
    ELSIF NEW.status IN ('rejected','cancelled') THEN
      v_title := 'Remesa rechazada';
      v_body := 'Tu remesa para ' || NEW.recipient_name || ' fue rechazada o cancelada. Contáctanos para más información.';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, body, tx_id)
    VALUES (NEW.user_id, v_title, v_body, NEW.id)
    RETURNING id INTO v_notification_id;

    PERFORM net.http_post(
      url := v_dispatch_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_anon_key),
      body := jsonb_build_object('notification_id', v_notification_id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_tx_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO public.notifications (user_id, title, body, tx_id)
    VALUES (NEW.user_id, '¡Remesa completada!',
      'Tu remesa para ' || NEW.recipient_name || ' fue entregada.', NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

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
  v_dispatch_url text := 'https://project--f318d839-9858-4e78-a02b-1da8134720f0.lovable.app/api/public/push/dispatch';
BEGIN
  IF COALESCE(NEW.mp_status,'') IS DISTINCT FROM COALESCE(OLD.mp_status,'')
     OR NEW.internal_status IS DISTINCT FROM OLD.internal_status THEN

    IF NEW.mp_status IN ('approved','authorized') THEN
      v_title := 'Pago aprobado';
      v_body := 'Recibimos tu pago. Tu remesa ya está en proceso.';
    ELSIF NEW.mp_status IN ('pending','in_process') THEN
      v_title := 'Pago pendiente';
      v_body := 'Tu pago está siendo verificado.';
    ELSIF NEW.mp_status IN ('rejected','cancelled') THEN
      v_title := 'Pago rechazado';
      v_body := 'Tu pago fue rechazado. Intenta de nuevo.';
    ELSIF NEW.mp_status IN ('refunded','charged_back') THEN
      v_title := 'Pago devuelto';
      v_body := 'Tu pago fue devuelto.';
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

REVOKE ALL ON FUNCTION public.notify_tx_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_tx_completed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_mp_payment_status_change() FROM PUBLIC, anon, authenticated;