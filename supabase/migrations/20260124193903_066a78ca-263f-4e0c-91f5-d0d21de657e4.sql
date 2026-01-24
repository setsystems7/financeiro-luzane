-- Consolidar tamanhos duplicados: atualiza o registro mais antigo com a soma das quantidades
-- e remove os duplicados mantendo referências intactas

-- 1. Atualizar o registro mais antigo de cada grupo com a soma das quantidades
WITH duplicates AS (
  SELECT 
    product_id,
    size,
    MIN(id::text)::uuid as keep_id,
    SUM(quantity) as total_quantity,
    (array_agg(barcode ORDER BY barcode NULLS LAST))[1] as first_barcode
  FROM product_sizes
  GROUP BY product_id, size
  HAVING COUNT(*) > 1
)
UPDATE product_sizes ps
SET 
  quantity = d.total_quantity,
  barcode = COALESCE(ps.barcode, d.first_barcode),
  updated_at = now()
FROM duplicates d
WHERE ps.id = d.keep_id;

-- 2. Atualizar referências em stock_movements
WITH duplicates AS (
  SELECT 
    product_id,
    size,
    MIN(id::text)::uuid as keep_id
  FROM product_sizes
  GROUP BY product_id, size
  HAVING COUNT(*) > 1
),
ids_to_update AS (
  SELECT ps.id as old_id, d.keep_id as new_id
  FROM product_sizes ps
  JOIN duplicates d ON ps.product_id = d.product_id AND ps.size = d.size
  WHERE ps.id != d.keep_id
)
UPDATE stock_movements sm
SET product_size_id = iu.new_id
FROM ids_to_update iu
WHERE sm.product_size_id = iu.old_id;

-- 3. Atualizar referências em sale_items
WITH duplicates AS (
  SELECT 
    product_id,
    size,
    MIN(id::text)::uuid as keep_id
  FROM product_sizes
  GROUP BY product_id, size
  HAVING COUNT(*) > 1
),
ids_to_update AS (
  SELECT ps.id as old_id, d.keep_id as new_id
  FROM product_sizes ps
  JOIN duplicates d ON ps.product_id = d.product_id AND ps.size = d.size
  WHERE ps.id != d.keep_id
)
UPDATE sale_items si
SET product_size_id = iu.new_id
FROM ids_to_update iu
WHERE si.product_size_id = iu.old_id;

-- 4. Atualizar referências em fiado_sale_items
WITH duplicates AS (
  SELECT 
    product_id,
    size,
    MIN(id::text)::uuid as keep_id
  FROM product_sizes
  GROUP BY product_id, size
  HAVING COUNT(*) > 1
),
ids_to_update AS (
  SELECT ps.id as old_id, d.keep_id as new_id
  FROM product_sizes ps
  JOIN duplicates d ON ps.product_id = d.product_id AND ps.size = d.size
  WHERE ps.id != d.keep_id
)
UPDATE fiado_sale_items fsi
SET product_size_id = iu.new_id
FROM ids_to_update iu
WHERE fsi.product_size_id = iu.old_id;

-- 5. Atualizar referências em exchange_items
WITH duplicates AS (
  SELECT 
    product_id,
    size,
    MIN(id::text)::uuid as keep_id
  FROM product_sizes
  GROUP BY product_id, size
  HAVING COUNT(*) > 1
),
ids_to_update AS (
  SELECT ps.id as old_id, d.keep_id as new_id
  FROM product_sizes ps
  JOIN duplicates d ON ps.product_id = d.product_id AND ps.size = d.size
  WHERE ps.id != d.keep_id
)
UPDATE exchange_items ei
SET product_size_id = iu.new_id
FROM ids_to_update iu
WHERE ei.product_size_id = iu.old_id;

-- 6. Deletar os registros duplicados (mantendo apenas o mais antigo)
WITH duplicates AS (
  SELECT 
    product_id,
    size,
    MIN(id::text)::uuid as keep_id
  FROM product_sizes
  GROUP BY product_id, size
  HAVING COUNT(*) > 1
)
DELETE FROM product_sizes ps
WHERE EXISTS (
  SELECT 1 FROM duplicates d
  WHERE d.product_id = ps.product_id
  AND d.size = ps.size
  AND ps.id != d.keep_id
);