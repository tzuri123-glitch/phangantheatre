-- Allow any authenticated user to read student names (for sibling selection)
-- First drop conflicting policies
DROP POLICY IF EXISTS "Students can view own record" ON public.students;
DROP POLICY IF EXISTS "Users can view their own students" ON public.students;

-- Recreate: admins see their own students, all authenticated can read for sibling lookup
CREATE POLICY "Admin can view own students"
ON public.students
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Students can view own record"
ON public.students
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

CREATE POLICY "Authenticated can read student names"
ON public.students
FOR SELECT
TO authenticated
USING (true);