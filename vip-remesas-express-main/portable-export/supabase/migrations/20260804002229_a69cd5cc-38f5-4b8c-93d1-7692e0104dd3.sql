-- 1) Perfil ampliado
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- 2) Alias de inicio de sesión (teléfono / CPF / usuario -> email sintético)
CREATE TABLE IF NOT EXISTS public.login_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  kind text NOT NULL,
  auth_email text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS login_aliases_alias_key ON public.login_aliases (lower(alias));

GRANT ALL ON public.login_aliases TO service_role;
ALTER TABLE public.login_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own aliases read" ON public.login_aliases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3) Contactos guardados: dirección
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS address text;

-- 4) Numeración consecutiva
CREATE SEQUENCE IF NOT EXISTS public.transactions_order_no_seq;
CREATE SEQUENCE IF NOT EXISTS public.recargas_order_no_seq;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS order_no bigint NOT NULL DEFAULT nextval('public.transactions_order_no_seq');
ALTER TABLE public.recargas_requests
  ADD COLUMN IF NOT EXISTS order_no bigint NOT NULL DEFAULT nextval('public.recargas_order_no_seq');

GRANT USAGE, SELECT ON SEQUENCE public.transactions_order_no_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.recargas_order_no_seq TO authenticated, service_role;

-- 5) Avisos de recargas
CREATE OR REPLACE FUNCTION public.notify_recarga_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (NEW.user_id, 'Recarga en proceso',
    'Recibimos tu solicitud #' || NEW.order_no || ' de ' || NEW.promo_title || ' para ' || NEW.phone || '.');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_recarga_created() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_recarga_created ON public.recargas_requests;
CREATE TRIGGER trg_notify_recarga_created
AFTER INSERT ON public.recargas_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_recarga_created();

CREATE OR REPLACE FUNCTION public.notify_recarga_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title text;
  v_body text;
  v_notification_id uuid;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2x4d3RyaXRjc3JnbHdpbWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzY1NjgsImV4cCI6MjA5OTExMjU2OH0._rVbxQ9JDgB5FFMVxaGgSKFTi-ozyzrlOvsEgHvJ-3o';
  v_dispatch_url text := 'https://tudominio.com/api/public/push/dispatch';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'processing' THEN
      v_title := 'Recarga en proceso';
      v_body := 'Tu recarga #' || NEW.order_no || ' a ' || NEW.phone || ' está siendo procesada.';
    ELSIF NEW.status = 'completed' THEN
      v_title := '¡Recarga completada!';
      v_body := 'Tu recarga #' || NEW.order_no || ' a ' || NEW.phone || ' ya fue aplicada.';
    ELSIF NEW.status = 'rejected' THEN
      v_title := 'Recarga rechazada';
      v_body := 'Tu recarga #' || NEW.order_no || ' a ' || NEW.phone || ' fue rechazada. Contáctanos.';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.user_id, v_title, v_body)
    RETURNING id INTO v_notification_id;

    PERFORM net.http_post(
      url := v_dispatch_url,
      headers := jsonb_build_object('Content-Type','application/json','apikey', v_anon_key),
      body := jsonb_build_object('notification_id', v_notification_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_recarga_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_recarga_status_change ON public.recargas_requests;
CREATE TRIGGER trg_notify_recarga_status_change
AFTER UPDATE ON public.recargas_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_recarga_status_change();

-- Realtime para recargas del usuario
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recargas_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 6) handle_new_user: guardar campos extra del registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, username, cpf, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    NULLIF(NEW.raw_user_meta_data->>'cpf', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'country', ''), 'BR')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;