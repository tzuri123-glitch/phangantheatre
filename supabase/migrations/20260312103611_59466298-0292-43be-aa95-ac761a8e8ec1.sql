
-- Make admin-settings bucket private
UPDATE storage.buckets SET public = false WHERE id = 'admin-settings';

-- Allow authenticated users to read from admin-settings
CREATE POLICY "Authenticated users can read admin-settings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'admin-settings');

-- Only admins can upload/update/delete in admin-settings
CREATE POLICY "Admins can upload to admin-settings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'admin-settings' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update admin-settings"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'admin-settings' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete from admin-settings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'admin-settings' AND public.has_role(auth.uid(), 'admin'));
