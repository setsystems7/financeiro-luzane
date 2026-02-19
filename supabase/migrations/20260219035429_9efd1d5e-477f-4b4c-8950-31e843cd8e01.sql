
-- Add interest tracking columns to expenses
ALTER TABLE public.expenses ADD COLUMN interest_amount numeric DEFAULT 0;
ALTER TABLE public.expenses ADD COLUMN amount_paid numeric DEFAULT NULL;
