import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useLowStockProducts() {
  return useQuery({
    queryKey: ['low-stock-products'],
    queryFn: async () => {
      const { data: products, error } = await supabase.from('products').select('id, name, min_stock, product_sizes(quantity)').eq('is_active', true);
      if (error) throw error;
      const lowStockProducts = products.map((product: any) => {
        const totalStock = product.product_sizes?.reduce((acc: number, size: any) => acc + (size.quantity || 0), 0) || 0;
        return { id: product.id, name: product.name, totalStock, minStock: product.min_stock, isLow: totalStock <= product.min_stock };
      }).filter((p: any) => p.isLow);
      return lowStockProducts;
    },
  });
}
