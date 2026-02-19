import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRestockCalculations, type RestockProduct } from '@/hooks/useRestockCalculations';
import {
  Loader2,
  AlertTriangle,
  Package,
  CheckCircle2,
  Search,
  ArrowDown,
  ArrowUp,
  Minus,
  HelpCircle,
  BarChart3,
  ShoppingCart,
  AlertCircle,
  TrendingDown,
  Filter,
  Flame,
  Zap,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type SupportSection } from '@/components/layout/SupportButton';

const restockSupportSections: SupportSection[] = [
  { title: 'Como funciona', icon: HelpCircle, content: 'Este módulo analisa o estoque atual e o ritmo de vendas dos últimos 30 dias para classificar cada produto por nível de urgência de reposição.' },
  { title: 'Interpretando os dados', icon: BarChart3, content: '• Venda/dia: média de unidades vendidas por dia nos últimos 30 dias.\n• Cobertura: quantos dias o estoque atual dura no ritmo atual de vendas.\n• Status: indica se precisa comprar agora, em breve, ou se está OK.' },
  { title: 'Tomando decisão de compra', icon: ShoppingCart, content: 'Foque nos produtos com status "Sem Estoque" e "Crítico" primeiro. Use a coluna de venda/dia para priorizar os que vendem mais. A coluna de custo estimado ajuda a planejar o investimento.' },
];

type SortKey = 'name' | 'stock' | 'demand' | 'coverage' | 'urgency';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'sem_estoque' | 'critico' | 'atencao' | 'ok';

