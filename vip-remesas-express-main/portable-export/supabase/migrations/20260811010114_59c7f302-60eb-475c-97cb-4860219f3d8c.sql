-- Organizador puede gestionar productos de la tienda
CREATE POLICY "Organizadores manage products"
ON public.store_products FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'organizador'))
WITH CHECK (public.has_role(auth.uid(), 'organizador'));

DROP POLICY IF EXISTS "Signed-in reads products" ON public.store_products;
CREATE POLICY "Signed-in reads products"
ON public.store_products FOR SELECT TO authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'organizador'));

-- El organizador sólo ve pedidos que el admin ya puso en proceso
DROP POLICY IF EXISTS "own orders select" ON public.store_orders;
CREATE POLICY "own orders select"
ON public.store_orders FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'organizador') AND status <> 'pending'::recarga_status)
);