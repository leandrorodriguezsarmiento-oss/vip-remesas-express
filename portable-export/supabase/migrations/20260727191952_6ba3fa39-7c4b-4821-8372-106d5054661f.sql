
-- Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_owner_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_single_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_tx_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_tx_status_change() FROM PUBLIC, anon, authenticated;

-- has_role is called from RLS policies as authenticated users; keep authenticated but drop anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Allow users to delete their own notifications
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Allow users to insert their own recharge requests (server-side validation still occurs; service_role bypasses)
DROP POLICY IF EXISTS "Users insert own recargas" ON public.recargas_requests;
CREATE POLICY "Users insert own recargas" ON public.recargas_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow users to insert their own transactions (server-side validation of amounts still occurs)
DROP POLICY IF EXISTS "Users insert own transactions" ON public.transactions
;
CREATE POLICY "Users insert own transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
