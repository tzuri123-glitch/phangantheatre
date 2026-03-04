
-- Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can read their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can manage all roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Add auth_user_id to students table to link student records to auth users
ALTER TABLE public.students ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Students can view their own student record
CREATE POLICY "Students can view own record" ON public.students
  FOR SELECT USING (auth.uid() = auth_user_id);

-- Students can view their own attendance
CREATE POLICY "Students can view own attendance" ON public.attendance
  FOR SELECT USING (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
  );

-- Students can view their own payments
CREATE POLICY "Students can view own payments" ON public.payments
  FOR SELECT USING (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
  );

-- Auto-assign 'student' role on signup (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Default new users to 'student' role
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'student');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();
