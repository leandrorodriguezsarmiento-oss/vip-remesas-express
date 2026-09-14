
-- Prevent clients from inserting transactions or recharge requests directly.
-- All inserts must go through server functions that recompute money values
-- from the authoritative rates/promos tables.
DROP POLICY IF EXISTS "Users create own transactions" ON public.transactions;
DROP POLICY IF EXISTS "own recargas insert" ON public.recargas_requests;
