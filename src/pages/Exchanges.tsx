import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, RefreshCw, Trash2, Package, CreditCard, History } from 'lucide-react';
import { useExchanges, useCreateExchange, useActiveExchanges, ExchangeItem } from '@/hooks/useExchanges';
import { useProducts } from '@/hooks/useProducts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Exchanges() {
  const { data: exchanges = [], isLoading } = useExchanges();
  const { data: activeExchanges = [] } = useActiveExchanges();
  const { data: products = [] } = useProducts();
  const createExchange = useCreateExchange();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [reason, setReason] = useState('');
  const [returnToStock, setReturnToStock] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [exchangeItems, setExchangeItems] = useState<ExchangeItem[]>([]);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredExchanges = useMemo(() => {
    if (!searchTerm) return exchanges;
    const term = searchTerm.toLowerCase();
    return exchanges.filter(e => 
      e.customer_name?.toLowerCase().includes(term) ||
      e.customer_phone?.includes(term) ||
      e.reason?.toLowerCase().includes(term)
    );
  }, [exchanges, searchTerm]);

  const selectedProductData = products.find(p => p.id === selectedProduct);
  const availableSizes = selectedProductData?.sizes || [];

  const handleAddItem = () => {
    if (!selectedProduct || !selectedSize) {
      toast.error('Selecione um produto e tamanho');
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    const size = product?.sizes?.find(s => s.id === selectedSize);

    if (!product || !size) return;

    const newItem: ExchangeItem = {
      product_id: product.id,
      product_size_id: size.id,
      product_name: product.name,
      size: size.size,
      quantity,
      unit_price: product.sale_price,
    };

    setExchangeItems([...exchangeItems, newItem]);
    setSelectedProduct('');
    setSelectedSize('');
    setQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    setExchangeItems(exchangeItems.filter((_, i) => i !== index));
  };

  const totalCredit = exchangeItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);

  const handleSubmit = async () => {
    if (exchangeItems.length === 0) {
      toast.error('Adicione pelo menos um item à troca');
      return;
    }

    await createExchange.mutateAsync({
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      reason: reason || undefined,
      items: exchangeItems,
      return_to_stock: returnToStock,
    });

    // Reset form
    setCustomerName('');
    setCustomerPhone('');
    setReason('');
    setExchangeItems([]);
    setReturnToStock(true);
    setIsDialogOpen(false);
  };

  const getRemainingCredit = (exchange: any) => {
    return exchange.credit_amount - (exchange.credit_used || 0);
  };

  return (
    <MainLayout title="Trocas e Devoluções" subtitle="Gerencie trocas de produtos e créditos">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="opacity-0 animate-fade-in-up stagger-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Trocas</p>
                  <p className="text-2xl font-bold">{exchanges.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Créditos Ativos</p>
                  <p className="text-2xl font-bold">{activeExchanges.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total em Créditos</p>
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(activeExchanges.reduce((acc, e) => acc + getRemainingCredit(e), 0))}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                  <Package className="w-6 h-6 text-pink-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por cliente, telefone ou motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Troca
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Nova Troca</DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Cliente</Label>
                    <Input
                      placeholder="Nome do cliente"
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
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label>Motivo da Troca</Label>
                  <Textarea
                    placeholder="Descreva o motivo da troca..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Return to Stock */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Devolver ao Estoque</p>
                    <p className="text-sm text-muted-foreground">
                      Os produtos serão adicionados de volta ao estoque
                    </p>
                  </div>
                  <Switch
                    checked={returnToStock}
                    onCheckedChange={setReturnToStock}
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
                            {product.name}
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
                            {size.size}
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
                  {exchangeItems.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Tamanho</TableHead>
                            <TableHead className="text-center">Qtd</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {exchangeItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{item.product_name}</TableCell>
                              <TableCell>{item.size}</TableCell>
                              <TableCell className="text-center">{item.quantity}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.quantity * item.unit_price)}
                              </TableCell>
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
                  <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg">
                    <span className="font-medium">Crédito Total:</span>
                    <span className="text-2xl font-bold text-primary">{formatCurrency(totalCredit)}</span>
                  </div>
                </div>

                {/* Submit */}
                <Button
                  onClick={handleSubmit}
                  disabled={exchangeItems.length === 0 || createExchange.isPending}
                  className="w-full"
                >
                  {createExchange.isPending ? 'Registrando...' : 'Registrar Troca'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="history" className="opacity-0 animate-fade-in-up stagger-4">
          <TabsList>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Créditos Ativos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Carregando...</div>
                ) : filteredExchanges.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhuma troca encontrada</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Itens</TableHead>
                        <TableHead className="text-right">Crédito</TableHead>
                        <TableHead className="text-right">Usado</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExchanges.map((exchange) => (
                        <TableRow key={exchange.id}>
                          <TableCell>
                            {format(new Date(exchange.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{exchange.customer_name || 'Não informado'}</p>
                              {exchange.customer_phone && (
                                <p className="text-xs text-muted-foreground">{exchange.customer_phone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {exchange.reason || '-'}
                          </TableCell>
                          <TableCell>
                            {exchange.exchange_items?.length || 0} itens
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(exchange.credit_amount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(exchange.credit_used || 0)}
                          </TableCell>
                          <TableCell>
                            {getRemainingCredit(exchange) > 0 ? (
                              <Badge variant="default" className="bg-green-500">
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                Utilizado
                              </Badge>
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

          <TabsContent value="active" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {activeExchanges.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhum crédito ativo</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead className="text-right">Crédito Original</TableHead>
                        <TableHead className="text-right">Saldo Disponível</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeExchanges.map((exchange) => (
                        <TableRow key={exchange.id}>
                          <TableCell>
                            {format(new Date(exchange.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-medium">
                            {exchange.customer_name || 'Não informado'}
                          </TableCell>
                          <TableCell>
                            {exchange.customer_phone || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(exchange.credit_amount)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-green-500">
                            {formatCurrency(getRemainingCredit(exchange))}
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
      </div>
    </MainLayout>
  );
}
