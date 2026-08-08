-- Seguridad: funciones internas de trigger no ejecutables desde la API
REVOKE ALL ON FUNCTION public.enforce_single_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Organizadores: pueden ver y procesar remesas
CREATE POLICY "Organizadores ven remesas" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'organizador'));

CREATE POLICY "Organizadores actualizan remesas" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'organizador'))
  WITH CHECK (public.has_role(auth.uid(), 'organizador'));

-- Organizadores: pueden ver y procesar recargas
CREATE POLICY "Organizadores ven recargas" ON public.recargas_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'organizador'));

CREATE POLICY "Organizadores actualizan recargas" ON public.recargas_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'organizador'))
  WITH CHECK (public.has_role(auth.uid(), 'organizador'));