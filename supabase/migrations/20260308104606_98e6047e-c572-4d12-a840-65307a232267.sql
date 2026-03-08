
-- Fix #1: Recreate all RESTRICTIVE RLS policies as PERMISSIVE (default)
-- Drop all existing RESTRICTIVE policies and recreate them

-- === SESSIONS ===
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Students can view sessions they attended" ON public.sessions;

CREATE POLICY "Users can view their own sessions" ON public.sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sessions" ON public.sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sessions" ON public.sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sessions" ON public.sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Students can view sessions they attended" ON public.sessions FOR SELECT TO authenticated USING (id IN (SELECT attendance.session_id FROM attendance WHERE attendance.student_id IN (SELECT s.id FROM students s WHERE s.auth_user_id = auth.uid())));

-- === SUBSCRIPTIONS ===
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own subscriptions" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subscriptions" ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- === PAYMENTS ===
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update their own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete their own payments" ON public.payments;
DROP POLICY IF EXISTS "Students can view own payments" ON public.payments;

CREATE POLICY "Users can view their own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own payments" ON public.payments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own payments" ON public.payments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Students can view own payments" ON public.payments FOR SELECT TO authenticated USING (student_id IN (SELECT students.id FROM students WHERE students.auth_user_id = auth.uid()));

-- === ATTENDANCE ===
DROP POLICY IF EXISTS "Users can view their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update their own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students can view own attendance" ON public.attendance;

CREATE POLICY "Users can view their own attendance" ON public.attendance FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own attendance" ON public.attendance FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Students can view own attendance" ON public.attendance FOR SELECT TO authenticated USING (student_id IN (SELECT students.id FROM students WHERE students.auth_user_id = auth.uid()));

-- === PAYMENT_AUDIT_LOG ===
DROP POLICY IF EXISTS "Admin can view audit log" ON public.payment_audit_log;

CREATE POLICY "Admin can view audit log" ON public.payment_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- === USER_ROLES ===
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- === STUDENTS ===
DROP POLICY IF EXISTS "Users can insert their own students" ON public.students;
DROP POLICY IF EXISTS "Users can update their own students" ON public.students;
DROP POLICY IF EXISTS "Users can delete their own students" ON public.students;
DROP POLICY IF EXISTS "Admin can view own students" ON public.students;
DROP POLICY IF EXISTS "Students can view own record" ON public.students;
DROP POLICY IF EXISTS "Students can update own record" ON public.students;
DROP POLICY IF EXISTS "Authenticated can read student names" ON public.students;

CREATE POLICY "Users can insert their own students" ON public.students FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own students" ON public.students FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own students" ON public.students FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can view own students" ON public.students FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Students can view own record" ON public.students FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);

-- Fix #3: Replace broad student UPDATE with RPC for safe fields only (no more direct UPDATE for students)
-- Remove the old broad student self-update policy
-- CREATE POLICY "Students can update own record" is NOT recreated

-- Create a security definer function for student self-update (safe fields only)
CREATE OR REPLACE FUNCTION public.update_own_student_profile(
  _student_id uuid,
  _name text,
  _last_name text,
  _phone text,
  _birth_date date,
  _parent_name text,
  _parent_phone text,
  _profile_photo_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.students
  SET
    name = COALESCE(_name, name),
    last_name = COALESCE(_last_name, last_name),
    phone = _phone,
    birth_date = _birth_date,
    parent_name = _parent_name,
    parent_phone = _parent_phone,
    profile_photo_url = COALESCE(_profile_photo_url, profile_photo_url)
  WHERE id = _student_id
    AND auth_user_id = auth.uid();
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found or not authorized';
  END IF;
END;
$$;

-- === PENDING_PAYMENTS ===
DROP POLICY IF EXISTS "Students can view own requests" ON public.pending_payments;
DROP POLICY IF EXISTS "Admin can view pending payments" ON public.pending_payments;
DROP POLICY IF EXISTS "Admin can update pending payments" ON public.pending_payments;
DROP POLICY IF EXISTS "Students can create own payment requests" ON public.pending_payments;

CREATE POLICY "Students can view own requests" ON public.pending_payments FOR SELECT TO authenticated USING (student_id IN (SELECT students.id FROM students WHERE students.auth_user_id = auth.uid()));
CREATE POLICY "Admin can view pending payments" ON public.pending_payments FOR SELECT TO authenticated USING (admin_user_id = auth.uid());
CREATE POLICY "Admin can update pending payments" ON public.pending_payments FOR UPDATE TO authenticated USING (admin_user_id = auth.uid());
CREATE POLICY "Students can create own payment requests" ON public.pending_payments FOR INSERT TO authenticated WITH CHECK ((student_id IN (SELECT students.id FROM students WHERE students.auth_user_id = auth.uid())) AND (admin_user_id = (SELECT students.user_id FROM students WHERE students.auth_user_id = auth.uid() LIMIT 1)));

-- === PROFILES ===
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix #2: Make profile-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'profile-photos';
