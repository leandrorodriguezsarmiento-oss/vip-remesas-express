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
  v_url text := 'https://project--f318d839-9858-4e78-a02b-1da8134720f0.lovable.app/api/public/push/dispatch';
BEGIN
  IF OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL THEN
    SELECT COALESCE(NULLIF(p.username,''), NULLIF(p.full_name,''), 'usuario')
      INTO v_sender FROM public.profiles p WHERE p.id = NEW.user_id;
    FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, title, body)
      VALUES (r.user_id, 'Remesa pagada #' || NEW.order_no,
        'Envía: ' || COALESCE(v_sender,'usuario') || ' · ' || NEW.recipient_name || ' · ' || NEW.amount_brl || ' ' || NEW.origin_currency || '.')
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

CREATE OR REPLACE FUNCTION public.notify_admin_new_store_order()
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
  v_url text := 'https://project--f318d839-9858-4e78-a02b-1da8134720f0.lovable.app/api/public/push/dispatch';
BEGIN
  SELECT COALESCE(NULLIF(p.username,''), NULLIF(p.full_name,''), 'usuario')
    INTO v_sender FROM public.profiles p WHERE p.id = NEW.user_id;
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (r.user_id, 'Nuevo pedido VipShop',
      'Envía: ' || COALESCE(v_sender,'usuario') || ' · Pedido #' || NEW.order_no || ' para ' || NEW.recipient_name || ' por R$ ' || NEW.total_brl || '.')
    RETURNING id INTO v_id;
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
      body := jsonb_build_object('notification_id', v_id));
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_admin_new_recarga()
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
  v_url text := 'https://project--f318d839-9858-4e78-a02b-1da8134720f0.lovable.app/api/public/push/dispatch';
BEGIN
  SELECT COALESCE(NULLIF(p.username,''), NULLIF(p.full_name,''), 'usuario')
    INTO v_sender FROM public.profiles p WHERE p.id = NEW.user_id;
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (r.user_id, 'Nueva recarga pendiente',
      'Envía: ' || COALESCE(v_sender,'usuario') || ' · Recarga #' || NEW.order_no || ' de ' || NEW.promo_title || ' para ' || NEW.phone || '.')
    RETURNING id INTO v_id;
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
      body := jsonb_build_object('notification_id', v_id));
  END LOOP;
  RETURN NEW;
END;
$function$;