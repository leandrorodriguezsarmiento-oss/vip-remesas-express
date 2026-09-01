
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subs"
ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_push_subs_touch
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Add push_sent flag to notifications so dispatcher marks them
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_sent BOOLEAN NOT NULL DEFAULT false;

-- Extend the status-change trigger to also fire an HTTP call to the push dispatcher
CREATE OR REPLACE FUNCTION public.notify_tx_status_change()
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
      v_title := 'Remesa en proceso';
      v_body := 'Tu remesa ' || NEW.tracking_id || ' para ' || NEW.recipient_name || ' está siendo procesada.';
    ELSIF NEW.status = 'completed' THEN
      v_title := '¡Remesa completada!';
      v_body := 'Tu remesa ' || NEW.tracking_id || ' para ' || NEW.recipient_name || ' fue entregada.';
    ELSIF NEW.status IN ('rejected','cancelled') THEN
      v_title := 'Remesa rechazada';
      v_body := 'Tu remesa ' || NEW.tracking_id || ' fue rechazada o cancelada. Contáctanos para más información.';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, body, tx_id)
    VALUES (NEW.user_id, v_title, v_body, NEW.id)
    RETURNING id INTO v_notification_id;

    -- Fire-and-forget HTTP call to the dispatcher (pg_net is async)
    PERFORM net.http_post(
      url := v_dispatch_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_anon_key
      ),
      body := jsonb_build_object('notification_id', v_notification_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_tx_status_change() FROM anon, authenticated;
