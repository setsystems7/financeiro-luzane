-- Apagar registros relacionados à venda #10
DELETE FROM sale_items WHERE sale_id = 'c7a47eb8-4f39-4cd9-8144-be39d6b981f9';
DELETE FROM receivables WHERE sale_id = 'c7a47eb8-4f39-4cd9-8144-be39d6b981f9';
DELETE FROM sales WHERE id = 'c7a47eb8-4f39-4cd9-8144-be39d6b981f9';