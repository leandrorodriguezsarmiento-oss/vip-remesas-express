
-- 1. Banners table
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text,
  link_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banners"
  ON public.banners FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage banners"
  ON public.banners FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Restrict admin role strictly to leandro
CREATE OR REPLACE FUNCTION public.enforce_single_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_email text;
BEGIN
  IF NEW.role = 'admin' THEN
    SELECT lower(email) INTO target_email FROM auth.users WHERE id = NEW.user_id;
    IF target_email IS DISTINCT FROM 'leandrorodriguezsarmiento@gmail.com' THEN
      RAISE EXCEPTION 'Only the owner account can be admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_admin ON public.user_roles;
CREATE TRIGGER trg_enforce_single_admin
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_admin();

-- Clean any stray admin rows
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id NOT IN (
    SELECT id FROM auth.users WHERE lower(email) = 'leandrorodriguezsarmiento@gmail.com'
  );

-- 3. updated_at trigger for banners
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_banners_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
