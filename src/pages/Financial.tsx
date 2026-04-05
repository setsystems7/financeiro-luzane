import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type SupportSection } from '@/components/layout/SupportButton';
import { Wallet as WalletIcon, Receipt as ReceiptIcon, CreditCard as CreditCardIcon, Filter as FilterIcon, Upload as UploadIcon, HelpCircle, Calendar as CalendarSupportIcon, DollarSign as DollarSupportIcon, FileSpreadsheet as FileIcon, Landmark } from 'lucide-react';
import { InsertCashDialog } from '@/components/financial/InsertCashDialog';
import { KpiDetailDialog } from '@/components/financial/KpiDetailDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ImportFinancialDialog } from '@/components/financial/ImportFinancialDialog';
import { ExpenseCategoryDialog } from '@/components/financial/ExpenseCategoryDialog';
import { formatCurrency, cn } from '@/lib/utils';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, CreditCard, Plus, Check,
  Filter, Loader2, Search, ChevronDown, ChevronUp, Percent, ArrowUpRight, Upload, Repeat, Undo2, Pencil, Trash2
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
  useFinancialRealtime,
  useUpdateExpenseDueDate,
  useUpdateExpenseCategory,
  useUpdateExpenseDescription,
  useCanDeleteRecurringExpense,
  useDeleteExpense,
  useDeleteReceivable,
  useUpdateReceivable,
  type Expense
} from '@/hooks/useFinancial';
import { useExpenseCategories } from '@/hooks/useExpenseCategories';
import { useCardSales, useCancelSale } from '@/hooks/useSales';
import { useSuppliersList } from '@/hooks/useSuppliers';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

