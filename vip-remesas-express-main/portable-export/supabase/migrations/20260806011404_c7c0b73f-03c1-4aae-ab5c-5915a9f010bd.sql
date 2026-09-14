GRANT SELECT ON public.rates TO anon;
GRANT SELECT ON public.promos TO anon;

DROP POLICY IF EXISTS "Anon reads active rates" ON public.rates;
CREATE POLICY "Anon reads active rates" ON public.rates FOR SELECT TO anon USING (active = true);

DROP POLICY IF EXISTS "Anon reads active promos" ON public.promos;
CREATE POLICY "Anon reads active promos" ON public.promos FOR SELECT TO anon USING (active = true);