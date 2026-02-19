-- Remover recebíveis de teste criados hoje
DELETE FROM receivables WHERE created_at::date = CURRENT_DATE;

-- Remover movimentações de estoque de teste criadas hoje
DELETE FROM stock_movements WHERE created_at::date = CURRENT_DATE;