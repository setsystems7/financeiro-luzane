import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLowStockProducts } from '@/hooks/useStock';

export function LowStockAlert() {
  const { data: lowStockProducts = [], isLoading } = useLowStockProducts();

  return (
    <Card variant="elevated">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Alerta de Estoque</CardTitle>
        <Badge variant="secondary" className="gap-1 bg-warning/20 text-warning-foreground">
          <AlertTriangle className="w-3 h-3" />
          {lowStockProducts.length} itens
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : lowStockProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Todos os produtos estão com estoque adequado!
          </p>
        ) : (
          lowStockProducts.slice(0, 5).map((product) => (
            <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
              <div>
                <p className="text-sm font-medium text-foreground">{product.name}</p>
                <p className="text-xs text-muted-foreground">Mínimo: {product.minStock} un.</p>
              </div>
              <Badge variant="destructive">{product.totalStock} un.</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
