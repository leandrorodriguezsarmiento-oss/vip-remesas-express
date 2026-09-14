-- 1) verification_codes: quitar toda escritura desde el cliente (solo servidor)
DROP POLICY IF EXISTS "Users can insert own verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Users can update own verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Users can read own verification codes" ON public.verification_codes;
REVOKE ALL ON public.verification_codes FROM anon, authenticated;
GRANT ALL ON public.verification_codes TO service_role;

-- 2) SECURITY DEFINER: revocar EXECUTE de funciones trigger (no deben llamarse desde la API)
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.enforce_single_admin()',
    'public.grant_owner_admin_role()',
    'public.handle_new_user()',
    'public.notify_mp_payment_status_change()',
    'public.notify_recarga_created()',
    'public.notify_recarga_status_change()',
    'public.notify_tx_completed()',
    'public.notify_tx_status_change()',
    'public.touch_updated_at()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

-- 3) Tasas y promos visibles sin cuenta (solo lectura de filas activas)
DROP POLICY IF EXISTS "Anyone reads active rates" ON public.rates;
CREATE POLICY "Anyone reads active rates" ON public.rates
  FOR SELECT TO anon, authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));
GRANT SELECT ON public.rates TO anon;

DROP POLICY IF EXISTS "Anyone reads promos" ON public.promos;
CREATE POLICY "Anyone reads promos" ON public.promos
  FOR SELECT TO anon, authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));
GRANT SELECT ON public.promos TO anon;

GRANT SELECT ON public.banners TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;