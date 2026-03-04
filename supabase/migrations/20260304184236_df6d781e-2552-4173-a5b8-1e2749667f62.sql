
-- Immutable audit log for payment changes
CREATE TABLE public.payment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_data jsonb,
  new_data jsonb,
  changed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: only INSERT (immutable), viewable by admin
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view audit log"
  ON public.payment_audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit log"
  ON public.payment_audit_log FOR INSERT
  WITH CHECK (true);

-- No UPDATE or DELETE policies = truly immutable

-- Trigger function to auto-log payment changes
CREATE OR REPLACE FUNCTION public.log_payment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payment_audit_log (payment_id, student_id, action, new_data, changed_by)
    VALUES (NEW.id, NEW.student_id, 'INSERT', to_jsonb(NEW), NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.payment_audit_log (payment_id, student_id, action, old_data, new_data, changed_by)
    VALUES (NEW.id, NEW.student_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.payment_audit_log (payment_id, student_id, action, old_data, changed_by)
    VALUES (OLD.id, OLD.student_id, 'DELETE', to_jsonb(OLD), OLD.user_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach trigger to payments table
CREATE TRIGGER payment_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_change();

-- Enable realtime for audit log
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_audit_log;
