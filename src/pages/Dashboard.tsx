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
import { DashboardDrilldownDialog } from '@/components/dashboard/DashboardDrilldownDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTodaySales, useMonthSales, useMonthProfit, useSales } from '@/hooks/useSales';
import { useLowStockProducts } from '@/hooks/useStock';
import { useFinancialSummary } from '@/hooks/useFinancial';
import { useProducts } from '@/hooks/useProducts';
import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle, BarChart3, HelpCircle, Package, Calendar, Percent } from 'lucide-react';
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
  {
    title: 'O que é o Dashboard',
    icon: HelpCircle,
    tag: 'essencial',
    content: 'O Dashboard é o painel principal do sistema. Ele mostra um resumo de tudo que está acontecendo no seu negócio: vendas, estoque, despesas e alertas importantes.',
  },
  {
    title: 'Como usar o seletor de período',
    icon: Calendar,
    tag: 'essencial',
    content: 'No topo da página há um seletor de período que muda os dados dos cards:',
    steps: [
      { text: 'Clique no seletor de período no topo esquerdo (ao lado do ícone de calendário).' },
      { text: 'Escolha o período desejado: Hoje, 7 dias, 30 dias ou 90 dias.' },
      { text: 'Os cards de "Vendas no Período", "Qtd. Vendas" e "Ticket Médio" serão atualizados automaticamente.' },
    ],
  },
  {
    title: 'Como interpretar os indicadores',
    icon: BarChart3,
    content: 'Entenda o que cada card mostra:',
    tips: [
      'Vendas no Período: valor total de todas as vendas finalizadas no período selecionado.',
      'Qtd. Vendas: número de vendas concluídas no período.',
      'Ticket Médio: valor médio de cada venda (total ÷ quantidade).',
      'Estoque Baixo: quantidade de produtos com estoque abaixo do mínimo — clique para ver quais são.',
    ],
  },
  {
    title: 'Cards clicáveis',
    icon: Package,
    tag: 'dica',
    content: 'Clique no card "Estoque Baixo" para ver a lista detalhada dos produtos com estoque baixo, sem precisar ir até outra tela.',
  },
];

export default function Dashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [drilldownType, setDrilldownType] = useState<'low-stock' | null>(null);
  
  const { data: todaySales } = useTodaySales();
  const { data: monthSales } = useMonthSales();
  const { data: monthProfit } = useMonthProfit();
  const { data: lowStockProducts = [] } = useLowStockProducts();
  const { data: financialSummary } = useFinancialSummary();
  const { data: allSales = [] } = useSales();
  const { data: products = [] } = useProducts();

  // Compute profit margin
  const profitMargin = useMemo(() => {
    const completedSales = allSales.filter(s => s.status === 'concluida');
    const totalRevenue = completedSales.reduce((acc, s) => acc + Number(s.final_total), 0);
    
    // Calculate cost from sale items
    let totalCost = 0;
    completedSales.forEach(sale => {
      sale.sale_items?.forEach((item: any) => {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          totalCost += product.cost_price * item.quantity;
        }
      });
    });
    
    const grossProfit = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    
    return { grossProfit, marginPercent, totalRevenue, totalCost };
  }, [allSales, products]);

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
        {/* Period Selector integrated in KPI header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Indicadores</h2>
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
        </div>

        {/* Stats Cards — 5 columns with profit margin */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="opacity-0 animate-fade-in-up stagger-1">
            <StatsCard
              title="Vendas no Período"
              value={`R$ ${periodStats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<ShoppingBag className="w-6 h-6 text-pink-dark" />}
              variant="pink"
            />
          </div>
          <div className="opacity-0 animate-fade-in-up stagger-2">
            <StatsCard
              title="Qtd. Vendas"
              value={periodStats.count}
              icon={<DollarSign className="w-6 h-6 text-primary-foreground" />}
            />
          </div>
          <div className="opacity-0 animate-fade-in-up stagger-3">
            <StatsCard
              title="Ticket Médio"
              value={`R$ ${periodStats.ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<TrendingUp className="w-6 h-6 text-success" />}
            />
          </div>
          <div className="opacity-0 animate-fade-in-up stagger-4">
            <StatsCard
              title="Margem de Lucro"
              value={`${profitMargin.marginPercent.toFixed(1)}%`}
              icon={<Percent className="w-6 h-6 text-primary" />}
              description={`Lucro: R$ ${profitMargin.grossProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </div>
          <div className="opacity-0 animate-fade-in-up stagger-4 cursor-pointer" onClick={() => setDrilldownType('low-stock')}>
            <StatsCard
              title="Estoque Baixo"
              value={lowStockProducts.length}
              icon={<AlertTriangle className="w-6 h-6 text-warning" />}
              description="Clique para ver detalhes"
            />
          </div>
        </div>

        {/* Charts Row — 50/50 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 opacity-0 animate-fade-in-up stagger-5">
          <SalesChart />
          <TopProducts />
        </div>

        {/* Restock, Least Sold and Stock Value Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 opacity-0 animate-fade-in-up stagger-6">
          <RestockNeeded />
          <LeastSoldProducts />
          <StockValue />
        </div>

        {/* Alerts grouped */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
          <ExchangesSummary />
          <OverdueExpensesAlert />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
          <RecentSales />
          <LowStockAlert />
        </div>
      </div>

      {/* Drilldown Dialog */}
      <DashboardDrilldownDialog
        open={!!drilldownType}
        onOpenChange={(open) => !open && setDrilldownType(null)}
        type={drilldownType}
        lowStockProducts={lowStockProducts}
      />
    </MainLayout>
  );
}
