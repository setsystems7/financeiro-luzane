import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface TopProduct {
  product_name: string;
  total_quantity: number;
}

export function TopProducts() {
  const { data: topProducts = [], isLoading } = useQuery({
    queryKey: ['top-products'],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          product_name,
          quantity,
          sales!inner(created_at, status)
        `)
        .gte('sales.created_at', startOfMonth.toISOString())
        .eq('sales.status', 'concluida');

      if (error) throw error;

      // Aggregate by product name
      const productMap = new Map<string, number>();
      data.forEach((item: any) => {
        const current = productMap.get(item.product_name) || 0;
        productMap.set(item.product_name, current + item.quantity);
      });

      // Convert to array and sort
      const sorted: TopProduct[] = Array.from(productMap.entries())
        .map(([product_name, total_quantity]) => ({ product_name, total_quantity }))
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, 5);

      return sorted;
    },
  });

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Produtos Mais Vendidos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : topProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma venda registrada este mês
          </p>
        ) : (
          topProducts.map((product, index) => (
            <div key={product.product_name} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary-foreground">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{product.product_name}</p>
                <p className="text-xs text-muted-foreground">{product.total_quantity} vendidos</p>
              </div>
              <Badge variant={index === 0 ? 'pink' : 'secondary'}>
                #{index + 1}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
