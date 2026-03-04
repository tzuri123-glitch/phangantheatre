
-- Drop the permissive INSERT policy - the trigger uses SECURITY DEFINER so it bypasses RLS
DROP POLICY "System can insert audit log" ON public.payment_audit_log;
