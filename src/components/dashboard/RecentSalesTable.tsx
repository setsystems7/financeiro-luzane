import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Sale {
  id: string;
  total: number;
  payment_method: string;
  created_at: string;
  status: string;
}

interface RecentSalesTableProps {
  sales: Sale[];
}

const paymentMethodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  pix: 'PIX',
  fiado: 'Fiado',
};

export function RecentSalesTable({ sales }: RecentSalesTableProps) {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Card className="opacity-0 animate-fade-in-up stagger-11">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          Vendas Recentes
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/relatorios')}>
          Ver todas
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Nenhuma venda recente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {format(new Date(sale.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {paymentMethodLabels[sale.payment_method] || sale.payment_method}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(Number(sale.total))}
                  </p>
                  <Badge variant="outline" className="shrink-0">
                    {sale.status === 'concluida' ? 'Concluída' : sale.status}
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
