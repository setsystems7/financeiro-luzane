import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip
} from 'recharts';
import {
  BarChart3, FileSpreadsheet, Package, TrendingUp, TrendingDown,
  Download, DollarSign, ShoppingCart, AlertTriangle, Clock,
  Calendar, ArrowUp, ArrowDown, Minus, HelpCircle
} from 'lucide-react';
import { type SupportSection } from '@/components/layout/SupportButton';
import { toast } from 'sonner';
import { useProducts } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';
import { useStockMovements } from '@/hooks/useStock';
import { useExpenses, useReceivables } from '@/hooks/useFinancial';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

type PeriodFilter = '7d' | '30d' | '90d' | 'month' | 'all';

const periodOptions = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'all', label: 'Todo período' },
];

const PIE_COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const paymentMethodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_debito: 'Débito',
  cartao_credito: 'Crédito',
  crediario: 'Crediário',
};

export default function Reports() {
  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [activeTab, setActiveTab] = useState('sales');

  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: sales = [], isLoading: salesLoading } = useSales();
  const { data: movements = [], isLoading: movementsLoading } = useStockMovements();
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses();
  const { data: receivables = [], isLoading: receivablesLoading } = useReceivables();

  const isLoading = productsLoading || salesLoading || movementsLoading || expensesLoading || receivablesLoading;

  // Filter data by period
  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case '7d': return { start: subDays(now, 7), end: now };
      case '30d': return { start: subDays(now, 30), end: now };
      case '90d': return { start: subDays(now, 90), end: now };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      default: return null;
    }
  };

  const filterByPeriod = <T extends { created_at: string }>(data: T[]) => {
    const range = getDateRange();
    if (!range) return data;
    return data.filter(item =>
      isWithinInterval(new Date(item.created_at), { start: range.start, end: range.end })
    );
  };

  // Sales Report Data
  const salesReport = useMemo(() => {
    const filteredSales = filterByPeriod(sales).filter(s => s.status === 'concluida');

    const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.final_total), 0);
    const totalDiscount = filteredSales.reduce((acc, s) => acc + Number(s.discount || 0), 0);
    const averageTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

    // By payment method
    const byPaymentMethod = filteredSales.reduce((acc, s) => {
      const method = s.payment_method;
      if (!acc[method]) acc[method] = { count: 0, total: 0 };
      acc[method].count++;
      acc[method].total += Number(s.final_total);
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    // Top selling products
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    filteredSales.forEach(sale => {
      sale.sale_items?.forEach((item: any) => {
        const key = item.product_name;
        if (!productSales[key]) productSales[key] = { name: key, quantity: 0, revenue: 0 };
        productSales[key].quantity += item.quantity;
        productSales[key].revenue += Number(item.total);
      });
    });
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Daily data for bar chart
    const dailyData: Record<string, number> = {};
    filteredSales.forEach(sale => {
      const day = format(new Date(sale.created_at), 'dd/MM', { locale: ptBR });
      dailyData[day] = (dailyData[day] || 0) + Number(sale.final_total);
    });
    const chartData = Object.entries(dailyData).map(([date, total]) => ({ date, total }));

    // Pie chart data for payment methods
    const pieData = Object.entries(byPaymentMethod).map(([method, data]) => ({
      name: paymentMethodLabels[method] || method,
      value: data.total,
      count: data.count,
    }));

    return {
      sales: filteredSales,
      totalRevenue,
      totalDiscount,
      averageTicket,
      count: filteredSales.length,
      byPaymentMethod,
      topProducts,
      chartData,
      pieData,
    };
  }, [sales, period]);

  // Stock Report Data
  const stockReport = useMemo(() => {
    const totalProducts = products.length;
    const totalStock = products.reduce((acc, p) =>
      acc + p.sizes.reduce((sum, s) => sum + s.quantity, 0), 0
    );
    const stockValue = products.reduce((acc, p) => {
      const productStock = p.sizes.reduce((sum, s) => sum + s.quantity, 0);
      return acc + (productStock * p.cost_price);
    }, 0);
    const stockSaleValue = products.reduce((acc, p) => {
      const productStock = p.sizes.reduce((sum, s) => sum + s.quantity, 0);
      return acc + (productStock * p.sale_price);
    }, 0);

    const lowStockProducts = products.filter(p => {
      const total = p.sizes.reduce((sum, s) => sum + s.quantity, 0);
      return total <= p.min_stock && total > 0;
    });

    const outOfStockProducts = products.filter(p => {
      const total = p.sizes.reduce((sum, s) => sum + s.quantity, 0);
      return total === 0;
    });

    const filteredMovements = filterByPeriod(movements);
    const entries = filteredMovements.filter(m => m.type === 'entrada');
    const exits = filteredMovements.filter(m => m.type === 'saida');
    const adjustments = filteredMovements.filter(m => m.type === 'ajuste');

    return {
      totalProducts,
      totalStock,
      stockValue,
      stockSaleValue,
      potentialProfit: stockSaleValue - stockValue,
      lowStockProducts,
      outOfStockProducts,
      movements: filteredMovements,
      entries: entries.reduce((acc, m) => acc + m.quantity, 0),
      exits: exits.reduce((acc, m) => acc + m.quantity, 0),
      adjustments: adjustments.length,
    };
  }, [products, movements, period]);

  // Financial Report Data
  const financialReport = useMemo(() => {
    const filteredReceivables = filterByPeriod(receivables);
    const filteredExpenses = filterByPeriod(expenses);

    const totalReceivables = filteredReceivables.reduce((acc, r) => acc + Number(r.amount), 0);
    const receivedAmount = filteredReceivables
      .filter(r => r.is_received)
      .reduce((acc, r) => acc + Number(r.net_amount), 0);
    const pendingReceivables = filteredReceivables
      .filter(r => !r.is_received)
      .reduce((acc, r) => acc + Number(r.amount), 0);

    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const paidExpenses = filteredExpenses
      .filter(e => e.status === 'pago')
      .reduce((acc, e) => acc + Number(e.amount), 0);
    const pendingExpenses = filteredExpenses
      .filter(e => e.status === 'pendente')
      .reduce((acc, e) => acc + Number(e.amount), 0);
    const overdueExpenses = filteredExpenses
      .filter(e => e.status === 'vencido')
      .reduce((acc, e) => acc + Number(e.amount), 0);
    const totalInterest = filteredExpenses.reduce((acc, e) => acc + Number(e.interest_amount || 0), 0);

    const netCashFlow = receivedAmount - paidExpenses;

    const filteredSales = sales.filter(s => {
      if (!getDateRange()) return true;
      const range = getDateRange()!;
      return isWithinInterval(new Date(s.created_at), { start: range.start, end: range.end });
    });
    const totalDiscounts = filteredSales.reduce((acc, s) => acc + Number(s.discount || 0), 0);

    return {
      totalReceivables,
      receivedAmount,
      pendingReceivables,
      totalExpenses,
      paidExpenses,
      pendingExpenses,
      overdueExpenses,
      netCashFlow,
      totalDiscounts,
      totalInterest,
      receivables: filteredReceivables,
      expenses: filteredExpenses,
    };
  }, [receivables, expenses, sales, period]);

  // Aging Report
  const agingReport = useMemo(() => {
    const now = new Date();
    const productExits: Record<string, number> = {};
    movements.forEach(m => {
      if (m.type === 'saida') {
        if (!productExits[m.product_id]) productExits[m.product_id] = 0;
        productExits[m.product_id] += m.quantity;
      }
    });

    const productLastSale: Record<string, Date> = {};
    sales.forEach(sale => {
      sale.sale_items?.forEach((item: any) => {
        if (item.product_id) {
          const saleDate = new Date(sale.created_at);
          if (!productLastSale[item.product_id] || saleDate > productLastSale[item.product_id]) {
            productLastSale[item.product_id] = saleDate;
          }
        }
      });
    });

    const agingProducts = products.map(p => {
      const lastSale = productLastSale[p.id];
      const totalStock = p.sizes.reduce((sum, s) => sum + s.quantity, 0);
      const stockValue = totalStock * p.cost_price;
      const daysSinceLastSale = lastSale ? differenceInDays(now, lastSale) : 999;
      const totalExits = productExits[p.id] || 0;

      return { ...p, totalStock, stockValue, lastSale, daysSinceLastSale, totalExits };
    }).filter(p => p.totalStock > 0);

    const sortedProducts = [...agingProducts].sort((a, b) => {
      if (a.totalExits === b.totalExits) return b.daysSinceLastSale - a.daysSinceLastSale;
      return a.totalExits - b.totalExits;
    });

    const over30 = sortedProducts.filter(p => p.daysSinceLastSale >= 30 && p.daysSinceLastSale < 60);
    const over60 = sortedProducts.filter(p => p.daysSinceLastSale >= 60 && p.daysSinceLastSale < 90);
    const over90 = sortedProducts.filter(p => p.daysSinceLastSale >= 90);

    return {
      over30, over60, over90,
      totalOver30Value: over30.reduce((acc, p) => acc + p.stockValue, 0),
      totalOver60Value: over60.reduce((acc, p) => acc + p.stockValue, 0),
      totalOver90Value: over90.reduce((acc, p) => acc + p.stockValue, 0),
    };
  }, [products, sales, movements]);

  // Export functions
  const exportSalesReport = () => {
    const data = salesReport.sales.map(s => ({
      'Número': s.sale_number,
      'Data': format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'),
      'Cliente': s.customer_name || '-',
      'Forma Pagamento': s.payment_method,
      'Subtotal': Number(s.total).toFixed(2),
      'Desconto': Number(s.discount || 0).toFixed(2),
      'Total': Number(s.final_total).toFixed(2),
      'Parcelas': s.installments || 1,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas');
    XLSX.writeFile(wb, `relatorio-vendas-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório de vendas exportado!');
  };

  const exportStockReport = () => {
    const data = products.map(p => ({
      'Produto': p.name,
      'Categoria': p.category_name || '-',
      'Cor': p.color_name || '-',
      'Fornecedor': p.supplier_name || '-',
      'Custo': p.cost_price.toFixed(2),
      'Venda': p.sale_price.toFixed(2),
      'Estoque Total': p.sizes.reduce((sum, s) => sum + s.quantity, 0),
      'Estoque Mínimo': p.min_stock,
      'Valor Estoque': (p.sizes.reduce((sum, s) => sum + s.quantity, 0) * p.cost_price).toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
    XLSX.writeFile(wb, `relatorio-estoque-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório de estoque exportado!');
  };

  const exportFinancialReport = () => {
    const receivablesData = financialReport.receivables.map(r => ({
      'Descrição': r.description,
      'Valor Bruto': Number(r.amount).toFixed(2),
      'Taxa': Number(r.fee || 0).toFixed(2),
      'Valor Líquido': Number(r.net_amount).toFixed(2),
      'Vencimento': format(new Date(r.due_date), 'dd/MM/yyyy'),
      'Status': r.is_received ? 'Recebido' : 'Pendente',
      'Data Recebimento': r.received_date ? format(new Date(r.received_date), 'dd/MM/yyyy') : '-',
    }));
    const expensesData = financialReport.expenses.map(e => ({
      'Descrição': e.description,
      'Categoria': e.category || '-',
      'Valor': Number(e.amount).toFixed(2),
      'Juros': Number(e.interest_amount || 0).toFixed(2),
      'Total Pago': e.amount_paid != null ? Number(e.amount_paid).toFixed(2) : '-',
      'Vencimento': format(new Date(e.due_date), 'dd/MM/yyyy'),
      'Status': e.status,
      'Data Pagamento': e.paid_date ? format(new Date(e.paid_date), 'dd/MM/yyyy') : '-',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receivablesData), 'A Receber');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expensesData), 'A Pagar');
    XLSX.writeFile(wb, `relatorio-financeiro-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório financeiro exportado!');
  };

  const exportAgingReport = () => {
    const allAging = [...agingReport.over30, ...agingReport.over60, ...agingReport.over90];
    const data = allAging.map(p => ({
      'Produto': p.name,
      'Categoria': p.category_name || '-',
      'Estoque': p.totalStock,
      'Valor Estoque': p.stockValue.toFixed(2),
      'Última Venda': p.lastSale ? format(p.lastSale, 'dd/MM/yyyy') : 'Nunca vendido',
      'Dias Parado': p.daysSinceLastSale === 999 ? 'N/A' : p.daysSinceLastSale,
      'Classificação': p.daysSinceLastSale >= 90 ? 'Crítico (+90 dias)' :
                       p.daysSinceLastSale >= 60 ? 'Alto (+60 dias)' : 'Atenção (+30 dias)',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Peças Paradas');
    XLSX.writeFile(wb, `relatorio-aging-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório de peças paradas exportado!');
  };

  const reportsSupportSections: SupportSection[] = [
    { title: 'O que é o módulo Relatórios', icon: HelpCircle, tag: 'essencial', content: 'Análises detalhadas sobre vendas, estoque, financeiro e produtos parados. Use o filtro de período no topo para ajustar o intervalo.' },
    { title: 'Relatório de Vendas', icon: ShoppingCart, content: 'Mostra faturamento total, quantidade de vendas, ticket médio e descontos.', tips: ['Gráfico de barras mostra vendas por dia.', 'Gráfico de pizza mostra métodos de pagamento mais usados.', 'Use "Exportar Excel" para baixar os dados.'] },
    { title: 'Relatório de Estoque', icon: Package, content: 'Visão geral: total de produtos, unidades, valor em estoque e alertas.', tips: ['Identifique produtos com estoque zerado ou abaixo do mínimo.', 'Veja o histórico de entradas e saídas do período.'] },
    { title: 'Relatório Financeiro', icon: DollarSign, content: 'Fluxo financeiro: a receber, recebido, despesas pagas/pendentes/vencidas e juros.', tips: ['O fluxo de caixa líquido mostra o resultado final (receitas - despesas).', 'Inclui detalhamento de juros pagos no período.'] },
    { title: 'Peças Paradas (Aging)', icon: Clock, tag: 'dica', content: 'Identifica produtos sem vendas há 30, 60 ou 90+ dias.', tips: ['Produtos parados ocupam capital — considere promoções ou liquidação.', 'O valor de estoque parado ajuda a priorizar ações.'] },
    { title: 'Como exportar para Excel', icon: Download, tag: 'essencial', content: 'Cada aba tem um botão "Exportar Excel":', steps: [{ text: 'Selecione a aba desejada (Vendas, Estoque, Financeiro ou Aging).' }, { text: 'Ajuste o período no filtro do topo.' }, { text: 'Clique em "Exportar Excel" — o arquivo será baixado automaticamente.' }] },
  ];

  const barChartConfig = {
    total: { label: 'Vendas (R$)', color: 'hsl(var(--primary))' },
  };

  return (
    <MainLayout title="Relatórios" subtitle="Análises detalhadas do seu negócio" supportContent={{ moduleName: 'Relatórios', sections: reportsSupportSections }}>
      <div className="space-y-6 animate-fade-in">
        {/* Period Filter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sales" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Vendas</span>
            </TabsTrigger>
            <TabsTrigger value="stock" className="gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Estoque</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="aging" className="gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Menos Saídas</span>
            </TabsTrigger>
          </TabsList>

          {/* Sales Tab */}
          <TabsContent value="sales" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={exportSalesReport}>
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Faturamento</p>
                          <p className="text-xl font-bold text-foreground">
                            R$ {salesReport.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Vendas</p>
                          <p className="text-xl font-bold text-foreground">{salesReport.count}</p>
                        </div>
                        <ShoppingCart className="w-8 h-8 text-pink-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Ticket Médio</p>
                          <p className="text-xl font-bold text-foreground">
                            R$ {salesReport.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <BarChart3 className="w-8 h-8 text-amber-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Descontos</p>
                          <p className="text-xl font-bold text-foreground">
                            R$ {salesReport.totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <TrendingDown className="w-8 h-8 text-red-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Bar Chart - Sales by Day */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Vendas por Dia</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {salesReport.chartData.length > 0 ? (
                        <ChartContainer config={barChartConfig} className="h-[250px] w-full">
                          <BarChart data={salesReport.chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} className="text-xs fill-muted-foreground" />
                            <YAxis axisLine={false} tickLine={false} className="text-xs fill-muted-foreground" tickFormatter={(v) => `R$${v}`} />
                            <ChartTooltip
                              content={<ChartTooltipContent />}
                              formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Vendas']}
                            />
                            <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                          Nenhuma venda no período
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Pie Chart - Payment Methods */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Formas de Pagamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {salesReport.pieData.length > 0 ? (
                        <div className="h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={salesReport.pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={3}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {salesReport.pieData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                          Nenhuma venda no período
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* By Payment Method - Table */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Detalhes por Forma de Pagamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(salesReport.byPaymentMethod).map(([method, data]) => (
                          <div key={method} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{paymentMethodLabels[method] || method}</Badge>
                              <span className="text-sm text-muted-foreground">{data.count} vendas</span>
                            </div>
                            <span className="font-medium">
                              R$ {data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Products */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Produtos Mais Vendidos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {salesReport.topProducts.slice(0, 5).map((product, index) => (
                          <div key={product.name} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-pink-500 text-white text-xs flex items-center justify-center">
                                {index + 1}
                              </span>
                              <span className="text-sm truncate max-w-[150px]">{product.name}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{product.quantity} un</p>
                              <p className="text-xs text-muted-foreground">
                                R$ {product.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Stock Tab */}
          <TabsContent value="stock" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={exportStockReport}>
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Produtos</p>
                          <p className="text-xl font-bold text-foreground">{stockReport.totalProducts}</p>
                        </div>
                        <Package className="w-8 h-8 text-pink-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Peças em Estoque</p>
                          <p className="text-xl font-bold text-foreground">{stockReport.totalStock}</p>
                        </div>
                        <Package className="w-8 h-8 text-green-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Valor em Estoque (Custo)</p>
                          <p className="text-xl font-bold text-foreground">
                            R$ {stockReport.stockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <DollarSign className="w-8 h-8 text-amber-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Projeção de Vendas</p>
                          <p className="text-xl font-bold text-green-600">
                            R$ {stockReport.stockSaleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Lucro Potencial</p>
                          <p className="text-xl font-bold text-blue-600">
                            R$ {stockReport.potentialProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <DollarSign className="w-8 h-8 text-blue-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Estoque Baixo</p>
                          <p className="text-xl font-bold text-foreground">{stockReport.lowStockProducts.length}</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-red-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <ArrowUp className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Entradas</p>
                          <p className="text-lg font-bold">{stockReport.entries} peças</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                          <ArrowDown className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Saídas</p>
                          <p className="text-lg font-bold">{stockReport.exits} peças</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <Minus className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Ajustes</p>
                          <p className="text-lg font-bold">{stockReport.adjustments}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {stockReport.lowStockProducts.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Produtos com Estoque Baixo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-center">Atual</TableHead>
                            <TableHead className="text-center">Mínimo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockReport.lowStockProducts.slice(0, 5).map(p => (
                            <TableRow key={p.id}>
                              <TableCell>{p.name}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="destructive">
                                  {p.sizes.reduce((sum, s) => sum + s.quantity, 0)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground">{p.min_stock}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={exportFinancialReport}>
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Recebido</p>
                          <p className="text-xl font-bold text-green-500">
                            R$ {financialReport.receivedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <ArrowUp className="w-8 h-8 text-green-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">A Receber</p>
                          <p className="text-xl font-bold text-amber-500">
                            R$ {financialReport.pendingReceivables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <Clock className="w-8 h-8 text-amber-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Pago</p>
                          <p className="text-xl font-bold text-foreground">
                            R$ {financialReport.paidExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <ArrowDown className="w-8 h-8 text-red-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Saldo</p>
                          <p className={`text-xl font-bold ${financialReport.netCashFlow >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            R$ {financialReport.netCashFlow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <DollarSign className="w-8 h-8 text-pink-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Resumo Receitas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm">Total Bruto</span>
                        <span className="font-medium">R$ {financialReport.totalReceivables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm">Descontos</span>
                        <span className="font-medium text-red-500">- R$ {financialReport.totalDiscounts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-green-500/10">
                        <span className="text-sm font-medium">Recebido</span>
                        <span className="font-bold text-green-500">R$ {financialReport.receivedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Resumo Despesas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between p-2 rounded bg-muted/50">
                        <span className="text-sm">Total</span>
                        <span className="font-medium">R$ {financialReport.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-green-500/10">
                        <span className="text-sm">Pago</span>
                        <span className="font-medium text-green-500">R$ {financialReport.paidExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-amber-500/10">
                        <span className="text-sm">Pendente</span>
                        <span className="font-medium text-amber-500">R$ {financialReport.pendingExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {financialReport.overdueExpenses > 0 && (
                        <div className="flex justify-between p-2 rounded bg-red-500/10">
                          <span className="text-sm">Vencido</span>
                          <span className="font-bold text-red-500">R$ {financialReport.overdueExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {financialReport.totalInterest > 0 && (
                        <div className="flex justify-between p-2 rounded bg-orange-500/10">
                          <span className="text-sm">Juros Pagos</span>
                          <span className="font-medium text-orange-500">R$ {financialReport.totalInterest.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Aging Tab */}
          <TabsContent value="aging" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={exportAgingReport}>
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-amber-500/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">30-60 dias</p>
                          <p className="text-xl font-bold text-amber-500">{agingReport.over30.length} produtos</p>
                          <p className="text-sm text-muted-foreground">
                            R$ {agingReport.totalOver30Value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <Clock className="w-8 h-8 text-amber-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-orange-500/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">60-90 dias</p>
                          <p className="text-xl font-bold text-orange-500">{agingReport.over60.length} produtos</p>
                          <p className="text-sm text-muted-foreground">
                            R$ {agingReport.totalOver60Value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-orange-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-red-500/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">+90 dias (Crítico)</p>
                          <p className="text-xl font-bold text-red-500">{agingReport.over90.length} produtos</p>
                          <p className="text-sm text-muted-foreground">
                            R$ {agingReport.totalOver90Value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-red-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {agingReport.over90.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        Peças Críticas (+90 dias sem venda)
                      </CardTitle>
                      <CardDescription>
                        Considere aplicar promoções ou liquidar estes produtos
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-center">Estoque</TableHead>
                            <TableHead className="text-right">Valor Parado</TableHead>
                            <TableHead className="text-right">Última Venda</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agingReport.over90.slice(0, 10).map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell className="text-muted-foreground">{p.category_name || '-'}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="destructive">{p.totalStock}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                R$ {p.stockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {p.lastSale ? format(p.lastSale, 'dd/MM/yy', { locale: ptBR }) : 'Nunca'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {agingReport.over60.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-500" />
                        Atenção (60-90 dias sem venda)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {agingReport.over60.map(p => (
                          <div key={p.id} className="p-2 rounded bg-muted/50 flex justify-between items-center">
                            <span className="text-sm truncate">{p.name}</span>
                            <Badge variant="outline" className="shrink-0">{p.totalStock} un</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
