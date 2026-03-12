-- Allow authenticated users (students) to view sessions
-- Sessions contain class schedule data which is not sensitive
CREATE POLICY "Authenticated users can view sessions"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (true);
