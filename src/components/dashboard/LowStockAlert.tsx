import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LowStockProduct {
  id: string;
  name: string;
  totalStock: number;
  minStock: number;
  isLow: boolean;
}

interface LowStockAlertProps {
  products: LowStockProduct[];
}

export function LowStockAlert({ products }: LowStockAlertProps) {
  const navigate = useNavigate();

  return (
    <Card className="opacity-0 animate-fade-in-up stagger-10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Alertas de Estoque
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/reposicao')}>
          Ver todos
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum produto com estoque baixo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.slice(0, 5).map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
              <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-destructive">{product.totalStock}</p>
                    <p className="text-xs text-muted-foreground">Mín: {product.minStock}</p>
                  </div>
                  <Badge variant="destructive" className="shrink-0">
                    Baixo
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
