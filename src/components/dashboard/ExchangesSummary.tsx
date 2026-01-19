import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCcw, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { useMonthExchanges } from '@/hooks/useExchanges';

export function ExchangesSummary() {
  const { data: exchangeStats, isLoading } = useMonthExchanges();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCcw className="w-5 h-5" />
            Trocas do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCcw className="w-5 h-5 text-primary" />
          Trocas do Mês
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <ArrowLeftRight className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{exchangeStats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total Trocas</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <TrendingDown className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <p className="text-lg font-bold">
              R$ {(exchangeStats?.totalValue || 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Valor Devolvido</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <RefreshCcw className="w-5 h-5 mx-auto mb-1 text-green-600" />
            <p className="text-lg font-bold">
              R$ {(exchangeStats?.totalCredit || 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Créditos Usados</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
