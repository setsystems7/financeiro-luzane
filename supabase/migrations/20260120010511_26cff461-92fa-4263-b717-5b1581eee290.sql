-- Limpar dados transacionais (mantendo estrutura e tabelas de referência vazias)
TRUNCATE TABLE 
  fiado_payments,
  fiado_sale_items,
  fiado_sales,
  exchange_items,
  exchanges,
  receivables,
  sale_items,
  sales,
  stock_movements,
  expenses,
  price_history,
  demand_forecasts,
  purchase_suggestions,
  restock_settings,
  ai_conversations,
  product_sizes,
  products,
  categories,
  colors,
  suppliers
CASCADE;