-- Limpar dados de teste para iniciar produção
-- Ordem importante devido às dependências

-- Primeiro, limpar tabelas dependentes
DELETE FROM stock_movements;
DELETE FROM sale_items;
DELETE FROM exchange_items;
DELETE FROM fiado_sale_items;
DELETE FROM fiado_payments;
DELETE FROM receivables;
DELETE FROM price_history;
DELETE FROM demand_forecasts;
DELETE FROM purchase_suggestions;
DELETE FROM restock_settings;

-- Depois, limpar tabelas principais
DELETE FROM exchanges;
DELETE FROM fiado_sales;
DELETE FROM sales;
DELETE FROM expenses;
DELETE FROM product_sizes;
DELETE FROM products;

-- Por fim, limpar tabelas de referência (opcional - manter se já cadastrou categorias/cores/fornecedores reais)
DELETE FROM categories;
DELETE FROM colors;
DELETE FROM suppliers;

-- Limpar conversas AI (se houver)
DELETE FROM ai_conversations;