import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Users, DollarSign, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Fiado() {
  const [search, setSearch] = useState('');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedFiado, setSelectedFiado] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: fiadoSales, isLoading } = useQuery({
    queryKey: ['fiado', search],
    queryFn: async () => {
      let query = supabase
        .from('fiado_sales')
        .select(`
          *,
          fiado_sale_items(*)
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('customer_name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ['fiado-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiado_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Valor inválido');
      if (amount > selectedFiado.amount_pending) throw new Error('Valor maior que o pendente');

      // Create payment
      const { error: paymentError } = await supabase.from('fiado_payments').insert({
        fiado_sale_id: selectedFiado.id,
        amount,
        payment_method: 'dinheiro',
        user_id: user?.id,
      });
      if (paymentError) throw paymentError;

      // Update fiado sale
      const newAmountPaid = selectedFiado.amount_paid + amount;
      const newAmountPending = selectedFiado.amount_pending - amount;
      const newStatus = newAmountPending <= 0 ? 'pago' : 'pendente';

      const { error: updateError } = await supabase
        .from('fiado_sales')
        .update({
          amount_paid: newAmountPaid,
          amount_pending: newAmountPending,
          status: newStatus,
        })
        .eq('id', selectedFiado.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiado'] });
      queryClient.invalidateQueries({ queryKey: ['fiado-payments'] });
      toast.success('Pagamento registrado com sucesso!');
      setIsPaymentOpen(false);
      setSelectedFiado(null);
      setPaymentAmount('');
    },
    onError: (error: any) => {
      toast.error('Erro ao registrar pagamento', { description: error.message });
    },
  });

  const pendingFiados = fiadoSales?.filter(f => f.status === 'pendente') || [];
  const paidFiados = fiadoSales?.filter(f => f.status === 'pago') || [];
  const totalPending = pendingFiados.reduce((sum, f) => sum + Number(f.amount_pending), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fiado</h1>
          <p className="text-muted-foreground">Gerenciamento de vendas a prazo</p>
        </div>
        <Card className="px-4 py-2">
          <div className="text-sm text-muted-foreground">Total Pendente</div>
          <div className="text-2xl font-bold text-destructive">{formatCurrency(totalPending)}</div>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            Pendentes
            {pendingFiados.length > 0 && (
              <Badge variant="destructive">{pendingFiados.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="paid">Pagos</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Pendente</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : pendingFiados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-2 text-muted-foreground">Nenhum fiado pendente</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingFiados.map((fiado) => (
                      <TableRow key={fiado.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{fiado.customer_name}</p>
                            {fiado.customer_phone && (
                              <p className="text-xs text-muted-foreground">{fiado.customer_phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(fiado.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{formatCurrency(fiado.total)}</TableCell>
                        <TableCell className="text-success">{formatCurrency(fiado.amount_paid)}</TableCell>
                        <TableCell className="text-destructive font-medium">
                          {formatCurrency(fiado.amount_pending)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedFiado(fiado);
                              setIsPaymentOpen(true);
                            }}
                          >
                            <DollarSign className="mr-1 h-4 w-4" />
                            Receber
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paid">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidFiados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-2 text-muted-foreground">Nenhum fiado pago</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paidFiados.map((fiado) => (
                      <TableRow key={fiado.id}>
                        <TableCell className="font-medium">{fiado.customer_name}</TableCell>
                        <TableCell>
                          {format(new Date(fiado.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{formatCurrency(fiado.total)}</TableCell>
                        <TableCell>
                          <Badge className="bg-success">Pago</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments?.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(new Date(payment.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium text-success">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>{payment.payment_method}</TableCell>
                      <TableCell className="text-muted-foreground">{payment.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {selectedFiado && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">{selectedFiado.customer_name}</p>
                <p className="text-sm text-muted-foreground">
                  Pendente: {formatCurrency(selectedFiado.amount_pending)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Valor do Pagamento</Label>
                <Input
                  type="number"
                  step="0.01"
                  max={selectedFiado.amount_pending}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPaymentAmount(String(selectedFiado.amount_pending))}
                >
                  Pagar Tudo
                </Button>
              </div>

              <Button
                className="w-full"
                onClick={() => paymentMutation.mutate()}
                disabled={paymentMutation.isPending}
              >
                {paymentMutation.isPending ? 'Salvando...' : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirmar Pagamento
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
