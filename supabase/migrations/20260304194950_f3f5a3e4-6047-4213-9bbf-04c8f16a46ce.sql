CREATE POLICY "Students can view sessions they attended"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT session_id FROM public.attendance
    WHERE student_id IN (
      SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid()
    )
  )
);