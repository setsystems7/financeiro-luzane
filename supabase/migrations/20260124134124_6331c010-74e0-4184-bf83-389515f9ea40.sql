-- Adicionar campos de recorrência na tabela expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_months integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS parent_expense_id uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurrence_index integer DEFAULT NULL;

-- Criar função para atualizar status de despesas vencidas
CREATE OR REPLACE FUNCTION update_overdue_expenses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE expenses
  SET status = 'vencido'
  WHERE status = 'pendente'
    AND due_date < CURRENT_DATE;
END;
$$;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_expenses_due_date_status ON expenses(due_date, status);