
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.store_orders REPLICA IDENTITY FULL;
ALTER TABLE public.store_products REPLICA IDENTITY FULL;
ALTER TABLE public.promos REPLICA IDENTITY FULL;
ALTER TABLE public.rates REPLICA IDENTITY FULL;
ALTER TABLE public.recargas_requests REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.store_orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.store_products; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.promos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rates; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

CREATE OR REPLACE FUNCTION public.notify_users_new_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_id uuid;
  v_title text;
  v_body text;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2x4d3RyaXRjc3JnbHdpbWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzY1NjgsImV4cCI6MjA5OTExMjU2OH0._rVbxQ9JDgB5FFMVxaGgSKFTi-ozyzrlOvsEgHvJ-3o';
  v_url text := 'https://project--f318d839-9858-4e78-a02b-1da8134720f0.lovable.app/api/public/push/dispatch';
BEGIN
  IF NEW.active IS NOT TRUE THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'store_products' THEN
    v_title := '¡Nuevo en VipShop!';
    v_body := NEW.title || ' — revisa nuestras nuevas ofertas.';
  ELSE
    v_title := '¡Nueva promoción de recarga!';
    v_body := NEW.title || ' — revisa nuestras promociones.';
  END IF;

  FOR r IN SELECT p.id AS user_id FROM public.profiles p LOOP
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (r.user_id, v_title, v_body)
    RETURNING id INTO v_id;
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
      body := jsonb_build_object('notification_id', v_id));
  END LOOP;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_users_new_offer() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_new_store_product ON public.store_products;
CREATE TRIGGER trg_notify_new_store_product
AFTER INSERT ON public.store_products
FOR EACH ROW EXECUTE FUNCTION public.notify_users_new_offer();

DROP TRIGGER IF EXISTS trg_notify_new_promo ON public.promos;
CREATE TRIGGER trg_notify_new_promo
AFTER INSERT ON public.promos
FOR EACH ROW EXECUTE FUNCTION public.notify_users_new_offer();
