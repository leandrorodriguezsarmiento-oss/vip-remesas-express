ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.recargas_requests ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Organizadores ven remesas" ON public.transactions;
CREATE POLICY "Organizadores ven remesas" ON public.transactions FOR SELECT TO authenticated
USING (has_role(auth.uid(),'organizador') AND status <> 'pending' AND assigned_to = auth.uid());

DROP POLICY IF EXISTS "Organizadores actualizan remesas" ON public.transactions;
CREATE POLICY "Organizadores actualizan remesas" ON public.transactions FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'organizador') AND assigned_to = auth.uid())
WITH CHECK (has_role(auth.uid(),'organizador') AND assigned_to = auth.uid());

DROP POLICY IF EXISTS "Organizadores ven recargas" ON public.recargas_requests;
CREATE POLICY "Organizadores ven recargas" ON public.recargas_requests FOR SELECT TO authenticated
USING (has_role(auth.uid(),'organizador') AND status <> 'pending' AND assigned_to = auth.uid());

DROP POLICY IF EXISTS "Organizadores actualizan recargas" ON public.recargas_requests;
CREATE POLICY "Organizadores actualizan recargas" ON public.recargas_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'organizador') AND assigned_to = auth.uid())
WITH CHECK (has_role(auth.uid(),'organizador') AND assigned_to = auth.uid());

DROP POLICY IF EXISTS "own orders select" ON public.store_orders;
CREATE POLICY "own orders select" ON public.store_orders FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(),'admin')
  OR (has_role(auth.uid(),'organizador') AND status <> 'pending' AND assigned_to = auth.uid())
);

DROP POLICY IF EXISTS "staff orders update" ON public.store_orders;
CREATE POLICY "staff orders update" ON public.store_orders FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'organizador') AND assigned_to = auth.uid()))
WITH CHECK (has_role(auth.uid(),'admin') OR (has_role(auth.uid(),'organizador') AND assigned_to = auth.uid()));

CREATE OR REPLACE FUNCTION public.notify_organizers_processing()
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
  v_url text := 'https://tudominio.com/api/public/push/dispatch';
BEGIN
  IF NEW.status = 'processing' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF TG_TABLE_NAME = 'transactions' THEN
      v_title := 'Remesa pendiente de procesar';
      v_body := 'Remesa #' || NEW.order_no || ' asignada. Revisa el panel.';
    ELSIF TG_TABLE_NAME = 'store_orders' THEN
      v_title := 'Pedido pendiente de procesar';
      v_body := 'Pedido #' || NEW.order_no || ' asignado. Revisa el panel.';
    ELSE
      v_title := 'Recarga pendiente de procesar';
      v_body := 'Recarga #' || NEW.order_no || ' asignada. Revisa el panel.';
    END IF;

    FOR r IN
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'organizador'
        AND (NEW.assigned_to IS NULL OR ur.user_id = NEW.assigned_to)
    LOOP
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
$function$;

DROP TRIGGER IF EXISTS trg_notify_org_orders ON public.store_orders;
CREATE TRIGGER trg_notify_org_orders AFTER UPDATE ON public.store_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_organizers_processing();