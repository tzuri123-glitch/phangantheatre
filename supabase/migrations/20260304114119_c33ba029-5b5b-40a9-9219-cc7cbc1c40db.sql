
-- Storage bucket for payment proofs (photos of cash payments)
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);

-- Storage bucket for admin settings (PromptPay QR image etc)
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-settings', 'admin-settings', true);

-- Add payment_proof_url to payments table
ALTER TABLE public.payments ADD COLUMN payment_proof_url text;

-- RLS for payment-proofs bucket: authenticated users can upload
CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

-- Users can view their own payment proofs
CREATE POLICY "Users can view payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs');

-- Admin can upload to admin-settings
CREATE POLICY "Admin can upload settings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'admin-settings' AND public.has_role(auth.uid(), 'admin'));

-- Anyone authenticated can view admin-settings (to see PromptPay QR)
CREATE POLICY "Anyone can view admin settings"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'admin-settings');

-- Admin can update/delete admin-settings
CREATE POLICY "Admin can manage settings"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'admin-settings' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete settings"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'admin-settings' AND public.has_role(auth.uid(), 'admin'));
