DROP POLICY IF EXISTS "Staff upload banners" ON storage.objects;
CREATE POLICY "Staff upload banners" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'banners' AND (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'organizador')
  OR public.has_role(auth.uid(),'restaurante')
));

DROP POLICY IF EXISTS "Staff update banners" ON storage.objects;
CREATE POLICY "Staff update banners" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'banners' AND (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'organizador')
  OR public.has_role(auth.uid(),'restaurante')
));