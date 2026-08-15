ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_discount_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_discount_check CHECK (discount >= 0);