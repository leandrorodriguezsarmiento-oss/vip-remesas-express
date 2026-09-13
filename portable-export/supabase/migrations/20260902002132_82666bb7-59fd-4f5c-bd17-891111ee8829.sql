CREATE TABLE IF NOT EXISTS public.migrant_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'lugar' CHECK (kind IN ('lugar','contacto','app')),
  title TEXT NOT NULL,
  description TEXT,
  address TEXT,
  state_code TEXT,
  city TEXT,
  phone TEXT,
  url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.migrant_resources TO authenticated;
GRANT ALL ON public.migrant_resources TO service_role;
ALTER TABLE public.migrant_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos los usuarios ven recursos activos" ON public.migrant_resources;
CREATE POLICY "Todos los usuarios ven recursos activos"
  ON public.migrant_resources FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Solo el admin crea recursos" ON public.migrant_resources;
CREATE POLICY "Solo el admin crea recursos"
  ON public.migrant_resources FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Solo el admin edita recursos" ON public.migrant_resources;
CREATE POLICY "Solo el admin edita recursos"
  ON public.migrant_resources FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Solo el admin elimina recursos" ON public.migrant_resources;
CREATE POLICY "Solo el admin elimina recursos"
  ON public.migrant_resources FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_migrant_resources_updated_at ON public.migrant_resources;
CREATE TRIGGER update_migrant_resources_updated_at
  BEFORE UPDATE ON public.migrant_resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.migrant_resources (kind, title, description, address, state_code, city, phone, url, sort_order) VALUES
('lugar','Polícia Federal — Registro de migrante','Trámite de CRNM (carné de extranjero) y solicitud de refugio. Lleva pasaporte y comprobante de domicilio.','Consulta la unidad de Polícia Federal más cercana','SP','São Paulo','+55 61 2024-8007','https://www.gov.br/pf/pt-br/assuntos/imigracao',1),
('lugar','Receita Federal — CPF','El CPF es obligatorio para trabajar, abrir cuenta y comprar. Trámite gratuito.','Agencias de la Receita Federal en tu ciudad','SP','São Paulo','146','https://www.gov.br/receitafederal/pt-br',2),
('lugar','Ministério do Trabalho — Carteira de Trabalho','Emite tu carteira de trabajo digital y consulta vacantes de empleo.','Agencias do Trabalhador (SINE) de tu estado','SP','São Paulo','158','https://www.gov.br/trabalho-e-emprego/pt-br',3),
('lugar','CRAS — Asistencia social','Apoyo social, cesta básica y orientación para recién llegados.','CRAS de tu barrio','SP','São Paulo','156','https://www.gov.br/mds/pt-br',4),
('contacto','ACNUR Brasil','Orientación gratuita para solicitantes de refugio y migrantes.',NULL,NULL,NULL,'+55 61 3038-9266','https://help.unhcr.org/brazil/es/',5),
('contacto','Cáritas Brasileira','Ayuda humanitaria, documentación y apoyo jurídico gratuito.',NULL,NULL,NULL,'+55 61 3214-5900','https://caritas.org.br',6),
('contacto','Disque 100 — Derechos humanos','Denuncia gratuita de abusos, discriminación o explotación laboral.',NULL,NULL,NULL,'100',NULL,7),
('contacto','SUS — Salud pública gratuita','Atención médica gratuita. Pide tu tarjeta SUS en la UBS más cercana.',NULL,NULL,NULL,'136','https://www.gov.br/saude/pt-br',8),
('app','Gov.br','App oficial para todos tus trámites en Brasil (CPF, documentos, INSS).',NULL,NULL,NULL,NULL,'https://play.google.com/store/apps/details?id=br.gov.meugovbr',9),
('app','Carteira de Trabalho Digital','Tu carteira de trabajo y contratos en el celular.',NULL,NULL,NULL,NULL,'https://play.google.com/store/apps/details?id=br.gov.dataprev.carteiradetrabalho',10),
('app','Caixa Tem','Cuenta digital gratuita para recibir pagos y beneficios.',NULL,NULL,NULL,NULL,'https://play.google.com/store/apps/details?id=br.gov.caixa.tem',11),
('app','Nubank','Cuenta y tarjeta sin costo, acepta CRNM y pasaporte.',NULL,NULL,NULL,NULL,'https://play.google.com/store/apps/details?id=com.nu.production',12),
('app','Meu SUS Digital','Consulta tu tarjeta SUS, vacunas y citas médicas.',NULL,NULL,NULL,NULL,'https://play.google.com/store/apps/details?id=br.gov.datasus.cnsdigital',13),
('app','Google Traductor','Traduce portugués al instante, también sin internet.',NULL,NULL,NULL,NULL,'https://play.google.com/store/apps/details?id=com.google.android.apps.translate',14);