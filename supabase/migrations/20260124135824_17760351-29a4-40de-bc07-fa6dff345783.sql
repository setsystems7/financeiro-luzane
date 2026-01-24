-- Insert initial cash balance as a receivable
INSERT INTO receivables (
  description,
  amount,
  fee,
  net_amount,
  due_date,
  is_received,
  received_date
) VALUES (
  'Caixa Inicial',
  49.00,
  0,
  49.00,
  CURRENT_DATE,
  true,
  CURRENT_DATE
);