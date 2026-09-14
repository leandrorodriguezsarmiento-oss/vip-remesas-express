CREATE TABLE public.flights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origin_city TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT 'Georgetown, Guyana',
  price_usd NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.flights TO authenticated;
GRANT ALL ON public.flights TO service_role;

ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven pasajes activos" ON public.flights
  FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin inserta pasajes" ON public.flights
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin edita pasajes" ON public.flights
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin elimina pasajes" ON public.flights
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_flights_updated_at BEFORE UPDATE ON public.flights
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.flights (origin_city, destination, price_usd, notes, sort_order) VALUES
  ('La Habana', 'Georgetown, Guyana', 0, NULL, 1),
  ('Santiago de Cuba', 'Georgetown, Guyana', 0, NULL, 2),
  ('Camagüey', 'Georgetown, Guyana', 0, NULL, 3),
  ('Holguín', 'Georgetown, Guyana', 0, NULL, 4);