-- Create expense_categories table
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view expense_categories" 
ON public.expense_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert expense_categories" 
ON public.expense_categories 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update expense_categories" 
ON public.expense_categories 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete expense_categories" 
ON public.expense_categories 
FOR DELETE 
USING (true);

-- Insert default categories
INSERT INTO public.expense_categories (name) VALUES
  ('Fornecedor'),
  ('Aluguel'),
  ('Energia'),
  ('Água'),
  ('Internet'),
  ('Outros');