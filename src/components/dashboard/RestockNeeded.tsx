import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function RestockNeeded() {
  const [days, setDays] = useState('30');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['restock-needed', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      // Get all active products with their sizes
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name, product_sizes(quantity)')
        .eq('is_active', true);

      if (productsError) throw productsError;

      // Get stock movements (saida) in the period
      const { data: movements, error: movementsError } = await supabase
        .from('stock_movements')
        .select('product_id, quantity, type')
        .gte('created_at', startDate.toISOString())
        .eq('type', 'saida');

      if (movementsError) throw movementsError;

      // Calculate output per product
      const outputMap = new Map<string, number>();
      movements.forEach((mov) => {
        if (mov.product_id) {
          outputMap.set(mov.product_id, (outputMap.get(mov.product_id) || 0) + mov.quantity);
        }
      });

      // Calculate days covered by current stock based on output velocity
      const daysInPeriod = parseInt(days);
      const productsWithRestock = allProducts
        .map(product => {
          const totalStock = product.product_sizes?.reduce((acc: number, size: any) => acc + size.quantity, 0) || 0;
          const totalOutput = outputMap.get(product.id) || 0;

          // Daily average output
          const dailyOutput = totalOutput / daysInPeriod;

          // Days until stock runs out (based on current velocity)
          const daysUntilEmpty = dailyOutput > 0 ? Math.floor(totalStock / dailyOutput) : 999;

          return {
            id: product.id,
            name: product.name,
            stock: totalStock,
            output: totalOutput,
            dailyOutput: dailyOutput.toFixed(1),
            daysUntilEmpty,
            urgency: daysUntilEmpty <= 7 ? 'critical' : daysUntilEmpty <= 14 ? 'warning' : 'ok',
          };
        })
        .filter(p => p.output > 0) // Only show products that had sales
        .sort((a, b) => a.daysUntilEmpty - b.daysUntilEmpty)
        .slice(0, 5);

      return productsWithRestock;
    },
  });

  const getUrgencyBadge = (urgency: string, daysValue: number) => {
    if (urgency === 'critical') {
      return (
        <Badge variant="destructive" className="text-xs">
          {daysValue} dias
        </Badge>
      );
    }
    if (urgency === 'warning') {
      return (
        <Badge variant="secondary" className="bg-warning/20 text-warning-foreground text-xs">
          {daysValue} dias
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {daysValue} dias
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-warning" />
          Precisando de Reposição
        </CardTitle>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="14">14 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="60">60 dias</SelectItem>
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
            Nenhum produto com saída no período
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-2">
              Baseado na velocidade de saída dos últimos {days} dias
            </p>
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {product.urgency === 'critical' && (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Estoque: {product.stock} un | Saída: {product.dailyOutput}/dia
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {getUrgencyBadge(product.urgency, product.daysUntilEmpty)}
                  <p className="text-xs text-muted-foreground mt-1">p/ acabar</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
