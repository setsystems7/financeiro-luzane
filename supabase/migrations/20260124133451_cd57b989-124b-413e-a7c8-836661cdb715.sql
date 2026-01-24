-- Limpar registros financeiros importados
DELETE FROM receivables WHERE notes LIKE '%Importado%';
DELETE FROM expenses WHERE notes LIKE '%Importado%';