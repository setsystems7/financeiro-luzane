-- Fix the incorrect foreign key constraint on fiado_payments
-- It was pointing to fiado_payments(id) instead of fiado_sales(id)

-- Drop the incorrect constraint
ALTER TABLE public.fiado_payments DROP CONSTRAINT IF EXISTS fiado_payments_fiado_sale_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE public.fiado_payments ADD CONSTRAINT fiado_payments_fiado_sale_id_fkey 
FOREIGN KEY (fiado_sale_id) REFERENCES public.fiado_sales(id) ON DELETE CASCADE;