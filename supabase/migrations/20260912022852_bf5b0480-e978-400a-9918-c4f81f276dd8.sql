CREATE POLICY "Deny direct access to verification codes"
  ON public.verification_codes FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "Deny direct access to auth rate limits"
  ON public.auth_rate_limits FOR ALL TO authenticated
  USING (false) WITH CHECK (false);