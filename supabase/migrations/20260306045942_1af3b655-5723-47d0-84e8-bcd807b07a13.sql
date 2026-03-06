-- Make payment-proofs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'payment-proofs';

-- Fix pending_payments INSERT RLS policy to validate admin_user_id
DROP POLICY IF EXISTS "Students can create own payment requests" ON public.pending_payments;

CREATE POLICY "Students can create own payment requests" ON public.pending_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (
      SELECT id FROM public.students WHERE auth_user_id = auth.uid()
    )
    AND admin_user_id = (
      SELECT user_id FROM public.students
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
  );