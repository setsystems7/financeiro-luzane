import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Plus, Search, Trash2, DollarSign, Users, AlertCircle, CheckCircle, 
  ChevronDown, CreditCard, Banknote, Clock, Receipt
} from 'lucide-react';
import { useFiadoSales, useFiadoSummary, useCreateFiadoSale, useAddFiadoPayment, FiadoSaleItem, FiadoSale } from '@/hooks/useFiado';
import { useProducts } from '@/hooks/useProducts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Fiado() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'pago' | 'parcial'>('all');
  const { data: fiadoSales = [], isLoading } = useFiadoSales(statusFilter);
  const { data: summary } = useFiadoSummary();
  const { data: products = [] } = useProducts();
  const createFiadoSale = useCreateFiadoSale();
  const addPayment = useAddFiadoPayment();

  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<FiadoSale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // New sale form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [saleItems, setSaleItems] = useState<FiadoSaleItem[]>([]);

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [paymentNotes, setPaymentNotes] = useState('');

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredSales = useMemo(() => {
    if (!searchTerm) return fiadoSales;
    const term = searchTerm.toLowerCase();
    return fiadoSales.filter(s =>
      s.customer_name.toLowerCase().includes(term) ||
      s.customer_phone?.includes(term) ||
      s.customer_cpf?.includes(term)
    );
  }, [fiadoSales, searchTerm]);

  const selectedProductData = products.find(p => p.id === selectedProduct);
  const availableSizes = selectedProductData?.sizes || [];

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleAddItem = () => {
    if (!selectedProduct || !selectedSize) {
      toast.error('Selecione um produto e tamanho');
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    const size = product?.sizes?.find(s => s.id === selectedSize);

    if (!product || !size) return;

    const newItem: FiadoSaleItem = {
      product_id: product.id,
      product_size_id: size.id,
      product_name: product.name,
      size: size.size,
      quantity,
      unit_price: product.sale_price,
      total: quantity * product.sale_price,
    };

    setSaleItems([...saleItems, newItem]);
    setSelectedProduct('');
    setSelectedSize('');
    setQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const totalSale = saleItems.reduce((acc, item) => acc + item.total, 0);

  const handleCreateSale = async () => {
    if (!customerName.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }
    if (saleItems.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    await createFiadoSale.mutateAsync({
      customer_name: customerName,
      customer_phone: customerPhone || undefined,
      customer_cpf: customerCpf || undefined,
      notes: notes || undefined,
      items: saleItems,
    });

    // Reset form
    setCustomerName('');
    setCustomerPhone('');
    setCustomerCpf('');
    setNotes('');
    setSaleItems([]);
    setIsNewSaleOpen(false);
  };

  const handleOpenPayment = (sale: FiadoSale) => {
    setSelectedSale(sale);
    setPaymentAmount(sale.amount_pending.toString());
    setPaymentMethod('dinheiro');
    setPaymentNotes('');
    setIsPaymentOpen(true);
  };

  const handleAddPayment = async () => {
    if (!selectedSale) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (amount > selectedSale.amount_pending) {
      toast.error('Valor maior que o pendente');
      return;
    }

    await addPayment.mutateAsync({
      fiado_sale_id: selectedSale.id,
      amount,
      payment_method: paymentMethod,
      notes: paymentNotes || undefined,
    });

    setIsPaymentOpen(false);
    setSelectedSale(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-green-500">Pago</Badge>;
      case 'parcial':
        return <Badge className="bg-amber-500">Parcial</Badge>;
      default:
        return <Badge variant="destructive">Pendente</Badge>;
    }
  };

  const paymentMethodLabels: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    cartao_debito: 'Débito',
    cartao_credito: 'Crédito',
  };

  return (
    <MainLayout title="Fiado" subtitle="Controle de vendas fiado e pagamentos">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="opacity-0 animate-fade-in-up stagger-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pendente</p>
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(summary?.totalPending || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Recebido</p>
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(summary?.totalReceived || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Clientes Pendentes</p>
                  <p className="text-2xl font-bold">{(summary?.pendingCount || 0) + (summary?.partialCount || 0)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Users className="w-6 h-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Fichas</p>
                  <p className="text-2xl font-bold">{summary?.totalCount || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between opacity-0 animate-fade-in-up stagger-5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por nome, telefone ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nova Venda Fiado
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Venda Fiado</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Customer Info */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Cliente *</Label>
                      <Input
                        placeholder="Nome completo"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <Input
                        placeholder="000.000.000-00"
                        value={customerCpf}
                        onChange={(e) => setCustomerCpf(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      placeholder="Observações sobre a venda..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {/* Add Items */}
                  <div className="space-y-4">
                    <Label>Adicionar Produtos</Label>
                    <div className="grid grid-cols-4 gap-2">
                      <Select value={selectedProduct} onValueChange={(v) => {
                        setSelectedProduct(v);
                        setSelectedSize('');
                      }}>
                        <SelectTrigger className="col-span-2">
                          <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(product => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - {formatCurrency(product.sale_price)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={selectedSize} onValueChange={setSelectedSize} disabled={!selectedProduct}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tamanho" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSizes.map(size => (
                            <SelectItem key={size.id} value={size.id}>
                              {size.size} ({size.quantity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                          className="w-16"
                        />
                        <Button type="button" onClick={handleAddItem} size="icon">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Items List */}
                    {saleItems.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produto</TableHead>
                              <TableHead>Tam</TableHead>
                              <TableHead className="text-center">Qtd</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {saleItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.product_name}</TableCell>
                                <TableCell>{item.size}</TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveItem(index)}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex justify-between items-center p-4 bg-destructive/10 rounded-lg">
                      <span className="font-medium">Total da Venda:</span>
                      <span className="text-2xl font-bold text-destructive">{formatCurrency(totalSale)}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateSale}
                    disabled={!customerName || saleItems.length === 0 || createFiadoSale.isPending}
                    className="w-full"
                  >
                    {createFiadoSale.isPending ? 'Registrando...' : 'Registrar Venda Fiado'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Sales List */}
        <Card className="opacity-0 animate-fade-in-up stagger-6">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filteredSales.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Nenhuma venda fiado encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Pendente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <Collapsible key={sale.id} asChild>
                      <>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleRow(sale.id)}
                              >
                                <ChevronDown className={`w-4 h-4 transition-transform ${expandedRows.has(sale.id) ? 'rotate-180' : ''}`} />
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sale.customer_name}</p>
                              {sale.customer_phone && (
                                <p className="text-xs text-muted-foreground">{sale.customer_phone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(sale.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(sale.total)}
                          </TableCell>
                          <TableCell className="text-right text-green-500">
                            {formatCurrency(sale.amount_paid)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-destructive">
                            {formatCurrency(sale.amount_pending)}
                          </TableCell>
                          <TableCell>{getStatusBadge(sale.status)}</TableCell>
                          <TableCell className="text-right">
                            {sale.status !== 'pago' && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenPayment(sale)}
                                className="gap-1"
                              >
                                <DollarSign className="w-3 h-3" />
                                Receber
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={8} className="p-4">
                              <div className="grid grid-cols-2 gap-6">
                                {/* Items */}
                                <div>
                                  <h4 className="font-medium mb-2 text-sm">Itens da Venda</h4>
                                  <div className="space-y-1">
                                    {sale.fiado_sale_items?.map((item, idx) => (
                                      <div key={idx} className="flex justify-between text-sm">
                                        <span>{item.quantity}x {item.product_name} ({item.size})</span>
                                        <span>{formatCurrency(item.total)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Payments */}
                                <div>
                                  <h4 className="font-medium mb-2 text-sm">Pagamentos</h4>
                                  {sale.fiado_payments && sale.fiado_payments.length > 0 ? (
                                    <div className="space-y-1">
                                      {sale.fiado_payments.map((payment, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                          <span>
                                            {format(new Date(payment.created_at), "dd/MM/yyyy", { locale: ptBR })} - {paymentMethodLabels[payment.payment_method] || payment.payment_method}
                                          </span>
                                          <span className="text-green-500">{formatCurrency(payment.amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
                                  )}
                                </div>
                              </div>
                              {sale.notes && (
                                <div className="mt-4 pt-4 border-t">
                                  <p className="text-sm text-muted-foreground">
                                    <strong>Obs:</strong> {sale.notes}
                                  </p>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
            </DialogHeader>

            {selectedSale && (
              <div className="space-y-6 py-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium">{selectedSale.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Pendente: <span className="text-destructive font-bold">{formatCurrency(selectedSale.amount_pending)}</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Valor do Pagamento</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                        { value: 'pix', label: 'PIX', icon: CreditCard },
                        { value: 'cartao_debito', label: 'Débito', icon: CreditCard },
                        { value: 'cartao_credito', label: 'Crédito', icon: CreditCard },
                      ].map(method => (
                        <Button
                          key={method.value}
                          type="button"
                          variant={paymentMethod === method.value ? 'default' : 'outline'}
                          className="flex-col h-auto py-3 gap-1"
                          onClick={() => setPaymentMethod(method.value)}
                        >
                          <method.icon className="w-4 h-4" />
                          <span className="text-xs">{method.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Input
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Observações do pagamento..."
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAddPayment}
                  disabled={addPayment.isPending}
                  className="w-full"
                >
                  {addPayment.isPending ? 'Registrando...' : 'Confirmar Pagamento'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
