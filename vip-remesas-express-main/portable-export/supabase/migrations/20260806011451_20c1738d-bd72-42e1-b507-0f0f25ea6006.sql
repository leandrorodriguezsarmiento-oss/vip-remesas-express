DROP POLICY IF EXISTS "Anyone reads active rates" ON public.rates;
CREATE POLICY "Signed in reads rates" ON public.rates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone reads promos" ON public.promos;
CREATE POLICY "Signed in reads promos" ON public.promos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage rates" ON public.rates;
CREATE POLICY "Admins manage rates" ON public.rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage promos" ON public.promos;
CREATE POLICY "Admins manage promos" ON public.promos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));