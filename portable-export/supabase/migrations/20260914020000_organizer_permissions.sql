-- Configurable organizer permissions.
CREATE TABLE IF NOT EXISTS public.organizer_permissions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('remesas','recargas','tienda')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);

ALTER TABLE public.organizer_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_organizer_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.organizer_permissions op ON op.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'organizador'
      AND op.permission = _permission
  );
$$;

DROP POLICY IF EXISTS "Admins manage organizer permissions" ON public.organizer_permissions;
CREATE POLICY "Admins manage organizer permissions"
ON public.organizer_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Organizers read own permissions" ON public.organizer_permissions;
CREATE POLICY "Organizers read own permissions"
ON public.organizer_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Existing organizers keep their current access after the new permission model is enabled.
INSERT INTO public.organizer_permissions (user_id, permission)
SELECT ur.user_id, p.permission
FROM public.user_roles ur
CROSS JOIN (VALUES ('remesas'), ('recargas'), ('tienda')) AS p(permission)
WHERE ur.role = 'organizador'
ON CONFLICT (user_id, permission) DO NOTHING;
