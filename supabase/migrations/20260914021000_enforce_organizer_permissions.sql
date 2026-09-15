-- Enforce module permissions at the database boundary too.
-- Admins remain unrestricted. Organizers must have the matching permission.

DROP POLICY IF EXISTS "Organizadores actualizan remesas" ON public.transactions;
CREATE POLICY "Organizadores actualizan remesas" ON public.transactions
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR (
    public.has_role(auth.uid(),'organizador')
    AND public.has_organizer_permission(auth.uid(),'remesas')
    AND assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR (
    public.has_role(auth.uid(),'organizador')
    AND public.has_organizer_permission(auth.uid(),'remesas')
    AND assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "Organizadores actualizan recargas" ON public.recargas_requests;
CREATE POLICY "Organizadores actualizan recargas" ON public.recargas_requests
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR (
    public.has_role(auth.uid(),'organizador')
    AND public.has_organizer_permission(auth.uid(),'recargas')
    AND assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR (
    public.has_role(auth.uid(),'organizador')
    AND public.has_organizer_permission(auth.uid(),'recargas')
    AND assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "staff orders update" ON public.store_orders;
CREATE POLICY "staff orders update" ON public.store_orders
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR (
    public.has_role(auth.uid(),'organizador')
    AND public.has_organizer_permission(auth.uid(),'tienda')
    AND assigned_to = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR (
    public.has_role(auth.uid(),'organizador')
    AND public.has_organizer_permission(auth.uid(),'tienda')
    AND assigned_to = auth.uid()
  )
);
