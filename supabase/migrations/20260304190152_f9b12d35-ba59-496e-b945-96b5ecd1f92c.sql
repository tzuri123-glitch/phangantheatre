-- Add profile_photo_url column to students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS profile_photo_url text;

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Students can upload their own profile photo
CREATE POLICY "Students can upload own photo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.students WHERE auth_user_id = auth.uid()
  )
);

-- Students can update their own photo
CREATE POLICY "Students can update own photo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.students WHERE auth_user_id = auth.uid()
  )
);

-- Anyone can view profile photos (public bucket)
CREATE POLICY "Anyone can view profile photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'profile-photos');

-- Admin can manage all profile photos
CREATE POLICY "Admin can manage profile photos"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  public.has_role(auth.uid(), 'admin')
);