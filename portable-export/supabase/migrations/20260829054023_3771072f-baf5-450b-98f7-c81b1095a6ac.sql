-- Nuevo rol para dueños de restaurantes
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'restaurante';

-- ============ RESTAURANTES ============
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  br_state text NOT NULL,
  city text NOT NULL,
  neighborhood text,
  phone text,
  whatsapp text,
  delivery_notes text,
  approved boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read approved restaurants" ON public.restaurants
  FOR SELECT TO authenticated
  USING ((approved AND active) OR owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "owner registers restaurant" ON public.restaurants
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner updates own restaurant" ON public.restaurants
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "admin manages restaurants" ON public.restaurants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Nadie que no sea admin puede aprobarse a sí mismo
CREATE OR REPLACE FUNCTION public.guard_restaurant_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.approved AND NOT public.has_role(auth.uid(),'admin') THEN
      NEW.approved := false;
    END IF;
  ELSE
    IF NEW.approved IS DISTINCT FROM OLD.approved
       AND NOT public.has_role(auth.uid(),'admin') THEN
      NEW.approved := OLD.approved;
    END IF;
    NEW.owner_id := OLD.owner_id;
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.guard_restaurant_approval() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guard_restaurant_approval
  BEFORE INSERT OR UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_approval();

-- ============ MENÚ ============
CREATE TABLE public.food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Almuerzo',
  title text NOT NULL,
  description text,
  price_brl numeric(12,2) NOT NULL,
  image_url text,
  available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_items TO authenticated;
GRANT ALL ON public.food_items TO service_role;

ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read menu of approved restaurants" ON public.food_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = food_items.restaurant_id
      AND ((r.approved AND r.active) OR r.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ));

CREATE POLICY "owner manages own menu" ON public.food_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = food_items.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = food_items.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "admin manages menu" ON public.food_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_food_items_updated_at
  BEFORE UPDATE ON public.food_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PEDIDOS DE COMIDA ============
CREATE SEQUENCE IF NOT EXISTS public.food_orders_no_seq START 1000;

CREATE TABLE public.food_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no bigint NOT NULL DEFAULT nextval('public.food_orders_no_seq'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
  restaurant_name text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text NOT NULL,
  br_state text NOT NULL,
  city text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_brl numeric(12,2) NOT NULL,
  status public.recarga_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.food_orders TO authenticated;
GRANT ALL ON public.food_orders TO service_role;

ALTER TABLE public.food_orders ENABLE ROW LEVEL SECURITY;

-- Sin política de INSERT para clientes: los pedidos se crean solo por servidor
CREATE POLICY "read own or restaurant food orders" ON public.food_orders
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = food_orders.restaurant_id AND r.owner_id = auth.uid())
  );

CREATE POLICY "owner updates restaurant food orders" ON public.food_orders
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = food_orders.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = food_orders.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "admin updates food orders" ON public.food_orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_food_orders_updated_at
  BEFORE UPDATE ON public.food_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Aviso al dueño cuando entra un pedido
CREATE OR REPLACE FUNCTION public.notify_owner_new_food_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_id uuid;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2x4d3RyaXRjc3JnbHdpbWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzY1NjgsImV4cCI6MjA5OTExMjU2OH0._rVbxQ9JDgB5FFMVxaGgSKFTi-ozyzrlOvsEgHvJ-3o';
  v_url text := 'https://tudominio.com/api/public/push/dispatch';
BEGIN
  SELECT owner_id INTO v_owner FROM public.restaurants WHERE id = NEW.restaurant_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (v_owner, 'Nuevo pedido de comida #' || NEW.order_no,
      NEW.customer_name || ' · R$ ' || NEW.total_brl || ' · ' || NEW.city)
    RETURNING id INTO v_id;
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
      body := jsonb_build_object('notification_id', v_id));
  END IF;

  INSERT INTO public.notifications (user_id, title, body)
  VALUES (NEW.user_id, 'Pedido de comida recibido',
    'Tu pedido #' || NEW.order_no || ' en ' || NEW.restaurant_name || ' fue enviado al restaurante.');
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.notify_owner_new_food_order() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_owner_new_food_order
  AFTER INSERT ON public.food_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_new_food_order();

-- Aviso al cliente cuando cambia el estado
CREATE OR REPLACE FUNCTION public.notify_food_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title text;
  v_body text;
  v_id uuid;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2x4d3RyaXRjc3JnbHdpbWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzY1NjgsImV4cCI6MjA5OTExMjU2OH0._rVbxQ9JDgB5FFMVxaGgSKFTi-ozyzrlOvsEgHvJ-3o';
  v_url text := 'https://tudominio.com/api/public/push/dispatch';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'processing' THEN
      v_title := 'Pedido en preparación';
      v_body := 'Tu pedido #' || NEW.order_no || ' en ' || NEW.restaurant_name || ' está en preparación.';
    ELSIF NEW.status = 'completed' THEN
      v_title := '¡Pedido entregado!';
      v_body := 'Tu pedido #' || NEW.order_no || ' en ' || NEW.restaurant_name || ' fue entregado.';
    ELSIF NEW.status = 'rejected' THEN
      v_title := 'Pedido rechazado';
      v_body := 'Tu pedido #' || NEW.order_no || ' en ' || NEW.restaurant_name || ' fue rechazado.';
    ELSE
      RETURN NEW;
    END IF;
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.user_id, v_title, v_body)
    RETURNING id INTO v_id;
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
      body := jsonb_build_object('notification_id', v_id));
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.notify_food_order_status_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_food_order_status_change
  AFTER UPDATE ON public.food_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_food_order_status_change();
