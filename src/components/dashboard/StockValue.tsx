import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, TrendingUp, Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StockValueData {
  totalCostValue: number;
  totalSaleValue: number;
  potentialProfit: number;
}

export function useStockValue() {
  return useQuery({
    queryKey: ['stock-value'],
    queryFn: async (): Promise<StockValueData> => {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id,
          cost_price,
          sale_price,
          product_sizes(quantity)
        `)
        .eq('is_active', true);

      if (error) throw error;

      let totalCostValue = 0;
      let totalSaleValue = 0;

      products?.forEach((product: any) => {
        const totalStock = product.product_sizes?.reduce(
          (acc: number, size: any) => acc + (size.quantity || 0),
          0
        ) || 0;

        totalCostValue += (product.cost_price || 0) * totalStock;
        totalSaleValue += (product.sale_price || 0) * totalStock;
      });

      return {
        totalCostValue,
        totalSaleValue,
        potentialProfit: totalSaleValue - totalCostValue,
      };
    },
  });
}

export function StockValue() {
  const { data, isLoading } = useStockValue();

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5 text-pink-primary" />
          Valor do Estoque
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Valor de Custo</span>
          </div>
          <span className="font-semibold text-foreground">
            {formatCurrency(data?.totalCostValue || 0)}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Valor de Venda</span>
          </div>
          <span className="font-semibold text-primary">
            {formatCurrency(data?.totalSaleValue || 0)}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Lucro Potencial</span>
          </div>
          <span className="font-semibold text-green-500">
            {formatCurrency(data?.potentialProfit || 0)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
