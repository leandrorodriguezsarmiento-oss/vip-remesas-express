-- Notify administrators about important user activity.
-- Trigger functions are SECURITY DEFINER so they can insert notifications for admins
-- without weakening the notifications RLS policies.

CREATE OR REPLACE FUNCTION public.notify_admins_for_user_action(
  _user_id uuid,
  _title text,
  _body text,
  _tx_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  username text;
BEGIN
  SELECT COALESCE(NULLIF(p.username, ''), NULLIF(p.full_name, ''), 'Usuario')
    INTO username
  FROM public.profiles p
  WHERE p.id = _user_id;

  username := COALESCE(username, 'Usuario');

  FOR admin_id IN
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, body, tx_id)
    VALUES (admin_id, _title, REPLACE(_body, '{username}', username), _tx_id);
  END LOOP;
END;
$$;

-- New account/profile.
CREATE OR REPLACE FUNCTION public.notify_admin_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins_for_user_action(
    NEW.id,
    'Nuevo usuario registrado',
    'El usuario {username} acaba de crear su cuenta.',
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_profile ON public.profiles;
CREATE TRIGGER trg_notify_admin_new_profile
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_profile();

-- Remittance created or status changed.
CREATE OR REPLACE FUNCTION public.notify_admin_transaction_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_admins_for_user_action(
      NEW.user_id,
      'Nueva remesa',
      'El usuario {username} creó la remesa #' || COALESCE(NEW.order_no::text, NEW.tracking_id, NEW.id::text) || '.',
      NEW.id
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_admins_for_user_action(
      NEW.user_id,
      'Cambio en remesa',
      'El usuario {username} cambió la remesa #' || COALESCE(NEW.order_no::text, NEW.tracking_id, NEW.id::text) || ' a estado: ' || NEW.status || '.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_transaction_activity ON public.transactions;
CREATE TRIGGER trg_notify_admin_transaction_activity
AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_transaction_activity();

-- Recharge created or status changed.
CREATE OR REPLACE FUNCTION public.notify_admin_recarga_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_admins_for_user_action(
      NEW.user_id,
      'Nueva recarga',
      'El usuario {username} solicitó una recarga para ' || COALESCE(NEW.phone, 'teléfono no indicado') || '.',
      NULL
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_admins_for_user_action(
      NEW.user_id,
      'Cambio en recarga',
      'La recarga del usuario {username} cambió a estado: ' || NEW.status || '.',
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_recarga_activity ON public.recargas_requests;
CREATE TRIGGER trg_notify_admin_recarga_activity
AFTER INSERT OR UPDATE OF status ON public.recargas_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_recarga_activity();

-- Store order created or status changed.
CREATE OR REPLACE FUNCTION public.notify_admin_store_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_admins_for_user_action(
      NEW.user_id,
      'Nuevo pedido VipShop',
      'El usuario {username} creó el pedido #' || COALESCE(NEW.order_no::text, NEW.id::text) || '.',
      NULL
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_admins_for_user_action(
      NEW.user_id,
      'Cambio en pedido VipShop',
      'El pedido #' || COALESCE(NEW.order_no::text, NEW.id::text) || ' del usuario {username} cambió a estado: ' || NEW.status || '.',
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_store_activity ON public.store_orders;
CREATE TRIGGER trg_notify_admin_store_activity
AFTER INSERT OR UPDATE OF status ON public.store_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_store_activity();

NOTIFY pgrst, 'reload schema';
