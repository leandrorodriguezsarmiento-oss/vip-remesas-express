ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE public.store_products ADD COLUMN IF NOT EXISTS province text;
CREATE INDEX IF NOT EXISTS store_products_province_idx ON public.store_products (province);