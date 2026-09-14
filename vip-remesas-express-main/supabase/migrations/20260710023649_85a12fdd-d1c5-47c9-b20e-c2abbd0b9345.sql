
-- 1) Auto-grant admin role to the fixed owner email (only after verification)
CREATE OR REPLACE FUNCTION public.grant_owner_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'leandrorodriguezsarmiento@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_owner ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_owner
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin_role();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_owner ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_owner
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_owner_admin_role();

-- Backfill if user already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE lower(email) = 'leandrorodriguezsarmiento@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Recargas API config (single row managed by admin)
CREATE TABLE public.recargas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'mock',
  api_base_url text,
  api_key_name text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recargas_config TO authenticated;
GRANT ALL ON public.recargas_config TO service_role;
ALTER TABLE public.recargas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage recargas config" ON public.recargas_config
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.recargas_config (provider, notes) VALUES ('mock', 'Slot inicial. Edita provider y api_base_url cuando elijas proveedor.');

-- 3) In-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  tx_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications
FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins insert notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Trigger: when a transaction status changes to 'completed', insert notification
CREATE OR REPLACE FUNCTION public.notify_tx_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO public.notifications (user_id, title, body, tx_id)
    VALUES (
      NEW.user_id,
      '¡Remesa completada!',
      'Tu remesa ' || NEW.tracking_id || ' para ' || NEW.recipient_name || ' fue entregada.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tx_completed ON public.transactions;
CREATE TRIGGER trg_notify_tx_completed
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_tx_completed();
