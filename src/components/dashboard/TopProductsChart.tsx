import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth } from 'date-fns';

export function TopProductsChart() {
  const { data: topProducts = [] } = useQuery({
    queryKey: ['top-products-chart'],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const { data: salesData, error } = await supabase
        .from('sale_items')
        .select(`
          quantity,
          product_id,
          products!inner(name),
          sales!inner(created_at, status)
        `)
        .eq('sales.status', 'concluida')
        .gte('sales.created_at', monthStart.toISOString())
        .lte('sales.created_at', monthEnd.toISOString());

      if (error) throw error;

      // Group by product
      const productSales: Record<string, { name: string; quantity: number }> = {};

      salesData?.forEach(item => {
        const productId = item.product_id;
        const productName = (item.products as any)?.name || 'Produto';
        
        if (!productSales[productId]) {
          productSales[productId] = { name: productName, quantity: 0 };
        }
        productSales[productId].quantity += item.quantity;
      });

      // Sort by quantity and take top 5
      return Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map(p => ({
          ...p,
          name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        }));
    },
  });

  const chartConfig = {
    quantity: {
      label: 'Quantidade',
      color: 'hsl(var(--pink-dark))',
    },
  };

  return (
    <Card className="opacity-0 animate-fade-in-up stagger-9">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Produtos Mais Vendidos</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={topProducts} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
            <XAxis 
              type="number"
              axisLine={false}
              tickLine={false}
              className="text-xs fill-muted-foreground"
            />
            <YAxis 
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              className="text-xs fill-muted-foreground"
              width={100}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              formatter={(value: number) => [value, 'Unidades']}
            />
            <Bar
              dataKey="quantity"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
