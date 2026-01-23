-- Remove a taxa de 1.5% que foi adicionada aos preços de venda
UPDATE public.products
SET sale_price = ROUND((sale_price / 1.015)::numeric, 2)
WHERE is_active = true;