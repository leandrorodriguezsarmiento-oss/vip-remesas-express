-- 1) Organizadores pueden subir/actualizar imágenes de productos y banners
DROP POLICY IF EXISTS "Staff upload banners" ON storage.objects;
CREATE POLICY "Staff upload banners" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'banners' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'organizador')));

DROP POLICY IF EXISTS "Staff update banners" ON storage.objects;
CREATE POLICY "Staff update banners" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'banners' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'organizador')));

-- 2) Avisar al admin cuando un organizador finaliza (completa o rechaza) un servicio
CREATE OR REPLACE FUNCTION public.notify_admin_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_id uuid;
  v_kind text;
  v_title text;
  v_body text;
  v_who text;
  v_anon_key text := 'REEMPLAZA_CON_TU_ANON_KEY';
  v_url text := 'https://tudominio.com/api/public/push/dispatch';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','rejected') THEN
    IF TG_TABLE_NAME = 'transactions' THEN
      v_kind := 'Remesa'; v_who := NEW.recipient_name;
    ELSIF TG_TABLE_NAME = 'store_orders' THEN
      v_kind := 'Pedido VipShop'; v_who := NEW.recipient_name;
    ELSE
      v_kind := 'Recarga'; v_who := NEW.phone;
    END IF;

    v_title := v_kind || ' #' || NEW.order_no ||
      CASE WHEN NEW.status = 'completed' THEN ' completada' ELSE ' rechazada' END;
    v_body := coalesce(v_who,'') || ' · actualizado por el equipo.';

    FOR r IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' LOOP
      IF NEW.assigned_to IS NULL OR r.user_id <> NEW.assigned_to THEN
        INSERT INTO public.notifications (user_id, title, body)
        VALUES (r.user_id, v_title, v_body)
        RETURNING id INTO v_id;
        PERFORM net.http_post(
          url := v_url,
          headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
          body := jsonb_build_object('notification_id', v_id));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admin_completion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_admin_done_tx ON public.transactions;
CREATE TRIGGER trg_notify_admin_done_tx AFTER UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_completion();

DROP TRIGGER IF EXISTS trg_notify_admin_done_recarga ON public.recargas_requests;
CREATE TRIGGER trg_notify_admin_done_recarga AFTER UPDATE ON public.recargas_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_completion();

DROP TRIGGER IF EXISTS trg_notify_admin_done_order ON public.store_orders;
CREATE TRIGGER trg_notify_admin_done_order AFTER UPDATE ON public.store_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_completion();