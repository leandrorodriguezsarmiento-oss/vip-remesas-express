-- Add a separate rate for transfers above R$150 without changing cash rates.
ALTER TABLE public.rates
  ADD COLUMN IF NOT EXISTS rate_over_150 numeric;

COMMENT ON COLUMN public.rates.rate_over_150 IS
  'Optional destination amount per 1 origin unit when a transfer amount is greater than 150 BRL.';
