CREATE TABLE public.kiosk_settings (
  user_id uuid PRIMARY KEY,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kiosk_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages own kiosk settings"
ON public.kiosk_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);