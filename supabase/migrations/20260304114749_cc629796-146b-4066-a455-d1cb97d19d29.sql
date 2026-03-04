
-- Table for pending payment requests from students
CREATE TABLE public.pending_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  admin_user_id uuid NOT NULL, -- the admin who owns this student
  payment_type text NOT NULL, -- 'חד פעמי' or 'חודשי'
  payment_method text NOT NULL DEFAULT 'מזומן',
  amount numeric,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;

-- Students can create payment requests for themselves
CREATE POLICY "Students can create own payment requests" ON public.pending_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
  );

-- Students can view their own requests
CREATE POLICY "Students can view own requests" ON public.pending_payments
  FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
  );

-- Admin can view all pending payments for their students
CREATE POLICY "Admin can view pending payments" ON public.pending_payments
  FOR SELECT TO authenticated
  USING (admin_user_id = auth.uid());

-- Admin can update (approve/reject)
CREATE POLICY "Admin can update pending payments" ON public.pending_payments
  FOR UPDATE TO authenticated
  USING (admin_user_id = auth.uid());

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_payments;
