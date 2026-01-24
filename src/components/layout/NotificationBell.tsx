import { useState } from 'react';
import { Bell, AlertTriangle, Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOverdueExpenses } from '@/hooks/useOverdueExpenses';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: overdueExpenses = [] } = useOverdueExpenses();
  const navigate = useNavigate();

  const count = overdueExpenses.length;
  const totalOverdue = overdueExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const handleViewAll = () => {
    setOpen(false);
    navigate('/financeiro');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs flex items-center justify-center"
            >
              {count > 99 ? '99+' : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h4 className="font-semibold">Notificações</h4>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {count === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma notificação</p>
          </div>
        ) : (
          <>
            <div className="p-3 bg-destructive/10 border-b">
              <p className="text-sm font-medium text-destructive">
                {count} despesa{count > 1 ? 's' : ''} vencida{count > 1 ? 's' : ''}
              </p>
              <p className="text-lg font-bold text-destructive">
                R$ {formatCurrency(totalOverdue)}
              </p>
            </div>

            <ScrollArea className="max-h-[300px]">
              <div className="p-2 space-y-1">
                {overdueExpenses.slice(0, 10).map((expense) => (
                  <div
                    key={expense.id}
                    className="p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={handleViewAll}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {expense.description}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(expense.due_date), "dd/MM", { locale: ptBR })}
                          <span className="text-destructive">
                            ({expense.days_overdue}d atrás)
                          </span>
                        </div>
                      </div>
                      <span className="font-semibold text-sm text-destructive whitespace-nowrap">
                        R$ {formatCurrency(expense.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-3 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleViewAll}
              >
                Ver todas no Financeiro
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
