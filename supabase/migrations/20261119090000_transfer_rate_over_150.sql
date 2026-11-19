-- Add a separate rate for transfers above R$150 without changing cash rates.
ALTER TABLE public.rates
  ADD COLUMN IF NOT EXISTS rate_over_150 numeric;

COMMENT ON COLUMN public.rates.rate_over_150 IS
  'Optional destination amount per 1 origin unit when a transfer amount is greater than 150 BRL.';

-- Restore the agreed BRL→CUP transfer tier: over R$150 pays 175.
UPDATE public.rates
SET rate_over_150 = 175,
    updated_at = now()
WHERE origin_country = 'BR'
  AND method_category = 'transferencia'
  AND dest_currency = 'CUP';
