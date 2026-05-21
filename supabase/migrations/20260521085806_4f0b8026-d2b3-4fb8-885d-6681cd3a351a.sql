ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS subscription_frequency text;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS subscription_frequency text;