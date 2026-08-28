DROP POLICY IF EXISTS "Anyone reads active rates" ON public.rates;
CREATE POLICY "Public reads active rates" ON public.rates
  FOR SELECT TO anon USING (active = true);
CREATE POLICY "Signed-in reads rates" ON public.rates
  FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone reads promos" ON public.promos;
CREATE POLICY "Public reads active promos" ON public.promos
  FOR SELECT TO anon USING (active = true);
CREATE POLICY "Signed-in reads promos" ON public.promos
  FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view active banners" ON public.banners;
CREATE POLICY "Public reads active banners" ON public.banners
  FOR SELECT TO anon USING (active = true);
CREATE POLICY "Signed-in reads banners" ON public.banners
  FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'::app_role));

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;