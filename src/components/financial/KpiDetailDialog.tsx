import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, CreditCard, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface KpiDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'entrada' | 'taxas' | 'caixa' | 'pagar' | 'saldo' | null;
  periodLabel?: string;
  summary: {
    totalGrossReceivable: number;
    totalFees: number;
    totalReceivable: number;
    totalPayable: number;
    totalMonthPayable: number;
    totalOverdue: number;
    balance: number;
    receivablesCount: number;
    expensesCount: number;
    totalPeriodEntries?: number;
    totalPeriodManualCash?: number;
    periodManualEntriesCount?: number;
    totalManualCash?: number;
    totalSalesNet?: number;
    totalPaidExpenses?: number;
    totalPaidInPeriod?: number;
    manualEntriesCount?: number;
  } | undefined;
}

export function KpiDetailDialog({ open, onOpenChange, type, periodLabel, summary }: KpiDetailDialogProps) {
  if (!summary || !type) return null;

  const periodSuffix = periodLabel ? ` - ${periodLabel}` : '';

  const configs: Record<string, { title: string; icon: React.ReactNode; items: { label: string; value: number; highlight?: boolean; negative?: boolean; info?: string }[] }> = {
    entrada: {
      title: `Entradas${periodSuffix} — Detalhamento`,
      icon: <ArrowUpRight className="w-5 h-5 text-blue-500" />,
      items: [
        { label: 'Valor bruto das vendas no período', value: summary.totalGrossReceivable },
        ...(summary.totalPeriodManualCash && summary.totalPeriodManualCash > 0 ? [
          { label: `Entradas manuais / empréstimos no período (${summary.periodManualEntriesCount ?? 0})`, value: summary.totalPeriodManualCash },
        ] : []),
        { label: 'Quantidade de recebíveis de vendas no período', value: summary.receivablesCount, info: 'registros' },
        { label: 'Taxas de cartão inclusas', value: summary.totalFees, negative: true },
        { label: 'Valor líquido (sem taxas)', value: summary.totalGrossReceivable - summary.totalFees },
        { label: 'Total de entradas no período', value: summary.totalPeriodEntries ?? summary.totalGrossReceivable, highlight: true },
      ],
    },
    taxas: {
      title: 'Taxas Recebidas — Detalhamento',
      icon: <CreditCard className="w-5 h-5 text-amber-500" />,
      items: [
        { label: 'Total de taxas de cartão no período', value: summary.totalFees, highlight: true },
        { label: 'Valor bruto das vendas', value: summary.totalGrossReceivable },
        { label: 'Percentual médio de taxa', value: summary.totalGrossReceivable > 0 ? (summary.totalFees / summary.totalGrossReceivable) * 100 : 0, info: '%' },
      ],
    },
    caixa: {
      title: 'Valor do Caixa Real — Detalhamento',
      icon: <TrendingUp className="w-5 h-5 text-green-500" />,
      items: [
        { label: 'Total líquido já recebido de vendas (histórico)', value: summary.totalSalesNet ?? 0 },
        ...(summary.totalManualCash && summary.totalManualCash > 0 ? [
          { label: `Entradas manuais / empréstimos realizados (${summary.manualEntriesCount ?? 0})`, value: summary.totalManualCash },
        ] : []),
        { label: '(-) Despesas pagas (histórico)', value: summary.totalPaidExpenses ?? 0, negative: true },
        { label: 'Valor do Caixa real atual', value: summary.totalReceivable, highlight: true },
      ],
    },
    pagar: {
      title: `Contas a Pagar${periodSuffix} — Detalhamento`,
      icon: <TrendingDown className="w-5 h-5 text-red-500" />,
      items: [
        { label: 'Despesas pendentes do mês atual', value: summary.totalMonthPayable },
        { label: 'Despesas vencidas (meses anteriores)', value: summary.totalOverdue, negative: true },
        { label: 'Total a pagar (mês + atraso)', value: summary.totalPayable, highlight: true },
        { label: 'Quantidade de despesas', value: summary.expensesCount, info: 'registros' },
      ],
    },
    saldo: {
      title: `Saldo Previsto${periodSuffix} — Detalhamento`,
      icon: <Wallet className="w-5 h-5 text-pink-500" />,
      items: [
        { label: 'Valor do Caixa real atual', value: summary.totalReceivable },
        { label: '(-) Contas a pagar (mês + vencidas)', value: summary.totalPayable, negative: true },
        { label: 'Saldo previsto', value: summary.balance, highlight: true },
      ],
    },
  };

  const config = configs[type];
  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            <span className="text-base">{config.title}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {config.items.map((item, i) => (
            <div key={i}>
              <div className="flex items-center justify-between py-2">
                <div className="flex-1 min-w-0 pr-3">
                  <p className={`text-sm ${item.highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    {item.label}
                  </p>
                  {item.info && !['registros', '%'].includes(item.info) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.info}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {item.info === 'registros' ? (
                    <Badge variant="outline">{item.value}</Badge>
                  ) : item.info === '%' ? (
                    <span className="text-sm font-semibold">{item.value.toFixed(2)}%</span>
                  ) : (
                    <span className={`text-sm font-semibold ${
                      item.highlight ? 'text-foreground' :
                      item.negative ? 'text-destructive' :
                      'text-muted-foreground'
                    }`}>
                      {item.negative ? '-' : ''}R$ {formatCurrency(Math.abs(item.value))}
                    </span>
                  )}
                </div>
              </div>
              {i < config.items.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
