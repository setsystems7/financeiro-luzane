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
import { OverdueExpensesAlert } from '@/components/dashboard/OverdueExpensesAlert';
import { useTodaySales, useMonthSales, useMonthProfit } from '@/hooks/useSales';
import { useLowStockProducts } from '@/hooks/useStock';
import { useFinancialSummary } from '@/hooks/useFinancial';
import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle, BarChart3, HelpCircle, Package } from 'lucide-react';
import { type SupportSection } from '@/components/layout/SupportButton';

const dashboardSupportSections: SupportSection[] = [
  { title: 'O que é o Dashboard', icon: HelpCircle, content: 'O Dashboard é a tela principal do sistema. Ele mostra um resumo geral do seu negócio: vendas do dia e do mês, lucro, alertas de estoque baixo, produtos mais vendidos e muito mais.' },
  { title: 'Como interpretar os indicadores', icon: BarChart3, content: '• Vendas Hoje: valor total de vendas realizadas hoje.\n• Vendas do Mês: acumulado de vendas no mês atual.\n• Lucro do Mês: diferença entre receita e custos dos produtos vendidos.\n• Estoque Baixo: quantidade de produtos abaixo do estoque mínimo.' },
  { title: 'Alertas de estoque baixo', icon: Package, content: 'O card "Estoque Baixo" mostra quantos produtos estão com estoque abaixo do mínimo configurado. Clique na seção de alertas para ver a lista completa e tomar ação.' },
  { title: 'Alertas de despesas vencidas', icon: AlertTriangle, content: 'A seção de despesas vencidas mostra contas a pagar que já passaram do vencimento. É importante mantê-las em dia para um controle financeiro saudável.' },
  { title: 'Resumo de vendas e trocas', icon: ShoppingBag, content: 'O gráfico de vendas mostra a evolução dos últimos dias. O resumo de trocas mostra quantas trocas foram feitas e o valor envolvido. Os produtos mais vendidos ajudam a identificar seus itens mais populares.' },
];

export default function Dashboard() {
  const { data: todaySales } = useTodaySales();
  const { data: monthSales } = useMonthSales();
  const { data: monthProfit } = useMonthProfit();
  const { data: lowStockProducts = [] } = useLowStockProducts();
  const { data: financialSummary } = useFinancialSummary();

  return (
    <MainLayout title="Dashboard" subtitle="Visão geral do seu negócio" supportContent={{ moduleName: 'Dashboard', sections: dashboardSupportSections }}>
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

        {/* Overdue Expenses Alert */}
        <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '0.75s' }}>
          <OverdueExpensesAlert />
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
