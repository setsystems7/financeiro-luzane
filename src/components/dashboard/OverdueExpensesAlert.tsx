import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calendar, ExternalLink } from 'lucide-react';
import { useOverdueExpenses } from '@/hooks/useOverdueExpenses';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export function OverdueExpensesAlert() {
  const { data: overdueExpenses = [], isLoading } = useOverdueExpenses();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Despesas Vencidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (overdueExpenses.length === 0) {
    return null; // Don't show card if no overdue expenses
  }

  const totalOverdue = overdueExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <Card variant="elevated" className="border-destructive/50 bg-destructive/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          Despesas Vencidas ({overdueExpenses.length})
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/financeiro')}
          className="text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Ver Todas
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-destructive/10 rounded-lg">
          <p className="text-sm text-muted-foreground">Total vencido</p>
          <p className="text-2xl font-bold text-destructive">
            R$ {formatCurrency(totalOverdue)}
          </p>
        </div>

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {overdueExpenses.slice(0, 5).map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between p-3 bg-background rounded-lg border border-destructive/20"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{expense.description}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>
                    Venceu em {format(new Date(expense.due_date), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  <Badge variant="destructive" className="text-xs">
                    {expense.days_overdue} {expense.days_overdue === 1 ? 'dia' : 'dias'}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-destructive">
                  R$ {formatCurrency(expense.amount)}
                </p>
                {expense.category && (
                  <Badge variant="outline" className="text-xs">
                    {expense.category}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {overdueExpenses.length > 5 && (
          <p className="text-sm text-muted-foreground text-center mt-3">
            + {overdueExpenses.length - 5} despesas vencidas
          </p>
        )}
      </CardContent>
    </Card>
  );
}
