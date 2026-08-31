ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS covered_month text;

UPDATE public.payments
SET covered_month = to_char(
  CASE WHEN EXTRACT(DAY FROM payment_date) >= 25
       THEN (payment_date + INTERVAL '1 month')
       ELSE payment_date::timestamp END, 'YYYY-MM')
WHERE covered_month IS NULL AND payment_type = 'חודשי';

ALTER TABLE public.payments
  ADD CONSTRAINT payments_covered_month_format
  CHECK (covered_month IS NULL OR covered_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');