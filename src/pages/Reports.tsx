import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Calendar as CalendarIcon, Download, TrendingUp, DollarSign, 
  ShoppingBag, Percent, BarChart3, PieChartIcon, FileSpreadsheet
} from 'lucide-react';
import { 
  useSalesReport, 
  useTopProducts, 
  usePaymentMethodsReport,
  useCategorySalesReport 
} from '@/hooks/useReports';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--pink-dark))', '#10b981', '#f59e0b', '#6366f1', '#ec4899'];

const paymentMethodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_debito: 'Débito',
  cartao_credito: 'Crédito',
  fiado: 'Fiado',
};

export default function Reports() {
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'month' | 'custom'>('30days');
  const [customStartDate, setCustomStartDate] = useState<Date>(subDays(new Date(), 30));
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());

  const getDateRange = () => {
    const today = new Date();
    switch (dateRange) {
      case 'today':
        return { start: today, end: today };
      case '7days':
        return { start: subDays(today, 6), end: today };
      case '30days':
        return { start: subDays(today, 29), end: today };
      case 'month':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'custom':
        return { start: customStartDate, end: customEndDate };
      default:
        return { start: subDays(today, 29), end: today };
    }
  };

  const { start, end } = getDateRange();

  const { data: salesReport, isLoading: salesLoading } = useSalesReport(start, end);
  const { data: topProducts = [] } = useTopProducts(start, end);
  const { data: paymentMethods = [] } = usePaymentMethodsReport(start, end);
  const { data: categorySales = [] } = useCategorySalesReport(start, end);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sales summary
    const summaryData = [
      ['Relatório de Vendas'],
      ['Período', `${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`],
      [],
      ['Resumo'],
      ['Total de Vendas', salesReport?.salesCount || 0],
      ['Receita Total', salesReport?.totalRevenue || 0],
      ['Lucro Total', salesReport?.totalProfit || 0],
      ['Taxas de Cartão', salesReport?.totalFees || 0],
      ['Ticket Médio', salesReport?.averageTicket || 0],
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumo');

    // Daily sales
    if (salesReport?.chartData) {
      const dailyData = [
        ['Data', 'Vendas', 'Quantidade', 'Lucro'],
        ...salesReport.chartData.map(d => [
          format(new Date(d.date), 'dd/MM/yyyy'),
          d.total,
          d.count,
          d.profit,
        ]),
      ];
      const dailyWs = XLSX.utils.aoa_to_sheet(dailyData);
      XLSX.utils.book_append_sheet(wb, dailyWs, 'Vendas Diárias');
    }

    // Top products
    if (topProducts.length > 0) {
      const productsData = [
        ['Produto', 'Quantidade', 'Receita'],
        ...topProducts.map(p => [p.product_name, p.quantity, p.revenue]),
      ];
      const productsWs = XLSX.utils.aoa_to_sheet(productsData);
      XLSX.utils.book_append_sheet(wb, productsWs, 'Top Produtos');
    }

    // Payment methods
    if (paymentMethods.length > 0) {
      const paymentsData = [
        ['Forma de Pagamento', 'Quantidade', 'Total'],
        ...paymentMethods.map(p => [
          paymentMethodLabels[p.method] || p.method,
          p.count,
          p.total,
        ]),
      ];
      const paymentsWs = XLSX.utils.aoa_to_sheet(paymentsData);
      XLSX.utils.book_append_sheet(wb, paymentsWs, 'Formas de Pagamento');
    }

    // Categories
    if (categorySales.length > 0) {
      const categoriesData = [
        ['Categoria', 'Quantidade', 'Receita'],
        ...categorySales.map(c => [c.category_name, c.quantity, c.revenue]),
      ];
      const categoriesWs = XLSX.utils.aoa_to_sheet(categoriesData);
      XLSX.utils.book_append_sheet(wb, categoriesWs, 'Categorias');
    }

    // Download
    XLSX.writeFile(wb, `relatorio-vendas-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const salesChartConfig = {
    total: { label: 'Vendas', color: 'hsl(var(--primary))' },
    profit: { label: 'Lucro', color: '#10b981' },
  };

  return (
    <MainLayout title="Relatórios" subtitle="Análises e métricas do seu negócio">
      <div className="space-y-6">
        {/* Filters */}
        <Card className="opacity-0 animate-fade-in-up stagger-1">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Período:</span>
                <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="7days">Últimos 7 dias</SelectItem>
                    <SelectItem value="30days">Últimos 30 dias</SelectItem>
                    <SelectItem value="month">Este mês</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateRange === 'custom' && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {format(customStartDate, 'dd/MM/yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={(date) => date && setCustomStartDate(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <span>até</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {format(customEndDate, 'dd/MM/yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={(date) => date && setCustomEndDate(date)}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="ml-auto">
                <Button onClick={handleExportExcel} className="gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="opacity-0 animate-fade-in-up stagger-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Vendas</p>
                  <p className="text-2xl font-bold">{salesReport?.salesCount || 0}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Receita Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(salesReport?.totalRevenue || 0)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(salesReport?.totalProfit || 0)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxas de Cartão</p>
                  <p className="text-2xl font-bold text-red-500">
                    {formatCurrency(salesReport?.totalFees || 0)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <p className="text-2xl font-bold">{formatCurrency(salesReport?.averageTicket || 0)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="sales" className="opacity-0 animate-fade-in-up stagger-7">
          <TabsList>
            <TabsTrigger value="sales" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Vendas
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <ShoppingBag className="w-4 h-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <PieChartIcon className="w-4 h-4" />
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Categorias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Vendas e Lucro por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Carregando...
                  </div>
                ) : (
                  <ChartContainer config={salesChartConfig} className="h-[400px] w-full">
                    <AreaChart data={salesReport?.chartData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(v) => format(new Date(v), 'dd/MM')}
                        className="text-xs fill-muted-foreground"
                      />
                      <YAxis 
                        tickFormatter={(v) => `R$${v}`}
                        className="text-xs fill-muted-foreground"
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        formatter={(value: number, name: string) => [
                          formatCurrency(value),
                          name === 'total' ? 'Vendas' : 'Lucro'
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#colorSales)"
                        name="total"
                      />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#colorProfit)"
                        name="profit"
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Produtos Mais Vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartContainer config={{ revenue: { label: 'Receita', color: 'hsl(var(--primary))' }}} className="h-[400px]">
                    <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(v) => `R$${v}`} className="text-xs fill-muted-foreground" />
                      <YAxis type="category" dataKey="product_name" className="text-xs fill-muted-foreground" width={90} />
                      <ChartTooltip formatter={(value: number) => [formatCurrency(value), 'Receita']} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((product, idx) => (
                        <TableRow key={product.product_id}>
                          <TableCell className="font-medium">
                            <span className="mr-2 text-muted-foreground">#{idx + 1}</span>
                            {product.product_name}
                          </TableCell>
                          <TableCell className="text-center">{product.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Formas de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-[400px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentMethods.map(p => ({
                            ...p,
                            name: paymentMethodLabels[p.method] || p.method,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={120}
                          paddingAngle={5}
                          dataKey="total"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {paymentMethods.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Forma de Pagamento</TableHead>
                        <TableHead className="text-center">Vendas</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentMethods.map((method, idx) => (
                        <TableRow key={method.method}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                              />
                              {paymentMethodLabels[method.method] || method.method}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{method.count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(method.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Vendas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartContainer config={{ revenue: { label: 'Receita', color: 'hsl(var(--pink-dark))' }}} className="h-[400px]">
                    <BarChart data={categorySales} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="category_name" className="text-xs fill-muted-foreground" />
                      <YAxis tickFormatter={(v) => `R$${v}`} className="text-xs fill-muted-foreground" />
                      <ChartTooltip formatter={(value: number) => [formatCurrency(value), 'Receita']} />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {categorySales.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categorySales.map((category, idx) => (
                        <TableRow key={category.category_id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                              />
                              {category.category_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{category.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(category.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
