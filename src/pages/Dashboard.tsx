import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingCart, DollarSign, TrendingUp, AlertTriangle, Users, ArrowUp, ArrowDown } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const today = new Date();
  const startOfToday = startOfDay(today).toISOString();
  const endOfToday = endOfDay(today).toISOString();
  const startOfThisMonth = startOfMonth(today).toISOString();
  const endOfThisMonth = endOfMonth(today).toISOString();

  const { data: todaySales } = useQuery({
    queryKey: ['dashboard-today-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('final_total, status')
        .gte('created_at', startOfToday)
        .lte('created_at', endOfToday)
        .eq('status', 'concluida');
      if (error) throw error;
      return data;
    },
  });

  const { data: monthSales } = useQuery({
    queryKey: ['dashboard-month-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('final_total, status')
        .gte('created_at', startOfThisMonth)
        .lte('created_at', endOfThisMonth)
        .eq('status', 'concluida');
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ['dashboard-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, is_active');
      if (error) throw error;
      return data;
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_sizes')
        .select(`
          id,
          quantity,
          size,
          products!inner(id, name, min_stock, is_active)
        `)
        .eq('products.is_active', true);
      if (error) throw error;
      
      return data?.filter((item: any) => item.quantity <= item.products.min_stock) || [];
    },
  });

  const { data: pendingFiado } = useQuery({
    queryKey: ['dashboard-pending-fiado'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiado_sales')
        .select('id, amount_pending')
        .eq('status', 'pendente');
      if (error) throw error;
      return data;
    },
  });

  const todayTotal = todaySales?.reduce((sum, sale) => sum + Number(sale.final_total), 0) || 0;
  const monthTotal = monthSales?.reduce((sum, sale) => sum + Number(sale.final_total), 0) || 0;
  const totalProducts = products?.filter(p => p.is_active)?.length || 0;
  const lowStockCount = lowStock?.length || 0;
  const totalPendingFiado = pendingFiado?.reduce((sum, f) => sum + Number(f.amount_pending), 0) || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          {format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(todayTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {todaySales?.length || 0} vendas realizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(monthTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {monthSales?.length || 0} vendas no mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos Ativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              produtos cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fiado Pendente</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPendingFiado)}</div>
            <p className="text-xs text-muted-foreground">
              {pendingFiado?.length || 0} clientes devendo
            </p>
          </CardContent>
        </Card>
      </div>

      {lowStockCount > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Produtos com Estoque Baixo ({lowStockCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {lowStock?.slice(0, 6).map((item: any) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between rounded-lg bg-card p-3 border"
                >
                  <div>
                    <p className="font-medium text-sm">{item.products.name}</p>
                    <p className="text-xs text-muted-foreground">Tam: {item.size}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-destructive">{item.quantity}</p>
                    <p className="text-xs text-muted-foreground">
                      Mín: {item.products.min_stock}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
