-- 1) Nuevo rol organizador
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'organizador';

-- 2) Correo de contacto en el perfil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 3) Unicidad real de identificadores
CREATE UNIQUE INDEX IF NOT EXISTS login_aliases_alias_lower_key
  ON public.login_aliases (lower(alias));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_key
  ON public.profiles (cpf) WHERE cpf IS NOT NULL AND cpf <> '';
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key
  ON public.profiles (lower(email)) WHERE email IS NOT NULL AND email <> '';

-- 4) El trigger de admin único no debe bloquear otros roles
CREATE OR REPLACE FUNCTION public.enforce_single_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- 5) handle_new_user guarda el correo de contacto
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, username, cpf, country, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    NULLIF(NEW.raw_user_meta_data->>'cpf', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'country', ''), 'BR'),
    NULLIF(lower(NEW.raw_user_meta_data->>'contact_email'), '')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;