
-- Table for pending attendance requests from students
CREATE TABLE public.pending_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  requesting_user_id uuid NOT NULL,
  admin_user_id uuid NOT NULL,
  class_name text NOT NULL,
  requested_date date NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pending_attendance ENABLE ROW LEVEL SECURITY;

-- Students can create their own attendance requests
CREATE POLICY "Students can create attendance requests" ON public.pending_attendance
  FOR INSERT TO authenticated
  WITH CHECK (requesting_user_id = auth.uid());

-- Students can view their own requests
CREATE POLICY "Students can view own attendance requests" ON public.pending_attendance
  FOR SELECT TO authenticated
  USING (requesting_user_id = auth.uid());

-- Admin can view attendance requests for their students
CREATE POLICY "Admin can view attendance requests" ON public.pending_attendance
  FOR SELECT TO authenticated
  USING (admin_user_id = auth.uid());

-- Admin can update attendance requests
CREATE POLICY "Admin can update attendance requests" ON public.pending_attendance
  FOR UPDATE TO authenticated
  USING (admin_user_id = auth.uid());
