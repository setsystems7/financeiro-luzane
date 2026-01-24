-- Apagar registros relacionados à venda #11
DELETE FROM sale_items WHERE sale_id = '5512d236-4ee9-4fe3-910c-61a9017feaf1';
DELETE FROM receivables WHERE sale_id = '5512d236-4ee9-4fe3-910c-61a9017feaf1';
DELETE FROM sales WHERE id = '5512d236-4ee9-4fe3-910c-61a9017feaf1';