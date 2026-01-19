import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle, CreditCard, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useTodaySales, useMonthSales, useMonthProfit, useRecentSales } from '@/hooks/useSales';
import { useLowStockProducts } from '@/hooks/useStock';
import { useFinancialSummary } from '@/hooks/useFinancial';
import { useProducts } from '@/hooks/useProducts';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { TopProductsChart } from '@/components/dashboard/TopProductsChart';
import { LowStockAlert } from '@/components/dashboard/LowStockAlert';
import { RecentSalesTable } from '@/components/dashboard/RecentSalesTable';

export default function Dashboard() {
  const { data: todaySales } = useTodaySales();
  const { data: monthSales } = useMonthSales();
  const { data: monthProfit } = useMonthProfit();
  const { data: lowStockProducts = [] } = useLowStockProducts();
  const { data: recentSales = [] } = useRecentSales(5);
  const { data: financialSummary } = useFinancialSummary();
  const { data: products = [] } = useProducts();

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.is_active).length;

  return (
    <MainLayout title="Dashboard" subtitle="Visão geral do seu negócio">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Vendas Hoje"
            value={formatCurrency(todaySales?.total || 0)}
            icon={<ShoppingBag className="w-6 h-6 text-pink-500" />}
            description={`${todaySales?.count || 0} vendas realizadas`}
            variant="pink"
            className="opacity-0 animate-fade-in-up stagger-1"
          />

          <StatsCard
            title="Vendas do Mês"
            value={formatCurrency(monthSales?.total || 0)}
            icon={<DollarSign className="w-6 h-6 text-primary" />}
            description={`${monthSales?.count || 0} vendas no mês`}
            className="opacity-0 animate-fade-in-up stagger-2"
          />

          <StatsCard
            title="Lucro do Mês"
            value={formatCurrency(monthProfit?.profit || 0)}
            icon={<TrendingUp className="w-6 h-6 text-green-500" />}
            trend={monthProfit?.profit ? { value: 12.5, isPositive: true } : undefined}
            className="opacity-0 animate-fade-in-up stagger-3"
          />

          <StatsCard
            title="Estoque Baixo"
            value={lowStockProducts.length}
            icon={<AlertTriangle className="w-6 h-6 text-amber-500" />}
            description="Produtos precisam reposição"
            className="opacity-0 animate-fade-in-up stagger-4"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="opacity-0 animate-fade-in-up stagger-5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">A Receber</p>
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(financialSummary?.totalReceivable || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <ArrowUpRight className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">A Pagar</p>
                  <p className="text-2xl font-bold text-red-500">
                    {formatCurrency(financialSummary?.totalPayable || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <ArrowDownRight className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-7">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Produtos Cadastrados</p>
                  <p className="text-2xl font-bold">{activeProducts}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SalesChart />
          <TopProductsChart />
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LowStockAlert products={lowStockProducts} />
          <RecentSalesTable sales={recentSales} />
        </div>
      </div>
    </MainLayout>
  );
}
