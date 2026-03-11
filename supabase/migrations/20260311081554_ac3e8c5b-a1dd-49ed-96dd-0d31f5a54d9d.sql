
CREATE TABLE public.pending_siblings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_user_id uuid NOT NULL,
  admin_user_id uuid NOT NULL,
  existing_student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  sibling_name text NOT NULL,
  sibling_birth_date date,
  sibling_phone text,
  sibling_class text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.pending_siblings ENABLE ROW LEVEL SECURITY;

-- Students can create their own sibling requests
CREATE POLICY "Students can create sibling requests"
ON public.pending_siblings FOR INSERT TO authenticated
WITH CHECK (requesting_user_id = auth.uid());

-- Students can view their own requests
CREATE POLICY "Students can view own sibling requests"
ON public.pending_siblings FOR SELECT TO authenticated
USING (requesting_user_id = auth.uid());

-- Admin can view all sibling requests
CREATE POLICY "Admin can view sibling requests"
ON public.pending_siblings FOR SELECT TO authenticated
USING (admin_user_id = auth.uid());

-- Admin can update sibling requests
CREATE POLICY "Admin can update sibling requests"
ON public.pending_siblings FOR UPDATE TO authenticated
USING (admin_user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_siblings;
