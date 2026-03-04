ALTER TABLE public.students ALTER COLUMN status SET DEFAULT 'פעיל';
UPDATE public.students SET status = 'פעיל' WHERE status = 'חדש';