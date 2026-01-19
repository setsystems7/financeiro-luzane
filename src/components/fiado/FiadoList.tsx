import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Eye,
  Check,
  X
} from 'lucide-react';
import { useFiadoSales, useApproveFiadoSale, useCancelFiadoSale } from '@/hooks/useFiado';
import { FiadoDetailsDialog } from './FiadoDetailsDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
  aprovado: { label: 'Aprovado', color: 'bg-blue-500', icon: CheckCircle },
  pago: { label: 'Pago', color: 'bg-green-500', icon: DollarSign },
  cancelado: { label: 'Cancelado', color: 'bg-red-500', icon: XCircle },
};

export function FiadoList() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const { data: fiadoSales, isLoading } = useFiadoSales();
  const approveFiadoSale = useApproveFiadoSale();
  const cancelFiadoSale = useCancelFiadoSale();

  const filteredSales = fiadoSales?.filter(sale => {
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    const matchesSearch = !searchTerm ||
      sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer_phone?.includes(searchTerm) ||
      sale.customer_cpf?.includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  const handleApprove = async (saleId: string) => {
    await approveFiadoSale.mutateAsync(saleId);
  };

  const handleCancel = async (saleId: string) => {
    if (confirm('Tem certeza que deseja cancelar esta venda? O estoque será devolvido.')) {
      await cancelFiadoSale.mutateAsync(saleId);
    }
  };

  // Calculate summary stats
  const stats = {
    pending: fiadoSales?.filter(s => s.status === 'pendente').length || 0,
    approved: fiadoSales?.filter(s => s.status === 'aprovado').length || 0,
    paid: fiadoSales?.filter(s => s.status === 'pago').length || 0,
    totalPending: fiadoSales
      ?.filter(s => s.status === 'pendente' || s.status === 'aprovado')
      .reduce((acc, s) => acc + Number(s.amount_pending), 0) || 0,
  };

  return (
    <>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-sm text-muted-foreground">Aprovados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.paid}</p>
                  <p className="text-sm text-muted-foreground">Quitados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    R$ {stats.totalPending.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">A Receber</p>
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
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="grid w-full grid-cols-5 mb-4">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="pendente">Pendentes</TabsTrigger>
                <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
                <TabsTrigger value="pago">Pagos</TabsTrigger>
                <TabsTrigger value="cancelado">Cancelados</TabsTrigger>
              </TabsList>

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
                      const status = statusConfig[sale.status] || statusConfig.pendente;
                      const StatusIcon = status.icon;
                      return (
                        <div
                          key={sale.id}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{sale.customer_name}</h3>
                                <Badge
                                  variant="secondary"
                                  className={`${status.color} text-white`}
                                >
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {status.label}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>
                                  {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                                <p>
                                  {sale.installments}x de R$ {(Number(sale.total) / sale.installments).toFixed(2)}
                                </p>
                                {sale.customer_phone && (
                                  <p>Tel: {sale.customer_phone}</p>
                                )}
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
                              {Number(sale.amount_pending) > 0 && sale.status !== 'pago' && (
                                <div className="text-sm">
                                  <span className="text-orange-600">
                                    Pendente: R$ {Number(sale.amount_pending).toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedSaleId(sale.id)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Detalhes
                              </Button>

                              {sale.status === 'pendente' && (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleApprove(sale.id)}
                                    disabled={approveFiadoSale.isPending}
                                  >
                                    <Check className="w-4 h-4 mr-1" />
                                    Aprovar
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleCancel(sale.id)}
                                    disabled={cancelFiadoSale.isPending}
                                  >
                                    <X className="w-4 h-4 mr-1" />
                                    Cancelar
                                  </Button>
                                </>
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
    </>
  );
}
