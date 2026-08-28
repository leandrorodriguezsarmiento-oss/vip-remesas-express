
CREATE OR REPLACE FUNCTION public.notify_tx_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title text;
  v_body text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'processing' THEN
      v_title := 'Remesa en proceso';
      v_body := 'Tu remesa ' || NEW.tracking_id || ' para ' || NEW.recipient_name || ' está siendo procesada.';
    ELSIF NEW.status = 'completed' THEN
      v_title := '¡Remesa completada!';
      v_body := 'Tu remesa ' || NEW.tracking_id || ' para ' || NEW.recipient_name || ' fue entregada.';
    ELSIF NEW.status = 'rejected' OR NEW.status = 'cancelled' THEN
      v_title := 'Remesa rechazada';
      v_body := 'Tu remesa ' || NEW.tracking_id || ' fue rechazada o cancelada. Contáctanos para más información.';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, body, tx_id)
    VALUES (NEW.user_id, v_title, v_body, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_tx_status_change() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_tx_completed ON public.transactions;
DROP TRIGGER IF EXISTS trg_notify_tx_status_change ON public.transactions;

CREATE TRIGGER trg_notify_tx_status_change
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_tx_status_change();
