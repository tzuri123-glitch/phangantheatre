-- Add discount column to payments table
ALTER TABLE public.payments 
ADD COLUMN discount numeric DEFAULT 0 CHECK (discount >= 0 AND discount <= 100);