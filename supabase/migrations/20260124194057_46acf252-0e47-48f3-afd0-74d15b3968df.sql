-- Adicionar constraint UNIQUE para prevenir duplicatas de tamanho por produto
ALTER TABLE product_sizes 
ADD CONSTRAINT unique_product_size UNIQUE (product_id, size);