export default function Financial() {
  const [receivableStatus, setReceivableStatus] = useState<'all' | 'pending' | 'received'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Default to current month period
  const [expenseStatus, setExpenseStatus] = useState<'all' | 'pendente' | 'pago' | 'vencido'>('all');
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  }, []);
  const defaultEndDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  }, []);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isInsertCashOpen, setIsInsertCashOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editDueDate, setEditDueDate] = useState<Date | undefined>(undefined);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [editingCategoryExpenseId, setEditingCategoryExpenseId] = useState<string | null>(null);
  const [editingDescriptionExpenseId, setEditingDescriptionExpenseId] = useState<string | null>(null);
  const [editDescriptionValue, setEditDescriptionValue] = useState<string>('');
  
  // Payment dialog state
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null);
  const [paymentInterest, setPaymentInterest] = useState<string>('');
  const [paymentAmountPaid, setPaymentAmountPaid] = useState<string>('');

  // KPI detail dialog
  const [kpiDetailType, setKpiDetailType] = useState<'entrada' | 'taxas' | 'caixa' | 'pagar' | 'saldo' | null>(null);

  // Confirm dialog states
  const [confirmCancelSaleId, setConfirmCancelSaleId] = useState<string | null>(null);
  const [confirmDeleteExpenseId, setConfirmDeleteExpenseId] = useState<string | null>(null);
  const [confirmDeleteReceivableId, setConfirmDeleteReceivableId] = useState<string | null>(null);

  // Edit manual entry state
  const [editingReceivable, setEditingReceivable] = useState<{ id: string; amount: string; description: string; notes: string } | null>(null);

  const financialSupportSections: SupportSection[] = [
    {
      title: 'O que é o módulo Financeiro',
      icon: HelpCircle,
      tag: 'essencial',
      content: 'O módulo Financeiro centraliza todo o controle de dinheiro da loja. Ele tem duas abas principais: "A Receber" (dinheiro das vendas) e "A Pagar" (despesas e contas).',
    },
    {
      title: 'Como lançar uma despesa',
      icon: ReceiptIcon,
      tag: 'essencial',
      content: 'Para registrar uma conta a pagar:',
      steps: [
        { text: 'Vá na aba "A Pagar" (segunda aba).' },
        { text: 'Clique no botão "Nova Despesa".' },
        { text: 'Preencha: descrição (ex: "Aluguel da loja"), valor, data de vencimento e categoria.' },
        { text: 'Opcionalmente, selecione o fornecedor e adicione observações.' },
        { text: 'Para despesas que se repetem todo mês, marque "Despesa Recorrente" e informe quantos meses.', tip: 'O sistema criará uma despesa para cada mês automaticamente.' },
        { text: 'Clique em "Criar Despesa" para salvar.' },
      ],
    },
    {
      title: 'Como pagar uma despesa',
      icon: DollarSupportIcon,
      tag: 'essencial',
      content: 'Quando for pagar uma conta:',
      steps: [
        { text: 'Na aba "A Pagar", encontre a despesa na lista.' },
        { text: 'Clique no botão "Pagar" (ícone de ✓) ao lado da despesa.' },
        { text: 'Se a despesa tem juros (ex: paga com atraso), informe o valor dos juros.' },
        { text: 'Informe o valor efetivamente pago.' },
        { text: 'Confirme o pagamento. O status mudará para "Pago".' },
      ],
      tips: [
        'Despesas vencidas aparecem destacadas em vermelho.',
        'Juros são registrados separadamente para controle financeiro preciso.',
      ],
    },
    {
      title: 'Como usar os filtros',
      icon: FilterIcon,
      content: 'Encontre despesas e recebíveis específicos:',
      steps: [
        { text: 'Use a barra de busca para pesquisar por descrição.' },
        { text: 'Defina data inicial e final para limitar o período.' },
        { text: 'Selecione o status: Todos, Pendentes, Pagos ou Vencidos.' },
        { text: 'Clique em "Limpar" para resetar todos os filtros.' },
      ],
    },
    {
      title: 'Como importar planilha',
      icon: FileIcon,
      tag: 'avançado',
      content: 'Importe dados financeiros de planilha Excel:',
      steps: [
        { text: 'Clique em "Importar Histórico" na barra de ferramentas.' },
        { text: 'Selecione o arquivo Excel (.xlsx) do seu computador.' },
        { text: 'Confira os dados importados e confirme.' },
      ],
      warning: 'A planilha deve seguir o formato esperado com colunas: descrição, valor, data de vencimento, categoria e status.',
    },
    {
      title: 'Perguntas frequentes',
      icon: HelpCircle,
      tag: 'dica',
      content: 'Dúvidas comuns sobre o financeiro:',
      tips: [
        'Como estornar uma venda? Na aba "Recebidos", clique em "Estornar" ao lado da venda.',
        'Posso editar uma despesa? Sim! Clique nos campos de descrição, categoria ou data para editar direto na tabela.',
        'O que é "Valor do Caixa"? É o dinheiro líquido que entra no caixa, já descontadas as taxas de cartão.',
        'Despesas recorrentes só podem ser excluídas se forem a última parcela da série.',
      ],
    },
  ];
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
  const { data: expenseCategories = [] } = useExpenseCategories();
  const { data: cardSalesData, isLoading: cardSalesLoading } = useCardSales(
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined
  );

  const markExpenseAsPaid = useMarkExpenseAsPaid();
  const markReceivableAsReceived = useMarkReceivableAsReceived();
  const createExpense = useCreateExpense();
  const cancelSale = useCancelSale();
  const updateExpenseDueDate = useUpdateExpenseDueDate();
  const updateExpenseCategory = useUpdateExpenseCategory();
  const updateExpenseDescription = useUpdateExpenseDescription();
  const canDeleteRecurringExpense = useCanDeleteRecurringExpense();
  const deleteExpense = useDeleteExpense();
  const deleteReceivable = useDeleteReceivable();
  const updateReceivable = useUpdateReceivable();

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

  // Pagination
  const ITEMS_PER_PAGE = 20;
  const [receivablePage, setReceivablePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);

  const receivableTotalPages = Math.max(1, Math.ceil(filteredReceivables.length / ITEMS_PER_PAGE));
  const expenseTotalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));

  const paginatedReceivables = filteredReceivables.slice(
    (receivablePage - 1) * ITEMS_PER_PAGE,
    receivablePage * ITEMS_PER_PAGE
  );
  const paginatedExpenses = filteredExpenses.slice(
    (expensePage - 1) * ITEMS_PER_PAGE,
    expensePage * ITEMS_PER_PAGE
  );

  // Totals
  const receivableTotals = useMemo(() => ({
    amount: filteredReceivables.reduce((acc, r) => acc + Number(r.amount || 0), 0),
    fee: filteredReceivables.reduce((acc, r) => acc + Number(r.fee || 0), 0),
    net: filteredReceivables.reduce((acc, r) => acc + Number(r.net_amount || 0), 0),
  }), [filteredReceivables]);

  const expenseTotals = useMemo(() => {
    const byStatus = { pago: 0, vencido: 0, pendente: 0 };
    let amount = 0, interest = 0, paid = 0;
    filteredExpenses.forEach(e => {
      const val = Number(e.amount || 0);
      amount += val;
      interest += Number(e.interest_amount || 0);
      paid += Number(e.amount_paid || (e.status === 'pago' ? e.amount : 0));
      if (e.status === 'pago') byStatus.pago += val;
      else if (e.status === 'vencido') byStatus.vencido += val;
      else byStatus.pendente += val;
    });
    return { amount, interest, paid, byStatus, count: filteredExpenses.length };
  }, [filteredExpenses]);

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
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    setSearchTerm('');
    setExpenseStatus('all');
  };

  return (
    <MainLayout title="Financeiro" subtitle="Controle de contas a pagar e receber" supportContent={{ moduleName: 'Financeiro', sections: financialSupportSections }}>
      <main className="space-y-4 md:space-y-6 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          <div onClick={() => setKpiDetailType('entrada')} className="cursor-pointer h-full">
            <StatsCard
              title="Entrada de Vendas"
              value={summaryLoading ? '...' : `R$ ${formatCurrency(summary?.totalGrossReceivable || 0)}`}
              icon={<ArrowUpRight className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />}
              description="Valor bruto com taxas"
            />
          </div>
          <div onClick={() => setKpiDetailType('caixa')} className="cursor-pointer h-full">
            <StatsCard
              title="Valor do Caixa"
              value={summaryLoading ? '...' : `R$ ${formatCurrency(summary?.totalReceivable || 0)}`}
              icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-500" />}
              description="Valor que entra no caixa"
            />
          </div>
          <div onClick={() => setKpiDetailType('pagar')} className="cursor-pointer h-full">
            <StatsCard
              title="Contas a Pagar"
              value={summaryLoading ? '...' : `R$ ${formatCurrency(summary?.totalPayable || 0)}`}
              icon={<TrendingDown className="w-5 h-5 md:w-6 md:h-6 text-red-500" />}
              description={
                summaryLoading ? '' : 
                summary?.totalOverdue && summary.totalOverdue > 0 
                  ? `Mês: R$ ${formatCurrency(summary.totalMonthPayable || 0)} | Atraso: R$ ${formatCurrency(summary.totalOverdue)}`
                  : `Despesas do período`
              }
            />
          </div>
          <div onClick={() => setKpiDetailType('saldo')} className="cursor-pointer h-full">
            <StatsCard
              title={`Saldo Previsto - ${format(new Date(startDate), 'MMMM', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}`}
              value={summaryLoading ? '...' : `R$ ${formatCurrency(summary?.balance || 0)}`}
              icon={<Wallet className="w-5 h-5 md:w-6 md:h-6 text-pink-500" />}
              variant={(summary?.balance || 0) >= 0 ? 'pink' : 'default'}
              description="Caixa - Contas a Pagar"
            />
          </div>
        </div>

        {/* Filters */}
        <Card variant="elevated">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                <div className="sm:col-span-2 lg:col-span-1">
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

                <div>
                  <Label className="text-xs text-muted-foreground">Data Inicial</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Data Final</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="flex items-end">
                  <Button variant="outline" size="sm" onClick={clearFilters} className="h-9">
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)} className="h-9">
                  <Upload className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Importar Histórico</span>
                  <span className="sm:hidden">Importar</span>
                </Button>

                <Button size="sm" onClick={() => setIsInsertCashOpen(true)} className="bg-green-600 hover:bg-green-700 text-white h-9">
                  <Landmark className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Inserir no Caixa</span>
                  <span className="sm:hidden">Inserir</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="receivable" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="receivable" className="gap-1 md:gap-2 text-xs md:text-sm">
              <CreditCard className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Recebidos</span>
              <span className="sm:hidden">Receb.</span>
              ({filteredReceivables.length})
            </TabsTrigger>
            <TabsTrigger value="payable" className="gap-1 md:gap-2 text-xs md:text-sm">
              <Receipt className="w-3.5 h-3.5 md:w-4 md:h-4" />
              A Pagar ({filteredExpenses.length})
            </TabsTrigger>
          </TabsList>

          {/* Receivables */}
          <TabsContent value="receivable">
            <Card variant="elevated">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4 md:p-6">
                <CardTitle className="text-lg md:text-2xl">Contas a Receber</CardTitle>
                <Select value={receivableStatus} onValueChange={(v: any) => setReceivableStatus(v)}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="received">Recebidos</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="p-2 md:p-6 pt-0">
                {receivablesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredReceivables.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma conta a receber encontrada
                  </div>
                ) : (
                  <>
                  <div className="overflow-x-auto -mx-2 md:mx-0">
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
                      {paginatedReceivables.map((item) => {
                        const sale = item.sales;
                        const isSplitSale = item.description?.includes(' - ');
                        
                        // For split payments, extract the real method from the receivable description
                        // Description format: "Venda #60 - Dinheiro" or "Venda #60 - Crédito"
                        let paymentMethod = sale?.payment_method || '';
                        if (isSplitSale && item.description) {
                          const methodMatch = item.description.match(/- (Dinheiro|PIX|Débito|Crédito|Crediário)(?:\s|$)/i);
                          if (methodMatch) {
                            const labelToMethod: Record<string, string> = {
                              'dinheiro': 'dinheiro', 'pix': 'pix', 'débito': 'cartao_debito',
                              'crédito': 'cartao_credito', 'crediário': 'crediario',
                            };
                            paymentMethod = labelToMethod[methodMatch[1].toLowerCase()] || paymentMethod;
                          }
                        }
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
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); toggleRow(item.id); }}>
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{sale?.sale_number ? `#${sale.sale_number}` : item.description}</TableCell>
                              <TableCell>{sale?.created_at ? format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : format(new Date(item.due_date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                              <TableCell><Badge variant={isCardSale ? 'pink' : 'secondary'}>{paymentLabels[paymentMethod] || paymentMethod || '-'}</Badge></TableCell>
                              <TableCell className="capitalize">{isCardSale && sale?.card_brand ? sale.card_brand : '-'}</TableCell>
                              <TableCell className="text-center">{isCardSale ? <Badge variant="outline">{installments}x</Badge> : '-'}</TableCell>
                              <TableCell className="text-center">
                                {discount > 0 ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <Percent className="w-3 h-3 mr-1" />{discountPercent.toFixed(0)}% (-R$ {formatCurrency(discount)})
                                  </Badge>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-semibold">R$ {formatCurrency(total)}</TableCell>
                              <TableCell className="text-right">
                                {isCardSale && sale?.card_fee_percent != null && Number(sale.card_fee_percent) > 0 ? (
                                  <span>{Number(sale.card_fee_percent).toFixed(2)}% (+R$ {formatCurrency(fee)})</span>
                                ) : fee > 0 ? <span>+R$ {formatCurrency(fee)}</span> : '-'}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">R$ {formatCurrency(net)}</TableCell>
                              <TableCell className="text-center"><Badge variant={item.is_received ? 'success' : 'warning'}>{item.is_received ? 'Recebido' : 'Aguardando'}</Badge></TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {!item.is_received && (
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); markReceivableAsReceived.mutate(item.id); }} disabled={markReceivableAsReceived.isPending}>
                                      <Check className="w-4 h-4 mr-1" />Receber
                                    </Button>
                                  )}
                                  {item.sale_id && (
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setConfirmCancelSaleId(item.sale_id!); }} disabled={cancelSale.isPending}>
                                      <Undo2 className="w-4 h-4 mr-1" />Estornar
                                    </Button>
                                  )}
                                  {!item.sale_id && (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingReceivable({ id: item.id, amount: String(item.amount || 0), description: item.description, notes: item.notes || '' }); }}>
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setConfirmDeleteReceivableId(item.id); }}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && saleItems.length > 0 && (
                              <TableRow className="bg-muted/20 hover:bg-muted/30">
                                <TableCell colSpan={12} className="p-0">
                                  <div className="px-6 py-3 border-l-4 border-pink-500 ml-4">
                                    <p className="text-sm font-medium mb-2 text-muted-foreground">Itens da venda:</p>
                                    <div className="grid gap-2">
                                      {saleItems.map((saleItem: any) => (
                                        <div key={saleItem.id} className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2 text-sm">
                                          <div className="flex items-center gap-3">
                                            <span className="font-medium">{saleItem.product_name}</span>
                                            {saleItem.size && <Badge variant="outline" className="text-xs">{saleItem.size}</Badge>}
                                          </div>
                                          <div className="flex items-center gap-4 text-muted-foreground">
                                            <span>{saleItem.quantity}x R$ {formatCurrency(saleItem.unit_price)}</span>
                                            <span className="font-semibold text-foreground">R$ {formatCurrency(saleItem.total)}</span>
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
                    <tfoot>
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={7} className="text-right">Totais:</TableCell>
                        <TableCell className="text-right">R$ {formatCurrency(receivableTotals.amount)}</TableCell>
                        <TableCell className="text-right">R$ {formatCurrency(receivableTotals.fee)}</TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">R$ {formatCurrency(receivableTotals.net)}</TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </tfoot>
                  </Table>
                  </div>
                  {receivableTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                      <span className="text-sm text-muted-foreground">Página {receivablePage} de {receivableTotalPages} ({filteredReceivables.length} registros)</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setReceivablePage(p => Math.max(1, p - 1))} disabled={receivablePage === 1}>Anterior</Button>
                        <Button variant="outline" size="sm" onClick={() => setReceivablePage(p => Math.min(receivableTotalPages, p + 1))} disabled={receivablePage === receivableTotalPages}>Próxima</Button>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payables */}
          <TabsContent value="payable">
            <Card variant="elevated">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4 md:p-6">
                <CardTitle className="text-lg md:text-2xl">Contas a Pagar</CardTitle>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Select value={expenseStatus} onValueChange={(v: any) => setExpenseStatus(v)}>
                    <SelectTrigger className="w-full sm:w-40">
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
                          <div className="flex gap-2">
                            <Select 
                              value={selectedCategoryId}
                              onValueChange={(v) => {
                                setSelectedCategoryId(v);
                                const cat = expenseCategories.find(c => c.id === v);
                                setValue('category', cat?.name || v);
                              }}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {expenseCategories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedCategoryId && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="shrink-0"
                                onClick={() => {
                                  const cat = expenseCategories.find(c => c.id === selectedCategoryId);
                                  if (cat) {
                                    setEditingCategory({ id: cat.id, name: cat.name });
                                    setIsCategoryDialogOpen(true);
                                  }
                                }}
                                title="Editar categoria"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="shrink-0"
                              onClick={() => {
                                setEditingCategory(null);
                                setIsCategoryDialogOpen(true);
                              }}
                              title="Adicionar categoria"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
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
              <CardContent className="p-2 md:p-6 pt-0">
                {expensesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma despesa encontrada
                  </div>
                ) : (
                  <>
                  <div className="overflow-x-auto -mx-2 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Juros</TableHead>
                        <TableHead className="text-right">Total Pago</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedExpenses.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {editingDescriptionExpenseId === item.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editDescriptionValue}
                                  onChange={(e) => setEditDescriptionValue(e.target.value)}
                                  className="h-8"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      updateExpenseDescription.mutate({ id: item.id, description: editDescriptionValue });
                                      setEditingDescriptionExpenseId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingDescriptionExpenseId(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    if (editDescriptionValue !== item.description) {
                                      updateExpenseDescription.mutate({ id: item.id, description: editDescriptionValue });
                                    }
                                    setEditingDescriptionExpenseId(null);
                                  }}
                                />
                              </div>
                            ) : (
                              <div 
                                className="flex flex-col cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                                onClick={() => {
                                  setEditingDescriptionExpenseId(item.id);
                                  setEditDescriptionValue(item.description);
                                }}
                              >
                                <span>{item.description}</span>
                                {item.is_recurring && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Repeat className="w-3 h-3" />
                                    Recorrente
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingCategoryExpenseId === item.id ? (
                              <Select
                                value={expenseCategories.find(c => c.name === item.category)?.id || ''}
                                onValueChange={(catId) => {
                                  const cat = expenseCategories.find(c => c.id === catId);
                                  if (cat) {
                                    updateExpenseCategory.mutate({ id: item.id, category: cat.name });
                                  }
                                  setEditingCategoryExpenseId(null);
                                }}
                                open={true}
                                onOpenChange={(open) => {
                                  if (!open) setEditingCategoryExpenseId(null);
                                }}
                              >
                                <SelectTrigger className="w-[140px] h-8">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseCategories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge 
                                variant="outline" 
                                className="cursor-pointer hover:bg-muted transition-colors"
                                onClick={() => setEditingCategoryExpenseId(item.id)}
                              >
                                {item.category || 'Sem categoria'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{format(new Date(item.due_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}</span>
                              {item.status !== 'pago' && (
                                <Popover 
                                  open={editingExpenseId === item.id} 
                                  onOpenChange={(open) => {
                                    if (open) {
                                      setEditingExpenseId(item.id);
                                      // Usa meio-dia para evitar problemas de timezone
                                      setEditDueDate(new Date(item.due_date + 'T12:00:00'));
                                    } else {
                                      setEditingExpenseId(null);
                                      setEditDueDate(undefined);
                                    }
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={editingExpenseId === item.id ? editDueDate : undefined}
                                      onSelect={(date) => {
                                        if (date) {
                                          const newDueDate = format(date, 'yyyy-MM-dd');
                                          const expenseId = item.id;
                                          
                                          // Fecha popover imediatamente
                                          setEditingExpenseId(null);
                                          setEditDueDate(undefined);
                                          
                                          // Dispara update (otimista já vai atualizar a tela na hora)
                                          updateExpenseDueDate.mutate({ id: expenseId, due_date: newDueDate });
                                        }
                                      }}
                                      locale={ptBR}
                                      initialFocus
                                      className="pointer-events-auto"
                                    />
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {formatCurrency(item.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.interest_amount || 0) > 0 ? (
                              <span className="text-destructive font-medium">R$ {formatCurrency(Number(item.interest_amount))}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.amount_paid != null ? (
                              <span className="font-semibold">R$ {formatCurrency(Number(item.amount_paid))}</span>
                            ) : item.status === 'pago' ? (
                              <span className="font-semibold">R$ {formatCurrency(item.amount)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
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
                            <div className="flex items-center justify-center gap-1">
                              {item.status !== 'pago' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setPayingExpense(item);
                                    setPaymentInterest('0');
                                    setPaymentAmountPaid(String(item.amount));
                                  }}
                                  disabled={markExpenseAsPaid.isPending}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Pagar
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={async () => {
                                  // Check if can delete recurring expense
                                  const result = await canDeleteRecurringExpense(item);
                                  if (!result.canDelete) {
                                    toast.error(result.reason || 'Não é possível excluir esta despesa.');
                                    return;
                                  }
                                  setConfirmDeleteExpenseId(item.id);
                                }}
                                disabled={deleteExpense.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot>
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={3} className="text-right">
                          Totais ({expenseTotals.count} registros):
                        </TableCell>
                        <TableCell className="text-right">R$ {formatCurrency(expenseTotals.amount)}</TableCell>
                        <TableCell className="text-right">{expenseTotals.interest > 0 ? `R$ ${formatCurrency(expenseTotals.interest)}` : '-'}</TableCell>
                        <TableCell className="text-right">R$ {formatCurrency(expenseTotals.paid)}</TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                      <TableRow className="bg-muted/30 text-sm">
                        <TableCell colSpan={3} className="text-right text-muted-foreground">
                          Resumo por status:
                        </TableCell>
                        <TableCell colSpan={5} className="text-left">
                          <div className="flex flex-wrap gap-3">
                            <span className="text-green-600 dark:text-green-400">
                              Pagos: R$ {formatCurrency(expenseTotals.byStatus.pago)}
                            </span>
                            <span className="text-destructive">
                              Vencidos: R$ {formatCurrency(expenseTotals.byStatus.vencido)}
                            </span>
                            <span className="text-yellow-600 dark:text-yellow-400">
                              Pendentes: R$ {formatCurrency(expenseTotals.byStatus.pendente)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    </tfoot>
                  </Table>
                  </div>
                  {expenseTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                      <span className="text-sm text-muted-foreground">Página {expensePage} de {expenseTotalPages} ({filteredExpenses.length} registros)</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setExpensePage(p => Math.max(1, p - 1))} disabled={expensePage === 1}>Anterior</Button>
                        <Button variant="outline" size="sm" onClick={() => setExpensePage(p => Math.min(expenseTotalPages, p + 1))} disabled={expensePage === expenseTotalPages}>Próxima</Button>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Payment Dialog */}
        <Dialog open={!!payingExpense} onOpenChange={(open) => { if (!open) setPayingExpense(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
            </DialogHeader>
            {payingExpense && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-sm font-medium">{payingExpense.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Vencimento: {format(new Date(payingExpense.due_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor da Parcela</Label>
                    <Input
                      value={`R$ ${formatCurrency(payingExpense.amount)}`}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <Label>Juros / Multa</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={paymentInterest}
                      onChange={(e) => {
                        setPaymentInterest(e.target.value);
                        const interest = parseFloat(e.target.value) || 0;
                        setPaymentAmountPaid(String((payingExpense.amount + interest).toFixed(2)));
                      }}
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <Label>Total Pago</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentAmountPaid}
                    onChange={(e) => setPaymentAmountPaid(e.target.value)}
                    className="text-lg font-bold"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Parcela (R$ {formatCurrency(payingExpense.amount)}) + Juros (R$ {formatCurrency(parseFloat(paymentInterest) || 0)})
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setPayingExpense(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="pink"
                    disabled={markExpenseAsPaid.isPending}
                    onClick={() => {
                      const interest = parseFloat(paymentInterest) || 0;
                      const totalPaid = parseFloat(paymentAmountPaid) || payingExpense.amount;
                      markExpenseAsPaid.mutate(
                        { id: payingExpense.id, interest_amount: interest, amount_paid: totalPaid },
                        { onSuccess: () => setPayingExpense(null) }
                      );
                    }}
                  >
                    {markExpenseAsPaid.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Confirmar Pagamento
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Import Financial Dialog */}
        <ImportFinancialDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
        />

        {/* Expense Category Dialog */}
        <ExpenseCategoryDialog
          open={isCategoryDialogOpen}
          onOpenChange={(open) => {
            setIsCategoryDialogOpen(open);
            if (!open) setEditingCategory(null);
          }}
          editCategory={editingCategory}
          onSuccess={(categoryId, categoryName) => {
            setSelectedCategoryId(categoryId);
            setValue('category', categoryName);
          }}
        />

        <ConfirmDialog
          open={!!confirmCancelSaleId}
          onOpenChange={(open) => !open && setConfirmCancelSaleId(null)}
          onConfirm={() => {
            if (confirmCancelSaleId) {
              cancelSale.mutate(confirmCancelSaleId);
              setConfirmCancelSaleId(null);
            }
          }}
          title="Estornar venda"
          description="Tem certeza que deseja estornar esta venda? O estoque será devolvido."
          confirmText="Estornar"
          variant="destructive"
        />

        <ConfirmDialog
          open={!!confirmDeleteExpenseId}
          onOpenChange={(open) => !open && setConfirmDeleteExpenseId(null)}
          onConfirm={() => {
            if (confirmDeleteExpenseId) {
              deleteExpense.mutate(confirmDeleteExpenseId);
              setConfirmDeleteExpenseId(null);
            }
          }}
          title="Excluir despesa"
          description="Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita."
          confirmText="Excluir"
          variant="destructive"
        />

        <ConfirmDialog
          open={!!confirmDeleteReceivableId}
          onOpenChange={(open) => !open && setConfirmDeleteReceivableId(null)}
          onConfirm={() => {
            if (confirmDeleteReceivableId) {
              deleteReceivable.mutate(confirmDeleteReceivableId);
              setConfirmDeleteReceivableId(null);
            }
          }}
          title="Excluir entrada"
          description="Tem certeza que deseja excluir esta entrada do caixa? Esta ação não pode ser desfeita."
          confirmText="Excluir"
          variant="destructive"
        />

        {/* Edit manual entry dialog */}
        <Dialog open={!!editingReceivable} onOpenChange={(open) => { if (!open) setEditingReceivable(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Entrada Manual</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingReceivable?.amount || ''}
                  onChange={(e) => setEditingReceivable(prev => prev ? { ...prev, amount: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={editingReceivable?.description || ''}
                  onChange={(e) => setEditingReceivable(prev => prev ? { ...prev, description: e.target.value } : null)}
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Input
                  value={editingReceivable?.notes || ''}
                  onChange={(e) => setEditingReceivable(prev => prev ? { ...prev, notes: e.target.value } : null)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingReceivable(null)}>Cancelar</Button>
                <Button onClick={() => {
                  if (editingReceivable) {
                    const amt = parseFloat(editingReceivable.amount);
                    updateReceivable.mutate({
                      id: editingReceivable.id,
                      data: {
                        amount: amt,
                        net_amount: amt,
                        description: editingReceivable.description,
                        notes: editingReceivable.notes || undefined,
                      }
                    }, {
                      onSuccess: () => setEditingReceivable(null),
                    });
                  }
                }} disabled={updateReceivable.isPending}>
                  {updateReceivable.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <InsertCashDialog open={isInsertCashOpen} onOpenChange={setIsInsertCashOpen} />

        <KpiDetailDialog
          open={!!kpiDetailType}
          onOpenChange={(open) => { if (!open) setKpiDetailType(null); }}
          type={kpiDetailType}
          summary={summary}
        />
      </main>
    </MainLayout>
  );
}
