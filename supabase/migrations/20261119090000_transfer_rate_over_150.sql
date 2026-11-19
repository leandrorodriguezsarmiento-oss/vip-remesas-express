-- Configure two BRL→CUP transfer brackets while preserving the existing lower rate.
ALTER TABLE public.rates
  ADD COLUMN IF NOT EXISTS max_amount numeric;

-- Multiple amount brackets must be allowed for the same corridor.
ALTER TABLE public.rates
  DROP CONSTRAINT IF EXISTS rates_origin_country_method_category_dest_currency_key;

-- Keep the current base rate for R$20–R$150.
UPDATE public.rates
SET min_amount = 20,
    max_amount = 150,
    updated_at = now()
WHERE origin_country = 'BR'
  AND method_category = 'transferencia'
  AND dest_currency = 'CUP'
  AND min_amount <= 150;

-- If a higher bracket already exists, normalize it to the agreed 175 rate.
UPDATE public.rates
SET rate = 175,
    min_amount = 150.01,
    max_amount = NULL,
    updated_at = now()
WHERE origin_country = 'BR'
  AND method_category = 'transferencia'
  AND dest_currency = 'CUP'
  AND min_amount > 150;

-- Add the agreed higher rate for amounts greater than R$150.
INSERT INTO public.rates (
  origin_country, origin_currency, method_category, dest_currency,
  rate, time_min_minutes, time_max_minutes, min_amount, max_amount, active
)
SELECT 'BR', 'BRL', 'transferencia', 'CUP',
       175,
       COALESCE(base.time_min_minutes, 15),
       COALESCE(base.time_max_minutes, 30),
       150.01, NULL, true
FROM (
  SELECT time_min_minutes, time_max_minutes
  FROM public.rates
  WHERE origin_country = 'BR'
    AND method_category = 'transferencia'
    AND dest_currency = 'CUP'
  ORDER BY min_amount
  LIMIT 1
) base
WHERE NOT EXISTS (
  SELECT 1 FROM public.rates
  WHERE origin_country = 'BR'
    AND method_category = 'transferencia'
    AND dest_currency = 'CUP'
    AND min_amount > 150
);
