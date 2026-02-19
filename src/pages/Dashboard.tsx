import { useState, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTodaySales, useMonthSales, useMonthProfit, useSales } from '@/hooks/useSales';
import { useLowStockProducts } from '@/hooks/useStock';
import { useFinancialSummary } from '@/hooks/useFinancial';
import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle, BarChart3, HelpCircle, Package, Calendar } from 'lucide-react';
import { type SupportSection } from '@/components/layout/SupportButton';
import { subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

type DashboardPeriod = 'today' | '7d' | '30d' | '90d';

const periodOptions = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
];

const dashboardSupportSections: SupportSection[] = [
  { title: 'O que é o Dashboard', icon: HelpCircle, content: 'O Dashboard é a tela principal do sistema. Ele mostra um resumo geral do seu negócio: vendas do dia e do mês, lucro, alertas de estoque baixo, produtos mais vendidos e muito mais.' },
  { title: 'Como interpretar os indicadores', icon: BarChart3, content: '• Vendas Hoje: valor total de vendas realizadas hoje.\n• Vendas do Mês: acumulado de vendas no mês atual.\n• Lucro do Mês: diferença entre receita e custos dos produtos vendidos.\n• Estoque Baixo: quantidade de produtos abaixo do estoque mínimo.' },
  { title: 'Seletor de período', icon: Calendar, content: 'Use o seletor no topo para alterar o período dos indicadores: Hoje, 7 dias, 30 dias ou 90 dias. Os cards mostram a variação percentual comparando com o período anterior equivalente.' },
  { title: 'Alertas de estoque baixo', icon: Package, content: 'O card "Estoque Baixo" mostra quantos produtos estão com estoque abaixo do mínimo configurado. Clique na seção de alertas para ver a lista completa e tomar ação.' },
  { title: 'Alertas de despesas vencidas', icon: AlertTriangle, content: 'A seção de despesas vencidas mostra contas a pagar que já passaram do vencimento. É importante mantê-las em dia para um controle financeiro saudável.' },
  { title: 'Resumo de vendas e trocas', icon: ShoppingBag, content: 'O gráfico de vendas mostra a evolução dos últimos dias. O resumo de trocas mostra quantas trocas foram feitas e o valor envolvido. Os produtos mais vendidos ajudam a identificar seus itens mais populares.' },
];

export default function Dashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  
  const { data: todaySales } = useTodaySales();
  const { data: monthSales } = useMonthSales();
  const { data: monthProfit } = useMonthProfit();
  const { data: lowStockProducts = [] } = useLowStockProducts();
  const { data: financialSummary } = useFinancialSummary();
  const { data: allSales = [] } = useSales();

  // Compute period-based stats with trends
  const periodStats = useMemo(() => {
    const now = new Date();
    let periodDays: number;
    switch (period) {
      case 'today': periodDays = 1; break;
      case '7d': periodDays = 7; break;
      case '30d': periodDays = 30; break;
      case '90d': periodDays = 90; break;
    }

    const currentStart = subDays(now, periodDays);
    const previousStart = subDays(currentStart, periodDays);

    const completedSales = allSales.filter(s => s.status === 'concluida');

    const currentSales = completedSales.filter(s =>
      isWithinInterval(new Date(s.created_at), { start: startOfDay(currentStart), end: endOfDay(now) })
    );
    const previousSales = completedSales.filter(s =>
      isWithinInterval(new Date(s.created_at), { start: startOfDay(previousStart), end: endOfDay(currentStart) })
    );

    const currentRevenue = currentSales.reduce((acc, s) => acc + Number(s.final_total), 0);
    const previousRevenue = previousSales.reduce((acc, s) => acc + Number(s.final_total), 0);

    const currentCount = currentSales.length;
    const previousCount = previousSales.length;

    const currentTicket = currentCount > 0 ? currentRevenue / currentCount : 0;
    const previousTicket = previousCount > 0 ? previousRevenue / previousCount : 0;

    const calcTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? { value: 100, isPositive: true } : undefined;
      const change = ((current - previous) / previous) * 100;
      return { value: Math.abs(Math.round(change)), isPositive: change >= 0 };
    };

    return {
      revenue: currentRevenue,
      revenueTrend: calcTrend(currentRevenue, previousRevenue),
      count: currentCount,
      countTrend: calcTrend(currentCount, previousCount),
      ticket: currentTicket,
      ticketTrend: calcTrend(currentTicket, previousTicket),
    };
  }, [allSales, period]);

  return (
    <MainLayout title="Dashboard" subtitle="Visão geral do seu negócio" supportContent={{ moduleName: 'Dashboard', sections: dashboardSupportSections }}>
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={period} onValueChange={(v) => setPeriod(v as DashboardPeriod)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="opacity-0 animate-fade-in-up stagger-1">
            <StatsCard
              title="Vendas no Período"
              value={`R$ ${periodStats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<ShoppingBag className="w-6 h-6 text-pink-dark" />}
              variant="pink"
              trend={periodStats.revenueTrend}
            />
          </div>
          <div className="opacity-0 animate-fade-in-up stagger-2">
            <StatsCard
              title="Qtd. Vendas"
              value={periodStats.count}
              icon={<DollarSign className="w-6 h-6 text-primary-foreground" />}
              trend={periodStats.countTrend}
            />
          </div>
          <div className="opacity-0 animate-fade-in-up stagger-3">
            <StatsCard
              title="Ticket Médio"
              value={`R$ ${periodStats.ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<TrendingUp className="w-6 h-6 text-success" />}
              trend={periodStats.ticketTrend}
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
