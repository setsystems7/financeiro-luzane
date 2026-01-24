import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ImportFinancialDialog } from '@/components/financial/ImportFinancialDialog';
import { formatCurrency } from '@/lib/utils';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, CreditCard, Plus, Check,
  Filter, Loader2, Search, ChevronDown, ChevronUp, Percent, ArrowUpRight, Upload, Repeat, Undo2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useReceivables,
  useExpenses,
  useFinancialSummary,
  useMarkExpenseAsPaid,
  useMarkReceivableAsReceived,
  useCreateExpense,
  useFinancialRealtime
} from '@/hooks/useFinancial';
import { useCardSales, useCancelSale } from '@/hooks/useSales';
import { useSuppliersList } from '@/hooks/useSuppliers';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

export default function Financial() {
  const [receivableStatus, setReceivableStatus] = useState<'all' | 'pending' | 'received'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const defaultStart = new Date();
  defaultStart.setHours(0, 0, 0, 0);
  const defaultEnd = addDays(defaultStart, 30);

  const [expenseStatus, setExpenseStatus] = useState<'all' | 'pendente' | 'pago' | 'vencido'>('pendente');
  const [startDate, setStartDate] = useState<string>(defaultStart.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(defaultEnd.toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  // Enable realtime updates
  useFinancialRealtime();

  const { data: summary, isLoading: summaryLoading } = useFinancialSummary({
    receivableStatus,
    expenseStatus,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });
  const { data: receivables = [], isLoading: receivablesLoading } = useReceivables({
    status: receivableStatus,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses({
    status: expenseStatus,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });
  const { data: suppliers = [] } = useSuppliersList();
  const { data: cardSalesData, isLoading: cardSalesLoading } = useCardSales(
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined
  );

  const markExpenseAsPaid = useMarkExpenseAsPaid();
  const markReceivableAsReceived = useMarkReceivableAsReceived();
  const createExpense = useCreateExpense();
  const cancelSale = useCancelSale();

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      description: '',
      amount: '',
      category: '',
      due_date: '',
      supplier_id: '',
      notes: '',
      is_recurring: false,
      recurrence_months: '',
    }
  });

  const isRecurring = watch('is_recurring');

  const filteredReceivables = receivables.filter(r =>
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredExpenses = expenses.filter(e =>
    e.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateExpense = (data: any) => {
    if (!data.description || !data.amount || !data.due_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    if (data.is_recurring && (!data.recurrence_months || parseInt(data.recurrence_months) < 1)) {
      toast.error('Para despesa recorrente, informe pelo menos 1 mês');
      return;
    }

    createExpense.mutate({
      description: data.description,
      amount: parseFloat(data.amount),
      category: data.category || undefined,
      due_date: data.due_date,
      supplier_id: data.supplier_id || undefined,
      notes: data.notes || undefined,
      is_recurring: data.is_recurring,
      recurrence_months: data.is_recurring ? parseInt(data.recurrence_months) : undefined,
    }, {
      onSuccess: () => {
        reset();
        setIsExpenseDialogOpen(false);
      }
    });
  };

  const clearFilters = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = addDays(start, 30);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setSearchTerm('');
  };

  return (
    <MainLayout title="Financeiro" subtitle="Controle de contas a pagar e receber">
      <main className="space-y-6 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard
            title="Entrada Total"
            value={summaryLoading ? 'Carregando...' : `R$ ${formatCurrency(summary?.totalGrossReceivable || 0)}`}
            icon={<ArrowUpRight className="w-6 h-6 text-blue-500" />}
            description="Valor bruto com taxas"
          />
          <StatsCard
            title="Taxas Recebidas"
            value={summaryLoading ? 'Carregando...' : `R$ ${formatCurrency(summary?.totalFees || 0)}`}
            icon={<CreditCard className="w-6 h-6 text-amber-500" />}
            description="Taxas pagas pelos clientes"
          />
          <StatsCard
            title="Valor Líquido"
            value={summaryLoading ? 'Carregando...' : `R$ ${formatCurrency(summary?.totalReceivable || 0)}`}
            icon={<TrendingUp className="w-6 h-6 text-green-500" />}
            description="Valor que entra no caixa"
          />
          <StatsCard
            title="Contas a Pagar"
            value={summaryLoading ? 'Carregando...' : `R$ ${formatCurrency(summary?.totalPayable || 0)}`}
            icon={<TrendingDown className="w-6 h-6 text-red-500" />}
          />
          <StatsCard
            title="Saldo Previsto"
            value={summaryLoading ? 'Carregando...' : `R$ ${formatCurrency(summary?.balance || 0)}`}
            icon={<Wallet className="w-6 h-6 text-pink-500" />}
            variant={(summary?.balance || 0) >= 0 ? 'pink' : 'default'}
          />
        </div>

        {/* Filters */}
        <Card variant="elevated">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>

              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>

              <div className="w-40">
                <Label className="text-xs text-muted-foreground">Data Inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="w-40">
                <Label className="text-xs text-muted-foreground">Data Final</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9"
                />
              </div>

              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpar
              </Button>

              <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Importar Histórico
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="receivable" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="receivable" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Recebidos ({filteredReceivables.length})
            </TabsTrigger>
            <TabsTrigger value="payable" className="gap-2">
              <Receipt className="w-4 h-4" />
              A Pagar ({filteredExpenses.length})
            </TabsTrigger>
          </TabsList>

          {/* Receivables */}
          <TabsContent value="receivable">
            <Card variant="elevated">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Contas a Receber</CardTitle>
                <Select value={receivableStatus} onValueChange={(v: any) => setReceivableStatus(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="received">Recebidos</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {receivablesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredReceivables.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma conta a receber encontrada
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Venda #</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Bandeira</TableHead>
                        <TableHead className="text-center">Parcelas</TableHead>
                        <TableHead className="text-center">Desconto</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">Taxa</TableHead>
                        <TableHead className="text-right">Valor Líquido</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReceivables.map((item) => {
                        const sale = item.sales;
                        const paymentMethod = sale?.payment_method || '';
                        const isCardSale = paymentMethod === 'cartao_credito';
                        const installments = isCardSale ? (sale?.installments || 1) : 1;
                        const total = Number(item.amount) || 0;
                        const fee = Number(item.fee || 0);
                        const net = Number(item.net_amount || 0);
                        const discount = Number(sale?.discount || 0);
                        const subtotal = Number(sale?.total || 0);
                        const discountPercent = subtotal > 0 ? (discount / subtotal) * 100 : 0;
                        const saleItems = sale?.sale_items || [];
                        const isExpanded = expandedRows.has(item.id);

                        const paymentLabels: Record<string, string> = {
                          'dinheiro': 'Dinheiro',
                          'pix': 'PIX',
                          'cartao_credito': 'Crédito',
                          'cartao_debito': 'Débito',
                          'crediario': 'Crediário',
                        };

                        return (
                          <>
                            <TableRow
                              key={item.id}
                              className={`cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? 'bg-muted/30' : ''}`}
                              onClick={() => sale?.sale_items && sale.sale_items.length > 0 && toggleRow(item.id)}
                            >
                              <TableCell className="w-10">
                                {saleItems.length > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRow(item.id);
                                    }}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                {sale?.sale_number ? `#${sale.sale_number}` : item.description}
                              </TableCell>
                              <TableCell>
                                {sale?.created_at
                                  ? format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                                  : format(new Date(item.due_date), "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <Badge variant={isCardSale ? 'pink' : 'secondary'}>
                                  {paymentLabels[paymentMethod] || paymentMethod || '-'}
                                </Badge>
                              </TableCell>
                              <TableCell className="capitalize">
                                {isCardSale && sale?.card_brand ? sale.card_brand : '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                {isCardSale ? (
                                  <Badge variant="outline">{installments}x</Badge>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {discount > 0 ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <Percent className="w-3 h-3 mr-1" />
                                    {discountPercent.toFixed(0)}% (-R$ {formatCurrency(discount)})
                                  </Badge>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                R$ {formatCurrency(total)}
                              </TableCell>
                              <TableCell className="text-right">
                                {isCardSale && sale?.card_fee_percent != null && Number(sale.card_fee_percent) > 0 ? (
                                  <span>
                                    {Number(sale.card_fee_percent).toFixed(2)}% (+R$ {formatCurrency(fee)})
                                  </span>
                                ) : fee > 0 ? (
                                  <span>+R$ {formatCurrency(fee)}</span>
                                ) : (
                                  '-'
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                                R$ {formatCurrency(net)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={item.is_received ? 'success' : 'warning'}>
                                  {item.is_received ? 'Recebido' : 'Aguardando'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {!item.is_received && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markReceivableAsReceived.mutate(item.id);
                                      }}
                                      disabled={markReceivableAsReceived.isPending}
                                    >
                                      <Check className="w-4 h-4 mr-1" />
                                      Receber
                                    </Button>
                                  )}
                                  {item.sale_id && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Tem certeza que deseja estornar esta venda? O estoque será devolvido.')) {
                                          cancelSale.mutate(item.sale_id!);
                                        }
                                      }}
                                      disabled={cancelSale.isPending}
                                    >
                                      <Undo2 className="w-4 h-4 mr-1" />
                                      Estornar
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {/* Linha expandida com itens da venda */}
                            {isExpanded && saleItems.length > 0 && (
                              <TableRow className="bg-muted/20 hover:bg-muted/30">
                                <TableCell colSpan={12} className="p-0">
                                  <div className="px-6 py-3 border-l-4 border-pink-500 ml-4">
                                    <p className="text-sm font-medium mb-2 text-muted-foreground">Itens da venda:</p>
                                    <div className="grid gap-2">
                                      {saleItems.map((saleItem: any) => (
                                        <div
                                          key={saleItem.id}
                                          className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2 text-sm"
                                        >
                                          <div className="flex items-center gap-3">
                                            <span className="font-medium">{saleItem.product_name}</span>
                                            {saleItem.size && (
                                              <Badge variant="outline" className="text-xs">
                                                {saleItem.size}
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-4 text-muted-foreground">
                                            <span>{saleItem.quantity}x R$ {formatCurrency(saleItem.unit_price)}</span>
                                            <span className="font-semibold text-foreground">
                                              R$ {formatCurrency(saleItem.total)}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payables */}
          <TabsContent value="payable">
            <Card variant="elevated">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Contas a Pagar</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={expenseStatus} onValueChange={(v: any) => setExpenseStatus(v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pendente">Pendentes</SelectItem>
                      <SelectItem value="pago">Pagos</SelectItem>
                      <SelectItem value="vencido">Vencidos</SelectItem>
                    </SelectContent>
                  </Select>

                  <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="pink">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Despesa
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nova Despesa</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmit(handleCreateExpense)} className="space-y-4">
                        <div>
                          <Label>Descrição *</Label>
                          <Input {...register('description')} placeholder="Ex: Fornecedor A - NF 1234" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Valor *</Label>
                            <Input {...register('amount')} type="number" step="0.01" placeholder="0,00" />
                          </div>
                          <div>
                            <Label>Vencimento *</Label>
                            <Input {...register('due_date')} type="date" />
                          </div>
                        </div>
                        <div>
                          <Label>Categoria</Label>
                          <Select onValueChange={(v) => setValue('category', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fornecedor">Fornecedor</SelectItem>
                              <SelectItem value="aluguel">Aluguel</SelectItem>
                              <SelectItem value="energia">Energia</SelectItem>
                              <SelectItem value="agua">Água</SelectItem>
                              <SelectItem value="internet">Internet</SelectItem>
                              <SelectItem value="outros">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Fornecedor</Label>
                          <Select onValueChange={(v) => setValue('supplier_id', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione (opcional)" />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Observações</Label>
                          <Input {...register('notes')} placeholder="Observações adicionais" />
                        </div>
                        
                        {/* Recurrence Section */}
                        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="is_recurring"
                              checked={isRecurring}
                              onCheckedChange={(checked) => setValue('is_recurring', checked === true)}
                            />
                            <label
                              htmlFor="is_recurring"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                            >
                              <Repeat className="w-4 h-4" />
                              Despesa Recorrente
                            </label>
                          </div>
                          
                          {isRecurring && (
                            <div className="pt-2">
                              <Label>Quantos meses se repete? *</Label>
                              <Select onValueChange={(v) => setValue('recurrence_months', v)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o período" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                                    <SelectItem key={month} value={String(month)}>
                                      {month} {month === 1 ? 'mês' : 'meses'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Todas as parcelas serão criadas na mesma data de vencimento.
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button type="submit" variant="pink" disabled={createExpense.isPending}>
                            {createExpense.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Cadastrar
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {expensesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma despesa encontrada
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.category || 'Sem categoria'}</Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(item.due_date), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {formatCurrency(item.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                item.status === 'pago' ? 'success' :
                                item.status === 'vencido' ? 'destructive' :
                                'warning'
                              }
                            >
                              {item.status === 'pago' ? 'Pago' :
                               item.status === 'vencido' ? 'Vencido' :
                               'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.status !== 'pago' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markExpenseAsPaid.mutate(item.id)}
                                disabled={markExpenseAsPaid.isPending}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Pagar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Import Financial Dialog */}
        <ImportFinancialDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
        />
      </main>
    </MainLayout>
  );
}
