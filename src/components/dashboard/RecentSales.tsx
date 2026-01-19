import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRecentSales } from '@/hooks/useSales';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const paymentMethodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  crediario: 'Crediário',
};

export function RecentSales() {
  const { data: sales = [], isLoading } = useRecentSales(5);

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Vendas Recentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sales.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma venda registrada ainda
          </p>
        ) : (
          sales.map((sale) => (
            <div key={sale.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Venda #{sale.sale_number}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sale.sale_items?.length || 0} {(sale.sale_items?.length || 0) === 1 ? 'item' : 'itens'} • {format(new Date(sale.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  R$ {formatCurrency(sale.final_total)}
                </p>
                <Badge variant="outline" className="text-xs">
                  {paymentMethodLabels[sale.payment_method] || sale.payment_method}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
