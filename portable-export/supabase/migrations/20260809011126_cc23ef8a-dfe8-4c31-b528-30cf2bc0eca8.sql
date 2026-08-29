CREATE TABLE public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'celulares',
  title text NOT NULL,
  description text,
  price_brl numeric NOT NULL DEFAULT 0,
  images text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_products TO authenticated;
GRANT ALL ON public.store_products TO service_role;

ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active products" ON public.store_products
  FOR SELECT TO anon USING (active = true);
CREATE POLICY "Signed-in reads products" ON public.store_products
  FOR SELECT TO authenticated USING (active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage products" ON public.store_products
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_store_products_updated_at
  BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Aviso inmediato al admin cuando entra una remesa nueva
CREATE OR REPLACE FUNCTION public.notify_admin_new_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_id uuid;
  v_anon_key text := 'REEMPLAZA_CON_TU_ANON_KEY';
  v_url text := 'https://tudominio.com/api/public/push/dispatch';
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (r.user_id, 'Nueva remesa pendiente',
      'Remesa #' || NEW.order_no || ' para ' || NEW.recipient_name || ' esperando revisión.')
    RETURNING id INTO v_id;
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
      body := jsonb_build_object('notification_id', v_id));
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_new_tx
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_tx();

-- Aviso inmediato al admin cuando entra una recarga nueva
CREATE OR REPLACE FUNCTION public.notify_admin_new_recarga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_id uuid;
  v_anon_key text := 'REEMPLAZA_CON_TU_ANON_KEY';
  v_url text := 'https://tudominio.com/api/public/push/dispatch';
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (r.user_id, 'Nueva recarga pendiente',
      'Recarga #' || NEW.order_no || ' de ' || NEW.promo_title || ' para ' || NEW.phone || '.')
    RETURNING id INTO v_id;
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
      body := jsonb_build_object('notification_id', v_id));
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_new_recarga
  AFTER INSERT ON public.recargas_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_recarga();

-- Aviso a organizadores cuando el admin pone algo en procesando
CREATE OR REPLACE FUNCTION public.notify_organizers_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_id uuid;
  v_title text;
  v_body text;
  v_anon_key text := 'REEMPLAZA_CON_TU_ANON_KEY';
  v_url text := 'https://tudominio.com/api/public/push/dispatch';
BEGIN
  IF NEW.status = 'processing' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF TG_TABLE_NAME = 'transactions' THEN
      v_title := 'Remesa pendiente de procesar';
      v_body := 'Remesa #' || NEW.order_no || ' asignada. Revisa el panel.';
    ELSE
      v_title := 'Recarga pendiente de procesar';
      v_body := 'Recarga #' || NEW.order_no || ' asignada. Revisa el panel.';
    END IF;
    FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'organizador' LOOP
      INSERT INTO public.notifications (user_id, title, body)
      VALUES (r.user_id, v_title, v_body)
      RETURNING id INTO v_id;
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
        body := jsonb_build_object('notification_id', v_id));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_org_tx
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_organizers_processing();

CREATE TRIGGER trg_notify_org_recarga
  AFTER UPDATE ON public.recargas_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_organizers_processing();

-- Organizadores: sólo lo que ya está en procesando o cerrado
DROP POLICY IF EXISTS "Organizadores ven remesas" ON public.transactions;
CREATE POLICY "Organizadores ven remesas" ON public.transactions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'organizador'::app_role) AND status <> 'pending'::tx_status);

DROP POLICY IF EXISTS "Organizadores ven recargas" ON public.recargas_requests;
CREATE POLICY "Organizadores ven recargas" ON public.recargas_requests
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'organizador'::app_role) AND status <> 'pending'::recarga_status);

REVOKE ALL ON FUNCTION public.notify_admin_new_tx() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_new_recarga() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_organizers_processing() FROM PUBLIC, anon, authenticated;