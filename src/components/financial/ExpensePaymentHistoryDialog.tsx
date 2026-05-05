import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useExpensePayments } from '@/hooks/useFinancial';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ExpensePaymentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string | null;
  expenseDescription: string;
  expenseAmount: number;
  totalPaid: number;
}

export function ExpensePaymentHistoryDialog({
  open,
  onOpenChange,
  expenseId,
  expenseDescription,
  expenseAmount,
  totalPaid,
}: ExpensePaymentHistoryDialogProps) {
  const { data: payments = [], isLoading } = useExpensePayments(open ? expenseId : null);

  const remaining = Math.max(0, expenseAmount - totalPaid);
  const isFullyPaid = totalPaid >= expenseAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500" />
            <span className="text-base">Histórico de Pagamentos</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Expense summary */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium truncate">{expenseDescription}</p>
            <div className="flex gap-3 flex-wrap text-xs">
              <span>Valor total: <strong>R$ {formatCurrency(expenseAmount)}</strong></span>
              <span className="text-amber-600 dark:text-amber-400">
                Pago: <strong>R$ {formatCurrency(totalPaid)}</strong>
              </span>
              {!isFullyPaid && (
                <span className="text-destructive">
                  Restante: <strong>R$ {formatCurrency(remaining)}</strong>
                </span>
              )}
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${isFullyPaid ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, (totalPaid / expenseAmount) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {Math.min(100, Math.round((totalPaid / expenseAmount) * 100))}% quitado
            </p>
          </div>

          <Separator />

          {/* Payment list */}
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum pagamento registrado ainda.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {payments.map((p, i) => (
                <div key={p.id} className="flex items-start justify-between p-2 rounded-lg border bg-card">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(p.paid_date + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                    {p.interest_amount > 0 && (
                      <p className="text-xs text-destructive">
                        + R$ {formatCurrency(p.interest_amount)} em juros/multa
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <Badge
                      variant={i === 0 ? 'success' : 'outline'}
                      className="text-xs"
                    >
                      R$ {formatCurrency(p.amount)}
                    </Badge>
                    {i === 0 && (
                      <p className="text-[10px] text-muted-foreground">Último</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer total */}
          {payments.length > 0 && (
            <>
              <Separator />
              <div className="flex justify-between text-sm font-semibold">
                <span>{payments.length} pagamento{payments.length > 1 ? 's' : ''}</span>
                <span>Total pago: R$ {formatCurrency(payments.reduce((s, p) => s + p.amount, 0))}</span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
