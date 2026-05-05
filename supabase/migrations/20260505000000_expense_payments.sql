-- Tabela de histórico de pagamentos por despesa
CREATE TABLE IF NOT EXISTS public.expense_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  interest_amount NUMERIC NOT NULL DEFAULT 0,
  paid_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage expense payments"
  ON public.expense_payments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_expense_payments_expense_id
  ON public.expense_payments(expense_id);
