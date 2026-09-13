CREATE OR REPLACE FUNCTION public.notify_admin_tx_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_id uuid;
  v_sender text;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2x4d3RyaXRjc3JnbHdpbWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzY1NjgsImV4cCI6MjA5OTExMjU2OH0._rVbxQ9JDgB5FFMVxaGgSKFTi-ozyzrlOvsEgHvJ-3o';
  v_url text := coalesce(nullif(current_setting('app.settings.dispatch_url', true), ''), 'https://project--f318d839-9858-4e78-a02b-1da8134720f0.lovable.app/api/public/push/dispatch');
BEGIN
  IF OLD.payment_reported_at IS NULL AND NEW.payment_reported_at IS NOT NULL THEN
    SELECT COALESCE(NULLIF(p.username,''), NULLIF(p.full_name,''), 'usuario')
      INTO v_sender FROM public.profiles p WHERE p.id = NEW.user_id;
    FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, title, body)
      VALUES (r.user_id, 'Pago informado · remesa #' || NEW.order_no,
        'Envía: ' || COALESCE(v_sender,'usuario') || ' · ' || NEW.recipient_name || ' · ' || NEW.amount_brl || ' ' || NEW.origin_currency || '. Verifica el ingreso antes de procesar.')
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
  v_dispatch_url text := coalesce(nullif(current_setting('app.settings.dispatch_url', true), ''), 'https://project--f318d839-9858-4e78-a02b-1da8134720f0.lovable.app/api/public/push/dispatch');
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'payment_reported' THEN
      v_title := 'Pago pendiente de verificación';
      v_body := 'Recibimos tu aviso de pago para ' || NEW.recipient_name || '. Lo verificaremos antes de procesar.';
    ELSIF NEW.status = 'payment_confirmed' THEN
      v_title := 'Pago confirmado';
      v_body := 'Confirmamos tu pago para ' || NEW.recipient_name || '. Tu remesa entrará en proceso.';
    ELSIF NEW.status = 'processing' THEN
      v_title := 'Remesa en proceso';
      v_body := 'Tu remesa para ' || NEW.recipient_name || ' está siendo procesada.';
    ELSIF NEW.status = 'completed' THEN
      v_title := '¡Remesa completada!';
      v_body := 'Tu remesa para ' || NEW.recipient_name || ' fue entregada.';
    ELSIF NEW.status = 'rejected' THEN
      v_title := 'Remesa rechazada';
      v_body := COALESCE(NULLIF(NEW.payment_rejection_reason, ''), 'Tu remesa para ' || NEW.recipient_name || ' fue rechazada. Contáctanos para más información.');
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

REVOKE ALL ON FUNCTION public.notify_admin_tx_paid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_tx_status_change() FROM PUBLIC, anon, authenticated;