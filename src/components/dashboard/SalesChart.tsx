import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function SalesChart() {
  const { data: salesData = [] } = useQuery({
    queryKey: ['sales-chart-data'],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = subDays(endDate, 6);

      const { data, error } = await supabase
        .from('sales')
        .select('total, created_at')
        .eq('status', 'concluida')
        .gte('created_at', startOfDay(startDate).toISOString())
        .lte('created_at', endOfDay(endDate).toISOString());

      if (error) throw error;

      // Group by day
      const dailySales: Record<string, number> = {};
      
      // Initialize all days
      for (let i = 6; i >= 0; i--) {
        const day = format(subDays(endDate, i), 'yyyy-MM-dd');
        dailySales[day] = 0;
      }

      // Sum sales per day
      data?.forEach(sale => {
        const day = format(new Date(sale.created_at), 'yyyy-MM-dd');
        if (dailySales[day] !== undefined) {
          dailySales[day] += Number(sale.total) || 0;
        }
      });

      return Object.entries(dailySales).map(([date, total]) => ({
        date,
        day: format(new Date(date), 'EEE', { locale: ptBR }),
        total,
      }));
    },
  });

  const chartConfig = {
    total: {
      label: 'Vendas',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <Card className="opacity-0 animate-fade-in-up stagger-8">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Vendas dos Últimos 7 Dias</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="day" 
              axisLine={false}
              tickLine={false}
              className="text-xs fill-muted-foreground"
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              className="text-xs fill-muted-foreground"
              tickFormatter={(value) => `R$${value}`}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Vendas']}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#colorTotal)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
