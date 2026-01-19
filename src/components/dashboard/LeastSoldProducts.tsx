import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingDown } from 'lucide-react';

export function LeastSoldProducts() {
  const [days, setDays] = useState('60');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['least-sold-products', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      // Get all active products with their sizes
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name, product_sizes(quantity)')
        .eq('is_active', true);

      if (productsError) throw productsError;

      // Get sale items in the period
      const { data: saleItems, error: salesError } = await supabase
        .from('sale_items')
        .select(`
          product_id,
          quantity,
          sales!inner(created_at, status)
        `)
        .gte('sales.created_at', startDate.toISOString())
        .eq('sales.status', 'concluida');

      if (salesError) throw salesError;

      // Calculate sales per product
      const salesMap = new Map<string, number>();
      saleItems.forEach((item: any) => {
        if (item.product_id) {
          salesMap.set(item.product_id, (salesMap.get(item.product_id) || 0) + item.quantity);
        }
      });

      // Map products with their sales count and stock
      const productsWithSales = allProducts.map(product => {
        const totalStock = product.product_sizes?.reduce((acc: number, size: any) => acc + size.quantity, 0) || 0;
        return {
          id: product.id,
          name: product.name,
          soldQuantity: salesMap.get(product.id) || 0,
          stock: totalStock,
        };
      });

      // Sort by least sold (ascending) and return top 5
      return productsWithSales
        .sort((a, b) => a.soldQuantity - b.soldQuantity)
        .slice(0, 5);
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-destructive" />
          Peças Menos Vendidas
        </CardTitle>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="60">60 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
            <SelectItem value="180">180 dias</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Nenhum produto encontrado
          </p>
        ) : (
          <div className="space-y-3">
            {products.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Estoque: {product.stock} un
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{product.soldQuantity} un</p>
                  <p className="text-xs text-muted-foreground">vendidas</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
