CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);

GRANT ALL ON public.auth_rate_limits TO service_role;

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  _key text,
  _limit integer,
  _window_seconds integer,
  _block_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.auth_rate_limits;
BEGIN
  SELECT * INTO r FROM public.auth_rate_limits WHERE key = _key FOR UPDATE;

  IF r.key IS NULL THEN
    INSERT INTO public.auth_rate_limits (key, count, window_start)
    VALUES (_key, 1, now());
    RETURN true;
  END IF;

  IF r.blocked_until IS NOT NULL AND r.blocked_until > now() THEN
    RETURN false;
  END IF;

  IF r.window_start < now() - make_interval(secs => _window_seconds) THEN
    UPDATE public.auth_rate_limits
      SET count = 1, window_start = now(), blocked_until = NULL
      WHERE key = _key;
    RETURN true;
  END IF;

  IF r.count + 1 > _limit THEN
    UPDATE public.auth_rate_limits
      SET count = r.count + 1,
          blocked_until = now() + make_interval(secs => _block_seconds)
      WHERE key = _key;
    RETURN false;
  END IF;

  UPDATE public.auth_rate_limits SET count = r.count + 1 WHERE key = _key;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_rate_limit(_key text) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.auth_rate_limits WHERE key = _key;
$$;

REVOKE ALL ON FUNCTION public.reset_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit(text) TO service_role;