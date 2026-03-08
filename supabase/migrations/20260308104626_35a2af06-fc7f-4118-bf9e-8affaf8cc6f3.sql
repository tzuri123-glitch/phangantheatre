
-- Add RLS policy for storage.objects to allow access to profile-photos bucket
-- Admins can access all photos for students they own
-- Students can access their own photos

CREATE POLICY "Admin can view student profile photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Students can view own profile photo"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.students WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Students can upload own profile photo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.students WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Students can update own profile photo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.students WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Admin can manage student profile photos"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND has_role(auth.uid(), 'admin'::app_role)
);