function getStatusInfo(product: RestockProduct) {
  if (product.currentStock === 0) {
    return { label: 'Sem Estoque', color: 'bg-destructive text-destructive-foreground', priority: 0 };
  }
  if (product.urgency === 'critical') {
    return { label: 'Crítico', color: 'bg-warning text-warning-foreground', priority: 1 };
  }
  if (product.urgency === 'high' || product.urgency === 'medium') {
    return { label: 'Atenção', color: 'bg-primary/20 text-primary', priority: 2 };
  }
  return { label: 'OK', color: 'bg-success/20 text-success', priority: 3 };
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Velocity indicator: how fast the product sells relative to others
function getVelocityInfo(dailyDemand: number, maxDemand: number) {
  if (dailyDemand === 0) return { label: 'Parado', icon: 'parado', level: 0 };
  const ratio = maxDemand > 0 ? dailyDemand / maxDemand : 0;
  if (ratio >= 0.6) return { label: 'Alta saída', icon: 'alta', level: 3 };
  if (ratio >= 0.3) return { label: 'Média saída', icon: 'media', level: 2 };
  return { label: 'Baixa saída', icon: 'baixa', level: 1 };
}

function VelocityBadge({ dailyDemand, maxDemand }: { dailyDemand: number; maxDemand: number }) {
  const info = getVelocityInfo(dailyDemand, maxDemand);
  if (info.level === 0) return <span className="text-xs text-muted-foreground">Parado</span>;
  return (
    <div className={cn(
      "flex items-center gap-1 text-xs font-medium",
      info.level === 3 && "text-destructive",
      info.level === 2 && "text-warning",
      info.level === 1 && "text-muted-foreground",
    )}>
      {info.level === 3 && <Flame className="w-3 h-3" />}
      {info.level === 2 && <Zap className="w-3 h-3" />}
      {info.level === 1 && <Activity className="w-3 h-3" />}
      {info.label}
    </div>
  );
}

export default function Restock() {
  const { data: restockData, isLoading } = useRestockCalculations();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('urgency');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [supplierFilter, setSupplierFilter] = useState('all');

  const products = restockData?.products || [];

  // Derive unique suppliers
  const suppliers = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.supplierName) set.add(p.supplierName); });
    return Array.from(set).sort();
  }, [products]);

  // Summary numbers
  const summary = useMemo(() => {
    const semEstoque = products.filter(p => p.currentStock === 0).length;
    const critico = products.filter(p => p.currentStock > 0 && p.urgency === 'critical').length;
    const atencao = products.filter(p => p.currentStock > 0 && (p.urgency === 'high' || p.urgency === 'medium')).length;
    const ok = products.filter(p => p.currentStock > 0 && p.urgency === 'low').length;
    const totalUnidades = products.reduce((s, p) => s + p.currentStock, 0);
    const valorEstoque = products.reduce((s, p) => s + p.stockValue, 0);
    const custoReposicao = products.filter(p => p.suggestedQuantity > 0).reduce((s, p) => s + p.estimatedCost, 0);
    const maxDemand = Math.max(...products.map(p => p.dailyDemand), 0);
    return { semEstoque, critico, atencao, ok, totalUnidades, valorEstoque, custoReposicao, maxDemand };
  }, [products]);

  // Urgent restock: products with sales activity but low/no stock (prioritize by demand)
  const urgentRestock = useMemo(() => {
    return products
      .filter(p => p.dailyDemand > 0 && (p.currentStock === 0 || (p.daysUntilStockout !== null && p.daysUntilStockout <= 7)))
      .sort((a, b) => b.dailyDemand - a.dailyDemand)
      .slice(0, 8);
  }, [products]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Search
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.productName.toLowerCase().includes(term) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(term)) ||
        (p.supplierName && p.supplierName.toLowerCase().includes(term))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        const info = getStatusInfo(p);
        if (statusFilter === 'sem_estoque') return info.priority === 0;
        if (statusFilter === 'critico') return info.priority === 1;
        if (statusFilter === 'atencao') return info.priority === 2;
        if (statusFilter === 'ok') return info.priority === 3;
        return true;
      });
    }

    // Supplier filter
    if (supplierFilter !== 'all') {
      filtered = filtered.filter(p => p.supplierName === supplierFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.productName.localeCompare(b.productName); break;
        case 'stock': cmp = a.currentStock - b.currentStock; break;
        case 'demand': cmp = a.dailyDemand - b.dailyDemand; break;
        case 'coverage': cmp = (a.daysOfCoverage) - (b.daysOfCoverage); break;
        case 'urgency': cmp = getStatusInfo(a).priority - getStatusInfo(b).priority; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [products, search, statusFilter, supplierFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'urgency' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <Minus className="w-3 h-3 text-muted-foreground/40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const hasProducts = products.length > 0;

  return (
    <MainLayout title="Visão do Estoque" subtitle="Entenda seu estoque e decida o que comprar" supportContent={{ moduleName: 'Reposição', sections: restockSupportSections }}>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !hasProducts ? (
        <Card className="p-8 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum produto cadastrado</h3>
          <p className="text-muted-foreground">Cadastre produtos para começar a controlar o estoque.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card
              className={cn("cursor-pointer transition-all border-2 hover:shadow-md", statusFilter === 'sem_estoque' ? 'border-destructive ring-2 ring-destructive/20' : 'border-destructive/30')}
              onClick={() => setStatusFilter(f => f === 'sem_estoque' ? 'all' : 'sem_estoque')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{summary.semEstoque}</p>
                    <p className="text-xs text-muted-foreground">Sem Estoque</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn("cursor-pointer transition-all border-2 hover:shadow-md", statusFilter === 'critico' ? 'border-warning ring-2 ring-warning/20' : 'border-warning/30')}
              onClick={() => setStatusFilter(f => f === 'critico' ? 'all' : 'critico')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{summary.critico}</p>
                    <p className="text-xs text-muted-foreground">Estoque Crítico</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn("cursor-pointer transition-all border-2 hover:shadow-md", statusFilter === 'atencao' ? 'border-primary ring-2 ring-primary/20' : '')}
              onClick={() => setStatusFilter(f => f === 'atencao' ? 'all' : 'atencao')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TrendingDown className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.atencao}</p>
                    <p className="text-xs text-muted-foreground">Atenção</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn("cursor-pointer transition-all border-2 hover:shadow-md", statusFilter === 'ok' ? 'border-success ring-2 ring-success/20' : 'border-success/30')}
              onClick={() => setStatusFilter(f => f === 'ok' ? 'all' : 'ok')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{summary.ok}</p>
                    <p className="text-xs text-muted-foreground">Estoque OK</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key metrics bar */}
          <div className="flex flex-wrap gap-4 items-center text-sm px-1">
            <div className="flex items-center gap-1.5">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold">{summary.totalUnidades.toLocaleString('pt-BR')} un</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Valor em estoque:</span>
              <span className="font-semibold">{formatCurrency(summary.valorEstoque)}</span>
            </div>
            {summary.custoReposicao > 0 && (
              <>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Custo p/ repor:</span>
                  <span className="font-semibold text-destructive">{formatCurrency(summary.custoReposicao)}</span>
                </div>
              </>
            )}
          </div>

          {/* Urgent Restock - Products selling but low/no stock */}
          {urgentRestock.length > 0 && (
            <Card className="border-2 border-destructive/40 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="w-5 h-5 text-destructive" />
                  Reposição Urgente — Produtos com saída e estoque baixo
                </CardTitle>
                <CardDescription>
                  Estes produtos estão vendendo mas acabando. Priorize a compra por velocidade de saída.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {urgentRestock.map(product => {
                    const coverageDays = product.dailyDemand > 0
                      ? Math.round(product.currentStock / product.dailyDemand)
                      : 0;
                    const totalSold30d = Math.round(product.dailyDemand * 30);
                    return (
                      <div
                        key={product.productId}
                        className="p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-sm truncate flex-1" title={product.productName}>
                            {product.productName}
                          </p>
                          <VelocityBadge dailyDemand={product.dailyDemand} maxDemand={summary.maxDemand} />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Estoque atual</span>
                            <span className={cn("font-bold", product.currentStock === 0 ? "text-destructive" : "text-warning")}>
                              {product.currentStock} un
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Vendas/30 dias</span>
                            <span className="font-medium">{totalSold30d} un</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Acaba em</span>
                            <span className={cn(
                              "font-bold",
                              coverageDays <= 3 ? "text-destructive" : "text-warning"
                            )}>
                              {product.currentStock === 0 ? 'Esgotado!' : `${coverageDays} dias`}
                            </span>
                          </div>
                          {product.suggestedQuantity > 0 && (
                            <div className="flex justify-between text-xs pt-1 border-t">
                              <span className="text-muted-foreground">Repor</span>
                              <span className="font-medium">{product.suggestedQuantity} un · {formatCurrency(product.estimatedCost)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto, categoria ou fornecedor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos fornecedores</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Products Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer hover:text-foreground select-none"
                        onClick={() => toggleSort('urgency')}
                      >
                        <div className="flex items-center gap-1">Status <SortIcon columnKey="urgency" /></div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:text-foreground select-none"
                        onClick={() => toggleSort('name')}
                      >
                        <div className="flex items-center gap-1">Produto <SortIcon columnKey="name" /></div>
                      </TableHead>
                      <TableHead className="hidden md:table-cell">Fornecedor</TableHead>
                      <TableHead
                        className="text-center cursor-pointer hover:text-foreground select-none"
                        onClick={() => toggleSort('stock')}
                      >
                        <div className="flex items-center justify-center gap-1">Estoque <SortIcon columnKey="stock" /></div>
                      </TableHead>
                      <TableHead className="text-center hidden sm:table-cell">Mínimo</TableHead>
                      <TableHead
                        className="text-center cursor-pointer hover:text-foreground select-none hidden sm:table-cell"
                        onClick={() => toggleSort('demand')}
                      >
                        <div className="flex items-center justify-center gap-1">Venda/dia <SortIcon columnKey="demand" /></div>
                      </TableHead>
                      <TableHead
                        className="text-center cursor-pointer hover:text-foreground select-none"
                        onClick={() => toggleSort('coverage')}
                      >
                        <div className="flex items-center justify-center gap-1">Cobertura <SortIcon columnKey="coverage" /></div>
                      </TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Custo Reposição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhum produto encontrado com os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map(product => {
                        const status = getStatusInfo(product);
                        const stockPercent = Math.min((product.currentStock / Math.max(product.minStock, 1)) * 100, 100);
                        const coverageDays = product.dailyDemand > 0
                          ? Math.round(product.currentStock / product.dailyDemand)
                          : null;

                        return (
                          <TableRow key={product.productId} className={cn(
                            product.currentStock === 0 && "bg-destructive/5"
                          )}>
                            <TableCell>
                              <Badge className={cn("text-xs font-medium whitespace-nowrap", status.color)}>
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{product.productName}</p>
                                <p className="text-xs text-muted-foreground">{product.categoryName || '—'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {product.supplierName || '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={cn(
                                  "font-bold text-sm",
                                  product.currentStock === 0 && "text-destructive",
                                  product.currentStock > 0 && product.currentStock <= product.minStock && "text-warning"
                                )}>
                                  {product.currentStock}
                                </span>
                                <Progress value={stockPercent} className="h-1.5 w-12" />
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground hidden sm:table-cell">
                              {product.minStock}
                            </TableCell>
                            <TableCell className="text-center text-sm hidden sm:table-cell">
                              {product.dailyDemand > 0 ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="font-medium">{product.dailyDemand.toFixed(1)}</span>
                                  <VelocityBadge dailyDemand={product.dailyDemand} maxDemand={summary.maxDemand} />
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {coverageDays !== null ? (
                                <span className={cn(
                                  "font-medium text-sm",
                                  coverageDays <= 3 && "text-destructive",
                                  coverageDays > 3 && coverageDays <= 7 && "text-warning",
                                  coverageDays > 7 && coverageDays <= 14 && "text-primary",
                                  coverageDays > 14 && "text-success"
                                )}>
                                  {coverageDays} dias
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem vendas</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm hidden lg:table-cell">
                              {product.suggestedQuantity > 0 ? (
                                <div>
                                  <p className="font-medium">{formatCurrency(product.estimatedCost)}</p>
                                  <p className="text-xs text-muted-foreground">{product.suggestedQuantity} un</p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Footer info */}
          <p className="text-xs text-muted-foreground text-center">
            Dados baseados nas vendas dos últimos 30 dias · {filteredProducts.length} de {products.length} produtos exibidos
          </p>
        </div>
      )}
    </MainLayout>
  );
}
