-- Add sibling_id column to students table to link siblings
ALTER TABLE public.students 
ADD COLUMN sibling_id uuid REFERENCES public.students(id) ON DELETE SET NULL;