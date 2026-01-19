import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRestockCalculations } from '@/hooks/useRestockCalculations';
import {
  Loader2,
  AlertTriangle,
  Package,
  CheckCircle2,
  Clock,
  TrendingDown,
  ShoppingCart,
  Boxes,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Restock() {
  const { data: restockData, isLoading } = useRestockCalculations();

  const hasProducts = restockData && restockData.products.length > 0;

  // Categorize products by status
  const getProductsByStatus = () => {
    if (!restockData) return { urgent: [], attention: [], ok: [], empty: [] };

    const empty = restockData.products.filter(p => p.currentStock === 0);
    const urgent = restockData.products.filter(p => p.currentStock > 0 && p.urgency === 'critical');
    const attention = restockData.products.filter(p => p.currentStock > 0 && (p.urgency === 'high' || p.urgency === 'medium'));
    const ok = restockData.products.filter(p => p.currentStock > 0 && p.urgency === 'low');

    return { urgent, attention, ok, empty };
  };

  const { urgent, attention, ok, empty } = getProductsByStatus();

  // Calculate summary stats
  const totalProducts = restockData?.products.length || 0;
  const totalUnits = restockData?.products.reduce((sum, p) => sum + p.currentStock, 0) || 0;
  const totalValue = restockData?.summary.totalStockValue || 0;

  return (
    <MainLayout title="Controle de Estoque" subtitle="Veja o que precisa comprar">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !hasProducts ? (
        <Card className="p-8 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum produto cadastrado</h3>
          <p className="text-muted-foreground">
            Cadastre produtos para começar a controlar o estoque.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Resumo Geral - Cards grandes e claros */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-2">
              <CardContent className="p-4 text-center">
                <Boxes className="w-8 h-8 mx-auto text-primary mb-2" />
                <p className="text-3xl font-bold">{totalProducts}</p>
                <p className="text-sm text-muted-foreground">Produtos</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 mx-auto text-primary mb-2" />
                <p className="text-3xl font-bold">{totalUnits.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-muted-foreground">Unidades</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="p-4 text-center">
                <ShoppingCart className="w-8 h-8 mx-auto text-primary mb-2" />
                <p className="text-3xl font-bold">R$ {(totalValue / 1000).toFixed(0)}k</p>
                <p className="text-sm text-muted-foreground">Valor em Estoque</p>
              </CardContent>
            </Card>
            <Card className={cn(
              "border-2",
              empty.length > 0 ? "border-destructive bg-destructive/5" : "border-success bg-success/5"
            )}>
              <CardContent className="p-4 text-center">
                {empty.length > 0 ? (
                  <>
                    <AlertTriangle className="w-8 h-8 mx-auto text-destructive mb-2" />
                    <p className="text-3xl font-bold text-destructive">{empty.length}</p>
                    <p className="text-sm text-destructive">Sem Estoque!</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-8 h-8 mx-auto text-success mb-2" />
                    <p className="text-3xl font-bold text-success">OK</p>
                    <p className="text-sm text-success">Tudo em dia</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Status Visual - Barra de progresso do estoque */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Situação Geral do Estoque</CardTitle>
              <CardDescription>Como estão seus produtos hoje</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 h-8 rounded-lg overflow-hidden">
                {empty.length > 0 && (
                  <div
                    className="bg-destructive flex items-center justify-center text-destructive-foreground text-xs font-medium"
                    style={{ width: `${(empty.length / totalProducts) * 100}%` }}
                  >
                    {empty.length}
                  </div>
                )}
                {urgent.length > 0 && (
                  <div
                    className="bg-warning flex items-center justify-center text-warning-foreground text-xs font-medium"
                    style={{ width: `${(urgent.length / totalProducts) * 100}%` }}
                  >
                    {urgent.length}
                  </div>
                )}
                {attention.length > 0 && (
                  <div
                    className="bg-primary/60 flex items-center justify-center text-primary-foreground text-xs font-medium"
                    style={{ width: `${(attention.length / totalProducts) * 100}%` }}
                  >
                    {attention.length}
                  </div>
                )}
                {ok.length > 0 && (
                  <div
                    className="bg-success flex items-center justify-center text-success-foreground text-xs font-medium"
                    style={{ width: `${(ok.length / totalProducts) * 100}%` }}
                  >
                    {ok.length}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-destructive" />
                  <span>Sem estoque ({empty.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-warning" />
                  <span>Comprar urgente ({urgent.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-primary/60" />
                  <span>Ficar de olho ({attention.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-success" />
                  <span>Estoque OK ({ok.length})</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Produtos SEM ESTOQUE - Vermelho */}
          {empty.length > 0 && (
            <Card className="border-destructive">
              <CardHeader className="bg-destructive/10 border-b border-destructive/20">
                <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Precisa Comprar AGORA - Sem Estoque
                </CardTitle>
                <CardDescription className="text-destructive/80">
                  Estes produtos acabaram! Você pode estar perdendo vendas.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {empty.slice(0, 12).map(product => (
                    <div
                      key={product.productId}
                      className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.productName}</p>
                        <p className="text-xs text-muted-foreground">{product.categoryName || product.supplierName}</p>
                      </div>
                      <Badge variant="destructive" className="ml-2 shrink-0">
                        0 un
                      </Badge>
                    </div>
                  ))}
                </div>
                {empty.length > 12 && (
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    + {empty.length - 12} outros produtos sem estoque
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Produtos URGENTES - Amarelo */}
          {urgent.length > 0 && (
            <Card className="border-warning">
              <CardHeader className="bg-warning/10 border-b border-warning/20">
                <CardTitle className="text-lg flex items-center gap-2 text-warning">
                  <Clock className="w-5 h-5" />
                  Comprar Esta Semana - Estoque Baixo
                </CardTitle>
                <CardDescription className="text-warning/80">
                  Estes produtos estão acabando. Faça o pedido logo.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {urgent.slice(0, 12).map(product => (
                    <div
                      key={product.productId}
                      className="flex items-center justify-between p-3 bg-warning/5 border border-warning/20 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.productName}</p>
                        <p className="text-xs text-muted-foreground">{product.categoryName || product.supplierName}</p>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <Badge variant="outline" className="border-warning text-warning">
                          {product.currentStock} un
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {urgent.length > 12 && (
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    + {urgent.length - 12} outros produtos
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Produtos para FICAR DE OLHO */}
          {attention.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-primary" />
                  Ficar de Olho - Planejar Compra
                </CardTitle>
                <CardDescription>
                  Estes produtos ainda têm estoque, mas estão abaixo do ideal.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {attention.slice(0, 16).map(product => {
                    const stockPercent = Math.min((product.currentStock / Math.max(product.minStock, 1)) * 100, 100);
                    return (
                      <div
                        key={product.productId}
                        className="p-3 border rounded-lg"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-sm truncate flex-1" title={product.productName}>
                            {product.productName}
                          </p>
                          <span className="text-sm font-bold ml-2">{product.currentStock}</span>
                        </div>
                        <Progress value={stockPercent} className="h-2" />
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-muted-foreground">
                            {product.categoryName || 'Sem categoria'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            min: {product.minStock}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {attention.length > 16 && (
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    + {attention.length - 16} outros produtos
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Produtos OK */}
          {ok.length > 0 && (
            <Card className="border-success/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-success">
                  <CheckCircle2 className="w-5 h-5" />
                  Estoque OK - {ok.length} produtos
                </CardTitle>
                <CardDescription>
                  Estes produtos estão com estoque suficiente.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {ok.slice(0, 20).map(product => (
                    <Badge
                      key={product.productId}
                      variant="outline"
                      className="border-success/30 bg-success/5"
                    >
                      {product.productName.slice(0, 25)}{product.productName.length > 25 ? '...' : ''}: {product.currentStock} un
                    </Badge>
                  ))}
                  {ok.length > 20 && (
                    <Badge variant="outline">
                      + {ok.length - 20} outros
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Explicação quando não há alertas */}
          {empty.length === 0 && urgent.length === 0 && attention.length === 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Info className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">Como funciona este controle?</h3>
                    <p className="text-muted-foreground mb-4">
                      Este sistema analisa seu estoque e vendas para te avisar <strong>quando comprar</strong> cada produto.
                      Atualmente todos os {ok.length} produtos estão classificados como "OK".
                    </p>

                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-warning flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Atenção: Sem histórico de vendas
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        O sistema precisa de vendas registradas para calcular a demanda e prever quando os produtos vão acabar.
                        Sem vendas, não é possível saber quais produtos estão vendendo mais e precisam de reposição.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium">O que você pode fazer:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <ShoppingCart className="w-4 h-4 text-primary mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Registrar vendas</p>
                            <p className="text-xs text-muted-foreground">Use o PDV para registrar suas vendas diárias</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                          <Package className="w-4 h-4 text-primary mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Ajustar estoque mínimo</p>
                            <p className="text-xs text-muted-foreground">Defina o mínimo de cada produto no cadastro</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </MainLayout>
  );
}
