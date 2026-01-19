import { MainLayout } from '@/components/layout/MainLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { TopProducts } from '@/components/dashboard/TopProducts';
import { LowStockAlert } from '@/components/dashboard/LowStockAlert';
import { RecentSales } from '@/components/dashboard/RecentSales';
import { LeastSoldProducts } from '@/components/dashboard/LeastSoldProducts';
import { RestockNeeded } from '@/components/dashboard/RestockNeeded';
import { ExchangesSummary } from '@/components/dashboard/ExchangesSummary';
import { StockValue } from '@/components/dashboard/StockValue';
import { useTodaySales, useMonthSales, useMonthProfit } from '@/hooks/useSales';
import { useLowStockProducts } from '@/hooks/useStock';
import { useFinancialSummary } from '@/hooks/useFinancial';
import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const { data: todaySales } = useTodaySales();
  const { data: monthSales } = useMonthSales();
  const { data: monthProfit } = useMonthProfit();
  const { data: lowStockProducts = [] } = useLowStockProducts();
  const { data: financialSummary } = useFinancialSummary();

  return (
    <MainLayout title="Dashboard" subtitle="Visão geral do seu negócio">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="opacity-0 animate-fade-in-up stagger-1">
            <StatsCard
              title="Vendas Hoje"
              value={`R$ ${(todaySales?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<ShoppingBag className="w-6 h-6 text-pink-dark" />}
              variant="pink"
            />
          </div>
          <div className="opacity-0 animate-fade-in-up stagger-2">
            <StatsCard
              title="Vendas do Mês"
              value={`R$ ${(monthSales?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<DollarSign className="w-6 h-6 text-primary-foreground" />}
            />
          </div>
          <div className="opacity-0 animate-fade-in-up stagger-3">
            <StatsCard
              title="Lucro do Mês"
              value={`R$ ${(monthProfit?.profit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<TrendingUp className="w-6 h-6 text-success" />}
            />
          </div>
          <div className="opacity-0 animate-fade-in-up stagger-4">
            <StatsCard
              title="Estoque Baixo"
              value={lowStockProducts.length}
              icon={<AlertTriangle className="w-6 h-6 text-warning" />}
            />
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 opacity-0 animate-fade-in-up stagger-5">
          <SalesChart />
          <TopProducts />
        </div>

        {/* Restock, Least Sold and Stock Value Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 opacity-0 animate-fade-in-up stagger-6">
          <RestockNeeded />
          <LeastSoldProducts />
          <StockValue />
        </div>

        {/* Exchanges Summary */}
        <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
          <ExchangesSummary />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
          <RecentSales />
          <LowStockAlert />
        </div>
      </div>
    </MainLayout>
  );
}
