import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Search,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  X,
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
  AlertTriangle,
  CircleDot,
  MessageCircle
} from 'lucide-react';
import { useFiadoSales, useCancelFiadoSale, useDeleteFiadoSale } from '@/hooks/useFiado';
import { FiadoDetailsDialog } from './FiadoDetailsDialog';
import { FiadoEditDialog } from './FiadoEditDialog';
import { format, isPast, isToday, addDays, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type FilterType = 'all' | 'pendente' | 'parcial' | 'atrasado' | 'pago' | 'cancelado';

const getEffectiveStatus = (sale: any): string => {
  if (sale.status === 'pago' || sale.status === 'cancelado') return sale.status;
  
  // Has partial payment
  if (Number(sale.amount_paid) > 0 && Number(sale.amount_pending) > 0) {
    // Check if overdue
    if (sale.due_date) {
      const dueDate = new Date(sale.due_date + 'T12:00:00');
      if (isPast(dueDate) && !isToday(dueDate)) return 'atrasado';
    }
    return 'parcial';
  }
  
  // No payment yet, check if overdue
  if (sale.due_date) {
    const dueDate = new Date(sale.due_date + 'T12:00:00');
    if (isPast(dueDate) && !isToday(dueDate)) return 'atrasado';
  }
  
  return 'pendente';
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
  parcial: { label: 'Parcial', color: 'bg-blue-500', icon: CircleDot },
  atrasado: { label: 'Atrasado', color: 'bg-red-500', icon: AlertTriangle },
  pago: { label: 'Pago', color: 'bg-green-500', icon: CheckCircle },
  cancelado: { label: 'Cancelado', color: 'bg-muted-foreground', icon: XCircle },
};

export function FiadoList() {
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: fiadoSales, isLoading } = useFiadoSales();
  const cancelFiadoSale = useCancelFiadoSale();
  const deleteFiadoSale = useDeleteFiadoSale();

  // Enrich sales with effective status
  const enrichedSales = fiadoSales?.map(sale => ({
    ...sale,
    effectiveStatus: getEffectiveStatus(sale),
  }));

  const filteredSales = enrichedSales?.filter(sale => {
    const matchesStatus = statusFilter === 'all' || sale.effectiveStatus === statusFilter;
    const matchesSearch = !searchTerm ||
      sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer_phone?.includes(searchTerm) ||
      sale.customer_cpf?.includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  const handleCancel = async (saleId: string) => {
    setConfirmCancelId(saleId);
  };

  const handleDelete = async (saleId: string) => {
    setConfirmDeleteId(saleId);
  };

  // Alert: fiados vencendo nos próximos 3 dias
  const expiringFiados = enrichedSales?.filter(sale => {
    if (sale.effectiveStatus === 'pago' || sale.effectiveStatus === 'cancelado') return false;
    if (!sale.due_date) return false;
    const dueDate = new Date(sale.due_date + 'T12:00:00');
    const now = new Date();
    const threeDaysFromNow = addDays(now, 3);
    return isAfter(dueDate, now) && isBefore(dueDate, threeDaysFromNow);
  }) || [];

  // Calculate summary stats
  const stats = {
    pendente: enrichedSales?.filter(s => s.effectiveStatus === 'pendente').length || 0,
    parcial: enrichedSales?.filter(s => s.effectiveStatus === 'parcial').length || 0,
    atrasado: enrichedSales?.filter(s => s.effectiveStatus === 'atrasado').length || 0,
    pago: enrichedSales?.filter(s => s.effectiveStatus === 'pago').length || 0,
    totalPending: enrichedSales
      ?.filter(s => s.effectiveStatus !== 'pago' && s.effectiveStatus !== 'cancelado')
      .reduce((acc, s) => acc + Number(s.amount_pending), 0) || 0,
  };

  return (
    <>
      <div className="space-y-6">
        {/* Alerta de fiados vencendo nos próximos 3 dias */}
        {expiringFiados.length > 0 && (
          <Card className="border-warning bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <h3 className="font-semibold text-warning">Fiados vencendo nos próximos 3 dias</h3>
              </div>
              <div className="space-y-2">
                {expiringFiados.map(sale => (
                  <div key={sale.id} className="flex items-center justify-between text-sm p-2 bg-card rounded-lg">
                    <div>
                      <span className="font-medium">{sale.customer_name}</span>
                      <span className="text-muted-foreground ml-2">
                        Vence: {format(new Date(sale.due_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                      <span className="text-primary ml-2 font-semibold">
                        R$ {Number(sale.amount_pending).toFixed(2)}
                      </span>
                    </div>
                    {sale.customer_phone && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => {
                          const phone = sale.customer_phone!.replace(/\D/g, '');
                          const message = encodeURIComponent(`Olá ${sale.customer_name}, tudo bem? Passando para lembrar que seu fiado no valor de R$ ${Number(sale.amount_pending).toFixed(2)} vence em ${format(new Date(sale.due_date + 'T12:00:00'), 'dd/MM/yyyy')}. Aguardamos seu pagamento!`);
                          window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
                        }}
                      >
                        <MessageCircle className="w-3 h-3" />
                        WhatsApp
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <Card className="cursor-pointer hover:ring-2 hover:ring-yellow-500/50 transition-all" onClick={() => setStatusFilter('pendente')}>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-full bg-yellow-500/10">
                  <Clock className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold">{stats.pendente}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all" onClick={() => setStatusFilter('parcial')}>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-full bg-blue-500/10">
                  <CircleDot className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold">{stats.parcial}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Parcial</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:ring-2 hover:ring-red-500/50 transition-all" onClick={() => setStatusFilter('atrasado')}>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-full bg-red-500/10">
                  <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold">{stats.atrasado}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Atrasados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:ring-2 hover:ring-green-500/50 transition-all" onClick={() => setStatusFilter('pago')}>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-full bg-green-500/10">
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xl md:text-2xl font-bold">{stats.pago}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">Pagos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setStatusFilter('all')}>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 rounded-full bg-primary/10">
                  <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg md:text-2xl font-bold truncate">
                    R$ {stats.totalPending.toFixed(2)}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">A Receber</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <CardTitle className="text-lg">Vendas Fiado</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterType)}>
              <div className="overflow-x-auto -mx-2 px-2 pb-2">
                <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:max-w-2xl md:grid-cols-5 mb-4">
                  <TabsTrigger value="all" className="text-xs md:text-sm">Todos</TabsTrigger>
                  <TabsTrigger value="pendente" className="text-xs md:text-sm">Pendentes</TabsTrigger>
                  <TabsTrigger value="parcial" className="text-xs md:text-sm">Parcial</TabsTrigger>
                  <TabsTrigger value="atrasado" className="text-xs md:text-sm">Atrasados</TabsTrigger>
                  <TabsTrigger value="pago" className="text-xs md:text-sm">Pagos</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="h-[500px]">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : filteredSales?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma venda fiado encontrada
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSales?.map((sale) => {
                      const effStatus = statusConfig[sale.effectiveStatus] || statusConfig.pendente;
                      const StatusIcon = effStatus.icon;
                      return (
                        <div
                          key={sale.id}
                          className={`border rounded-lg p-4 hover:bg-muted/50 transition-colors ${
                            sale.effectiveStatus === 'atrasado' ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10' : ''
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{sale.customer_name}</h3>
                                <Badge
                                  variant="secondary"
                                  className={`${effStatus.color} text-white`}
                                >
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {effStatus.label}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>
                                  {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                                {sale.due_date && (
                                  <p className={`flex items-center gap-1 ${
                                    sale.effectiveStatus === 'atrasado' ? 'text-red-600 font-semibold' : ''
                                  }`}>
                                    <CalendarIcon className="w-3 h-3" />
                                    Vence: {format(new Date(sale.due_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                                    {sale.effectiveStatus === 'atrasado' && ' (Atrasado!)'}
                                  </p>
                                )}
                                <p>
                                  {sale.installments}x de R$ {(Number(sale.total) / sale.installments).toFixed(2)}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-lg font-bold text-primary">
                                R$ {Number(sale.total).toFixed(2)}
                              </div>
                              {Number(sale.amount_paid) > 0 && (
                                <div className="text-sm">
                                  <span className="text-green-600">
                                    Pago: R$ {Number(sale.amount_paid).toFixed(2)}
                                  </span>
                                </div>
                              )}
                              {Number(sale.amount_pending) > 0 && sale.effectiveStatus !== 'pago' && (
                                <div className="text-sm">
                                  <span className="text-orange-600">
                                    Pendente: R$ {Number(sale.amount_pending).toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {Number(sale.amount_pending) > 0 && sale.effectiveStatus !== 'cancelado' && sale.effectiveStatus !== 'pago' && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => setSelectedSaleId(sale.id)}
                                  className="text-xs md:text-sm"
                                >
                                  <DollarSign className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                                  <span className="hidden sm:inline">Registrar Pagamento</span>
                                  <span className="sm:hidden">Pagar</span>
                                </Button>
                              )}

                              {sale.effectiveStatus !== 'cancelado' && sale.effectiveStatus !== 'pago' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingSaleId(sale.id)}
                                    className="text-xs md:text-sm"
                                  >
                                    <Pencil className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                                    <span className="hidden sm:inline">Editar</span>
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCancel(sale.id)}
                                    disabled={cancelFiadoSale.isPending}
                                    className="text-xs md:text-sm text-destructive hover:text-destructive"
                                  >
                                    <X className="w-3 h-3 md:w-4 md:h-4" />
                                  </Button>
                                </>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(sale.id)}
                                disabled={deleteFiadoSale.isPending}
                                className="text-xs md:text-sm text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                              </Button>

                              {/* WhatsApp button */}
                              {sale.customer_phone && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs md:text-sm gap-1"
                                  onClick={() => {
                                    const phone = sale.customer_phone!.replace(/\D/g, '');
                                    const message = encodeURIComponent(`Olá ${sale.customer_name}, tudo bem? Passando para falar sobre o seu fiado no valor de R$ ${Number(sale.amount_pending).toFixed(2)}.`);
                                    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
                                  }}
                                >
                                  <MessageCircle className="w-3 h-3 md:w-4 md:h-4" />
                                  <span className="hidden sm:inline">WhatsApp</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      {selectedSaleId && (
        <FiadoDetailsDialog
          saleId={selectedSaleId}
          open={!!selectedSaleId}
          onClose={() => setSelectedSaleId(null)}
        />
      )}

      {/* Edit Dialog */}
      {editingSaleId && (
        <FiadoEditDialog
          saleId={editingSaleId}
          open={!!editingSaleId}
          onClose={() => setEditingSaleId(null)}
        />
      )}

      {/* Confirm Cancel */}
      <ConfirmDialog
        open={!!confirmCancelId}
        onOpenChange={(open) => !open && setConfirmCancelId(null)}
        onConfirm={async () => {
          if (confirmCancelId) {
            await cancelFiadoSale.mutateAsync(confirmCancelId);
            setConfirmCancelId(null);
          }
        }}
        title="Cancelar venda fiado"
        description="Tem certeza que deseja cancelar esta venda? O estoque será devolvido."
        confirmText="Cancelar Venda"
        variant="destructive"
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        onConfirm={async () => {
          if (confirmDeleteId) {
            await deleteFiadoSale.mutateAsync(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        title="Excluir venda fiado"
        description="Tem certeza que deseja EXCLUIR esta venda? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="destructive"
      />
    </>
  );
}
