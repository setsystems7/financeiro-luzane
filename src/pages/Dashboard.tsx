import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTodaySales, useMonthSales, useMonthProfit } from '@/hooks/useSales';
import { useLowStockProducts } from '@/hooks/useStock';

export default function Dashboard() {
  const { data: todaySales } = useTodaySales();
  const { data: monthSales } = useMonthSales();
  const { data: monthProfit } = useMonthProfit();
  const { data: lowStockProducts = [] } = useLowStockProducts();

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <MainLayout title="Dashboard" subtitle="Visão geral do seu negócio">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-hover opacity-0 animate-fade-in-up stagger-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vendas Hoje</CardTitle>
              <ShoppingBag className="w-5 h-5 text-pink-dark" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(todaySales?.total || 0)}</p>
            </CardContent>
          </Card>

          <Card className="card-hover opacity-0 animate-fade-in-up stagger-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vendas do Mês</CardTitle>
              <DollarSign className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(monthSales?.total || 0)}</p>
            </CardContent>
          </Card>

          <Card className="card-hover opacity-0 animate-fade-in-up stagger-3">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lucro do Mês</CardTitle>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(monthProfit?.profit || 0)}</p>
            </CardContent>
          </Card>

          <Card className="card-hover opacity-0 animate-fade-in-up stagger-4">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Baixo</CardTitle>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{lowStockProducts.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="opacity-0 animate-fade-in-up stagger-5">
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Bem-vindo ao sistema de gestão Luzane. Use o menu lateral para navegar entre as funcionalidades.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
