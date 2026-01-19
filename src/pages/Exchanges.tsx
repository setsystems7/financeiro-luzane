import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCcw,
  Search,
  Plus,
  Package,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  ShoppingCart,
  Calendar,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  ArrowLeftRight,
  History,
  ClipboardList,
  ScanBarcode,
  Check
} from 'lucide-react';
import { useExchanges, useCreateExchange, useMonthExchanges, ExchangeItem } from '@/hooks/useExchanges';
import { useSales } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { toast } from 'sonner';

export default function Exchanges() {
  const [activeTab, setActiveTab] = useState('nova-troca');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [reason, setReason] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; quantity: number }>>({});
  const [newProductId, setNewProductId] = useState('');
  const [newProductSizeId, setNewProductSizeId] = useState('');
  const [newProductQty, setNewProductQty] = useState<string>('1');
  const [newItems, setNewItems] = useState<ExchangeItem[]>([]);
  const [valueDifferenceInput, setValueDifferenceInput] = useState<string>('');
  const [isManualDifference, setIsManualDifference] = useState(false);

  const [expandedExchangeId, setExpandedExchangeId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'month' | 'week'>('month');
  const [historySearch, setHistorySearch] = useState('');

  // Barcode scanner states
  const [returnBarcodeInput, setReturnBarcodeInput] = useState('');
  const [newItemBarcodeInput, setNewItemBarcodeInput] = useState('');
  const returnBarcodeRef = useRef<HTMLInputElement>(null);
  const newItemBarcodeRef = useRef<HTMLInputElement>(null);

  const { data: exchanges, isLoading: exchangesLoading } = useExchanges();
  const { data: monthStats } = useMonthExchanges();
  const { data: allSales, isLoading: salesLoading } = useSales();
  const { data: products } = useProducts();
  const createExchange = useCreateExchange();

  // Filter exchanges by date range and search
  const filteredExchanges = useMemo(() => {
    if (!exchanges) return [];

    let filtered = [...exchanges];

    // Filter by date
    const now = new Date();
    if (historyFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(e => new Date(e.created_at) >= weekAgo);
    } else if (historyFilter === 'month') {
      const monthStart = startOfMonth(now);
      filtered = filtered.filter(e => new Date(e.created_at) >= monthStart);
    }

    // Filter by search
    if (historySearch) {
      const term = historySearch.toLowerCase();
      filtered = filtered.filter((e: any) =>
        e.customer_name?.toLowerCase().includes(term) ||
        e.sales?.sale_number?.toString().includes(term) ||
        e.reason?.toLowerCase().includes(term) ||
        e.exchange_items?.some((item: any) => item.product_name?.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [exchanges, historyFilter, historySearch]);

  // Calculate stats
  const exchangeStats = useMemo(() => {
    if (!filteredExchanges.length) return { count: 0, totalReturned: 0, totalNew: 0, avgValue: 0 };

    let totalReturned = 0;
    let totalNew = 0;

    filteredExchanges.forEach((exchange: any) => {
      const returnedItems = exchange.exchange_items?.filter((i: any) => i.returned_to_stock) || [];
      const newExchangeItems = exchange.exchange_items?.filter((i: any) => !i.returned_to_stock) || [];

      returnedItems.forEach((item: any) => {
        totalReturned += (item.unit_price * item.quantity);
      });
      newExchangeItems.forEach((item: any) => {
        totalNew += (item.unit_price * item.quantity);
      });
    });

    return {
      count: filteredExchanges.length,
      totalReturned,
      totalNew,
      avgValue: totalReturned / filteredExchanges.length
    };
  }, [filteredExchanges]);

  // Filter sales that are completed (not already exchanged)
  const availableSales = useMemo(() => {
    if (!allSales) return [];
    return allSales.filter(sale => sale.status === 'concluida');
  }, [allSales]);

  // Filter by search term
  const filteredSales = useMemo(() => {
    if (!searchTerm) return availableSales;
    const term = searchTerm.toLowerCase();
    return availableSales.filter(sale =>
      sale.sale_number.toString().includes(term) ||
      sale.customer_name?.toLowerCase().includes(term) ||
      sale.id.toLowerCase().includes(term)
    );
  }, [availableSales, searchTerm]);

  const selectedProduct = products?.find(p => p.id === newProductId);
  const productSizes = selectedProduct?.sizes || [];

  // Calculate returned value
  const returnedValue = selectedSale?.sale_items?.reduce((sum: number, item: any) => {
    const selection = selectedItems[item.id];
    if (selection?.selected) {
      return sum + (item.unit_price * selection.quantity);
    }
    return sum;
  }, 0) || 0;

  // Calculate new items value
  const newItemsValue = newItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  // Auto-calculate difference: positive = customer pays, negative = credit for customer
  const calculatedDifference = newItemsValue - returnedValue;

  // Update input when calculated difference changes (only if not manually set)
  useEffect(() => {
    if (!isManualDifference) {
      setValueDifferenceInput(calculatedDifference.toFixed(2));
    }
  }, [calculatedDifference, isManualDifference]);

  // Get the actual value to use
  const finalValueDifference = isManualDifference
    ? parseFloat(valueDifferenceInput) || 0
    : calculatedDifference;

  const handleSelectSale = (sale: any) => {
    setSelectedSale(sale);
    setCustomerName(sale.customer_name || '');
    setCustomerPhone(sale.customer_phone || '');
    setSelectedItems({});
    setNewItems([]);
    setValueDifferenceInput('');
    setIsManualDifference(false);
    setReason('');
  };

  const handleClearSale = () => {
    setSelectedSale(null);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedItems({});
    setNewItems([]);
    setValueDifferenceInput('');
    setIsManualDifference(false);
    setReason('');
  };

  const handleItemSelect = (itemId: string, checked: boolean, maxQty: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { selected: checked, quantity: checked ? maxQty : 0 }
    }));
    setIsManualDifference(false);
  };

  const handleItemQtyChange = (itemId: string, value: string) => {
    const qty = parseInt(value) || 0;
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity: Math.max(0, qty) }
    }));
    setIsManualDifference(false);
  };

  const handleAddNewItem = () => {
    if (!newProductId || !newProductSizeId) return;

    const product = products?.find(p => p.id === newProductId);
    const size = product?.sizes?.find((s: any) => s.id === newProductSizeId);

    if (!product || !size) return;

    const qty = parseInt(newProductQty) || 1;

    setNewItems(prev => [...prev, {
      product_id: product.id,
      product_size_id: size.id,
      product_name: product.name,
      size: size.size,
      quantity: qty,
      unit_price: product.sale_price,
    }]);

    setNewProductId('');
    setNewProductSizeId('');
    setNewProductQty('1');
    setIsManualDifference(false);
  };

  const handleRemoveNewItem = (index: number) => {
    setNewItems(prev => prev.filter((_, i) => i !== index));
    setIsManualDifference(false);
  };

  const handleValueDifferenceChange = (value: string) => {
    setValueDifferenceInput(value);
    setIsManualDifference(true);
  };

  // Barcode scan handler for returning items from sale
  const handleReturnBarcodeScan = useCallback((barcode: string) => {
    if (!selectedSale || !barcode.trim()) return;

    // Find item in current sale that matches this barcode
    const saleItem = selectedSale.sale_items?.find((item: any) => {
      // Check if the item's product size has this barcode
      const product = products?.find(p => p.id === item.product_id);
      const sizeInfo = product?.sizes?.find((s: any) => s.id === item.product_size_id);
      return sizeInfo?.barcode === barcode.trim();
    });

    if (saleItem) {
      // Auto-select this item for return
      setSelectedItems(prev => ({
        ...prev,
        [saleItem.id]: { selected: true, quantity: saleItem.quantity }
      }));
      setIsManualDifference(false);
      toast.success(`${saleItem.product_name} (${saleItem.size}) adicionado para devolução`);
    } else {
      toast.error('Produto não encontrado nesta venda');
    }

    setReturnBarcodeInput('');
    returnBarcodeRef.current?.focus();
  }, [selectedSale, products]);

  // Barcode scan handler for adding new items
  const handleNewItemBarcodeScan = useCallback((barcode: string) => {
    if (!barcode.trim()) return;

    // Find product by barcode
    let foundProduct: any = null;
    let foundSize: any = null;

    for (const product of (products || [])) {
      if (!product.is_active) continue;
      const size = product.sizes?.find((s: any) => s.barcode === barcode.trim());
      if (size) {
        foundProduct = product;
        foundSize = size;
        break;
      }
    }

    if (foundProduct && foundSize) {
      // Check if already added
      const existingIndex = newItems.findIndex(
        item => item.product_size_id === foundSize.id
      );

      if (existingIndex >= 0) {
        // Increment quantity
        setNewItems(prev => prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
        toast.success(`${foundProduct.name} (${foundSize.size}) - quantidade aumentada`);
      } else {
        // Add new item
        setNewItems(prev => [...prev, {
          product_id: foundProduct.id,
          product_size_id: foundSize.id,
          product_name: foundProduct.name,
          size: foundSize.size,
          quantity: 1,
          unit_price: foundProduct.sale_price,
        }]);
        toast.success(`${foundProduct.name} (${foundSize.size}) adicionado`);
      }
      setIsManualDifference(false);
    } else {
      toast.error('Produto não encontrado');
    }

    setNewItemBarcodeInput('');
    newItemBarcodeRef.current?.focus();
  }, [products, newItems]);

  // Handle Enter key on barcode inputs
  const handleBarcodeKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    type: 'return' | 'new'
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'return') {
        handleReturnBarcodeScan(returnBarcodeInput);
      } else {
        handleNewItemBarcodeScan(newItemBarcodeInput);
      }
    }
  };

  const handleSubmit = () => {
    if (!selectedSale) return;

    const returnedItems: ExchangeItem[] = selectedSale.sale_items
      .filter((item: any) => selectedItems[item.id]?.selected)
      .map((item: any) => ({
        product_id: item.product_id,
        product_size_id: item.product_size_id,
        product_name: item.product_name,
        size: item.size,
        quantity: selectedItems[item.id].quantity,
        unit_price: item.unit_price,
      }));

    if (returnedItems.length === 0) {
      return;
    }

    createExchange.mutate({
      original_sale_id: selectedSale.id,
      customer_name: customerName || selectedSale.customer_name,
      customer_phone: customerPhone || selectedSale.customer_phone,
      reason,
      returned_items: returnedItems,
      new_items: newItems.length > 0 ? newItems : undefined,
      value_difference: finalValueDifference,
    }, {
      onSuccess: () => {
        handleClearSale();
      }
    });
  };

  return (
    <MainLayout title="Trocas e Devoluções" subtitle="Gerencie trocas de produtos e controle financeiro">
      <div className="space-y-4">
        {/* Stats Cards - Compact */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatsCard
            title="Trocas"
            value={exchangeStats.count.toString()}
            icon={<ArrowLeftRight className="w-5 h-5 text-primary" />}
            description={historyFilter === 'week' ? '7 dias' : historyFilter === 'month' ? 'Este mês' : 'Total'}
          />
          <StatsCard
            title="Devolvido"
            value={`R$ ${exchangeStats.totalReturned.toFixed(0)}`}
            icon={<TrendingDown className="w-5 h-5 text-destructive" />}
          />
          <StatsCard
            title="Novos"
            value={`R$ ${exchangeStats.totalNew.toFixed(0)}`}
            icon={<ShoppingCart className="w-5 h-5 text-success" />}
          />
          <StatsCard
            title="Média"
            value={`R$ ${exchangeStats.avgValue.toFixed(0)}`}
            icon={<DollarSign className="w-5 h-5 text-warning" />}
          />
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="nova-troca" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nova Troca
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Histórico
              {filteredExchanges.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {filteredExchanges.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Nova Troca Tab */}
          <TabsContent value="nova-troca" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Sales List */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingCart className="w-5 h-5" />
                    Selecionar Venda
                  </CardTitle>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nº, cliente ou ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {salesLoading ? (
                    <p className="text-muted-foreground p-4">Carregando vendas...</p>
                  ) : (
                    <ScrollArea className="h-[50vh] max-h-[500px]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
                        {filteredSales.slice(0, 50).map((sale) => (
                          <div
                            key={sale.id}
                            onClick={() => handleSelectSale(sale)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent ${
                              selectedSale?.id === sale.id
                                ? 'border-primary bg-primary/5 ring-2 ring-primary'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="outline" className="font-mono text-xs">
                                #{sale.sale_number}
                              </Badge>
                              <span className="text-sm font-semibold text-primary">
                                R$ {Number(sale.final_total).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(sale.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </div>
                            {sale.customer_name && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {sale.customer_name}
                              </p>
                            )}
                          </div>
                        ))}
                        {filteredSales.length === 0 && (
                          <p className="text-center text-sm text-muted-foreground py-8 col-span-2">
                            Nenhuma venda encontrada
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ClipboardList className="w-5 h-5" />
                      {selectedSale ? `Venda #${selectedSale.sale_number}` : 'Detalhes da Troca'}
                    </span>
                    {selectedSale && (
                      <Button variant="ghost" size="sm" onClick={handleClearSale}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedSale ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Selecione uma venda ao lado para iniciar</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[50vh] max-h-[500px] pr-3">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <Badge variant="outline" className="font-mono">Venda #{selectedSale.sale_number}</Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(selectedSale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          <span className="text-lg font-bold text-primary">
                            R$ {Number(selectedSale.final_total).toFixed(2)}
                          </span>
                        </div>

                        {/* Customer Info */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Cliente</Label>
                            <Input
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              placeholder="Nome"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Telefone</Label>
                            <Input
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              placeholder="Telefone"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>

                        {/* Items to Return */}
                        <div className="space-y-3">
                          <Label className="flex items-center gap-2 text-xs font-medium">
                            <ArrowLeft className="w-3 h-3 text-destructive" />
                            Produtos Devolvidos (voltam ao estoque)
                          </Label>

                          {/* Barcode Scanner for Returns */}
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                ref={returnBarcodeRef}
                                value={returnBarcodeInput}
                                onChange={(e) => setReturnBarcodeInput(e.target.value)}
                                onKeyDown={(e) => handleBarcodeKeyDown(e, 'return')}
                                placeholder="Bipar código de barras..."
                                className="pl-9 h-9 font-mono"
                                autoComplete="off"
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-9"
                              onClick={() => handleReturnBarcodeScan(returnBarcodeInput)}
                              disabled={!returnBarcodeInput.trim()}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="space-y-1 max-h-[200px] overflow-y-auto">
                            {selectedSale.sale_items?.map((item: any) => (
                              <div
                                key={item.id}
                                className={`flex items-center gap-2 p-2 border rounded text-sm transition-all ${
                                  selectedItems[item.id]?.selected
                                    ? 'bg-destructive/10 border-destructive/30'
                                    : 'bg-background'
                                }`}
                              >
                                <Checkbox
                                  checked={selectedItems[item.id]?.selected || false}
                                  onCheckedChange={(checked) => handleItemSelect(item.id, !!checked, item.quantity)}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{item.product_name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    Tam: {item.size} • R$ {item.unit_price.toFixed(2)}
                                  </p>
                                </div>
                                {selectedItems[item.id]?.selected && (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="destructive" className="text-[10px]">
                                      Devolver
                                    </Badge>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={item.quantity}
                                      value={selectedItems[item.id].quantity || ''}
                                      onChange={(e) => handleItemQtyChange(item.id, e.target.value)}
                                      className="w-12 h-6 text-center text-xs"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {returnedValue > 0 && (
                            <div className="flex items-center justify-between p-2 rounded bg-destructive/10 border border-destructive/20">
                              <span className="text-xs font-medium text-destructive">Total devolvido:</span>
                              <span className="text-sm font-bold text-destructive">R$ {returnedValue.toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        {/* New Items */}
                        <div className="space-y-3">
                          <Label className="flex items-center gap-2 text-xs font-medium">
                            <ArrowRight className="w-3 h-3 text-success" />
                            Novos Produtos (saem do estoque)
                          </Label>

                          {/* Barcode Scanner for New Items */}
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                ref={newItemBarcodeRef}
                                value={newItemBarcodeInput}
                                onChange={(e) => setNewItemBarcodeInput(e.target.value)}
                                onKeyDown={(e) => handleBarcodeKeyDown(e, 'new')}
                                placeholder="Bipar código de barras..."
                                className="pl-9 h-9 font-mono"
                                autoComplete="off"
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-9"
                              onClick={() => handleNewItemBarcodeScan(newItemBarcodeInput)}
                              disabled={!newItemBarcodeInput.trim()}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Manual Selection (collapsible) */}
                          <details className="group">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Ou selecionar manualmente...
                            </summary>
                            <div className="mt-2 space-y-2">
                              <div className="flex gap-1">
                                <Select value={newProductId} onValueChange={(v) => { setNewProductId(v); setNewProductSizeId(''); }}>
                                  <SelectTrigger className="flex-1 h-8 text-xs">
                                    <SelectValue placeholder="Produto" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {products?.filter(p => p.is_active).map(product => (
                                      <SelectItem key={product.id} value={product.id}>
                                        {product.name} - R$ {product.sale_price.toFixed(2)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {newProductId && (
                                <div className="flex gap-1">
                                  <Select value={newProductSizeId} onValueChange={setNewProductSizeId}>
                                    <SelectTrigger className="flex-1 h-8 text-xs">
                                      <SelectValue placeholder="Tamanho" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {productSizes.map((size: any) => (
                                        <SelectItem key={size.id} value={size.id}>
                                          {size.size} ({size.quantity} disp.)
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={newProductQty}
                                    onChange={(e) => setNewProductQty(e.target.value)}
                                    className="w-14 h-8 text-xs"
                                    placeholder="Qtd"
                                  />
                                  <Button onClick={handleAddNewItem} size="icon" className="h-8 w-8" disabled={!newProductSizeId}>
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </details>

                          {/* Added Items List */}
                          {newItems.length > 0 && (
                            <div className="space-y-1">
                              {newItems.map((item, index) => (
                                <div key={index} className="flex items-center justify-between p-2 border rounded bg-green-50 dark:bg-green-950/20 text-xs">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Badge variant="secondary" className="text-[10px] bg-green-100 dark:bg-green-900/30">
                                      Novo
                                    </Badge>
                                    <span className="truncate">
                                      {item.product_name} ({item.size}) x{item.quantity}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-success">
                                      R$ {(item.unit_price * item.quantity).toFixed(2)}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleRemoveNewItem(index)}
                                    >
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <div className="flex items-center justify-between p-2 rounded bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                                <span className="text-xs font-medium text-success">Total novos:</span>
                                <span className="text-sm font-bold text-success">R$ {newItemsValue.toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Reason */}
                        <div className="space-y-1">
                          <Label className="text-xs">Motivo da Troca</Label>
                          <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Descreva o motivo..."
                            rows={2}
                            className="text-sm"
                          />
                        </div>

                        {/* Value Difference */}
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium">Diferença de Valor</Label>
                            <Badge
                              variant={finalValueDifference > 0 ? 'default' : finalValueDifference < 0 ? 'destructive' : 'secondary'}
                              className="text-[10px]"
                            >
                              {finalValueDifference > 0 ? 'Cliente paga' : finalValueDifference < 0 ? 'Crédito p/ cliente' : 'Sem diferença'}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground mb-1">
                            Calculado: R$ {calculatedDifference.toFixed(2)} • Editável abaixo
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">R$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={valueDifferenceInput}
                              onChange={(e) => handleValueDifferenceChange(e.target.value)}
                              className="text-base font-bold h-9"
                              placeholder="0.00"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Positivo = cliente paga • Negativo = crédito para cliente
                          </p>
                        </div>

                        <Button
                          onClick={handleSubmit}
                          className="w-full"
                          disabled={createExchange.isPending || Object.values(selectedItems).every(i => !i.selected)}
                        >
                          {createExchange.isPending ? 'Registrando...' : 'Confirmar Troca'}
                        </Button>
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Histórico Tab */}
          <TabsContent value="historico" className="mt-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="w-5 h-5" />
                    Histórico de Trocas
                  </CardTitle>

                  {/* Filters */}
                  <div className="flex gap-1">
                    <Button
                      variant={historyFilter === 'week' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setHistoryFilter('week')}
                    >
                      7 dias
                    </Button>
                    <Button
                      variant={historyFilter === 'month' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setHistoryFilter('month')}
                    >
                      Mês
                    </Button>
                    <Button
                      variant={historyFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setHistoryFilter('all')}
                    >
                      Tudo
                    </Button>
                  </div>
                </div>

                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente, produto, motivo..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {exchangesLoading ? (
                  <p className="text-muted-foreground text-center py-8">Carregando...</p>
                ) : filteredExchanges.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredExchanges.map((exchange: any) => {
                      const returnedItems = exchange.exchange_items?.filter((i: any) => i.returned_to_stock) || [];
                      const newExchangeItems = exchange.exchange_items?.filter((i: any) => !i.returned_to_stock) || [];
                      const valueDiff = (exchange.credit_used || 0) - (exchange.credit_amount || 0);
                      const isExpanded = expandedExchangeId === exchange.id;

                      const returnedTotal = returnedItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0);
                      const newTotal = newExchangeItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0);

                      return (
                        <div
                          key={exchange.id}
                          className={`border rounded-lg transition-all ${isExpanded ? 'bg-muted/50 ring-1 ring-primary/30' : 'bg-muted/30 hover:bg-muted/40'}`}
                        >
                          {/* Header - Always visible */}
                          <div
                            className="p-3 cursor-pointer"
                            onClick={() => setExpandedExchangeId(isExpanded ? null : exchange.id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs font-mono">
                                  {exchange.sales?.sale_number ? `#${exchange.sales.sale_number}` : 'Avulsa'}
                                </Badge>
                                {exchange.customer_name && (
                                  <span className="text-xs font-medium truncate max-w-[100px]">
                                    {exchange.customer_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(exchange.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-destructive">
                                  ← {returnedItems.length} item{returnedItems.length !== 1 ? 's' : ''}
                                </span>
                                {newExchangeItems.length > 0 && (
                                  <span className="text-success">
                                    → {newExchangeItems.length} item{newExchangeItems.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <Badge
                                variant={valueDiff > 0 ? 'default' : valueDiff < 0 ? 'destructive' : 'secondary'}
                                className="text-[10px]"
                              >
                                {valueDiff > 0 ? `+R$ ${valueDiff.toFixed(2)}` : valueDiff < 0 ? `-R$ ${Math.abs(valueDiff).toFixed(2)}` : 'R$ 0,00'}
                              </Badge>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="px-3 pb-3 border-t space-y-3 pt-3">
                              {/* Returned Items */}
                              {returnedItems.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-destructive flex items-center gap-1">
                                    <ArrowLeft className="w-3 h-3" />
                                    Devolvidos (voltaram ao estoque)
                                  </p>
                                  <div className="bg-destructive/5 rounded p-2 space-y-1">
                                    {returnedItems.map((item: any, idx: number) => (
                                      <div key={idx} className="flex justify-between text-xs">
                                        <span>
                                          {item.product_name}
                                          <span className="text-muted-foreground"> ({item.size})</span>
                                          <span className="text-muted-foreground"> x{item.quantity}</span>
                                        </span>
                                        <span className="font-medium">
                                          R$ {(item.unit_price * item.quantity).toFixed(2)}
                                        </span>
                                      </div>
                                    ))}
                                    <div className="flex justify-between text-xs font-bold pt-1 border-t border-destructive/20">
                                      <span>Total devolvido</span>
                                      <span className="text-destructive">R$ {returnedTotal.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* New Items */}
                              {newExchangeItems.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-success flex items-center gap-1">
                                    <ArrowRight className="w-3 h-3" />
                                    Novos (saíram do estoque)
                                  </p>
                                  <div className="bg-success/5 rounded p-2 space-y-1">
                                    {newExchangeItems.map((item: any, idx: number) => (
                                      <div key={idx} className="flex justify-between text-xs">
                                        <span>
                                          {item.product_name}
                                          <span className="text-muted-foreground"> ({item.size})</span>
                                          <span className="text-muted-foreground"> x{item.quantity}</span>
                                        </span>
                                        <span className="font-medium">
                                          R$ {(item.unit_price * item.quantity).toFixed(2)}
                                        </span>
                                      </div>
                                    ))}
                                    <div className="flex justify-between text-xs font-bold pt-1 border-t border-success/20">
                                      <span>Total novos</span>
                                      <span className="text-success">R$ {newTotal.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Financial Summary */}
                              <div className="bg-primary/5 rounded p-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Diferença financeira</span>
                                  <span className={`font-bold ${valueDiff > 0 ? 'text-primary' : valueDiff < 0 ? 'text-destructive' : ''}`}>
                                    {valueDiff > 0 ? 'Cliente pagou' : valueDiff < 0 ? 'Crédito cliente' : 'Sem diferença'}: R$ {Math.abs(valueDiff).toFixed(2)}
                                  </span>
                                </div>
                              </div>

                              {/* Reason */}
                              {exchange.reason && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Motivo: </span>
                                  <span className="italic">{exchange.reason}</span>
                                </div>
                              )}

                              {/* Customer Phone */}
                              {exchange.customer_phone && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Telefone: </span>
                                  <span>{exchange.customer_phone}</span>
                                </div>
                              )}

                              {/* Exchange ID */}
                              <p className="text-[10px] text-muted-foreground/60 font-mono">
                                ID: {exchange.id}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <RefreshCcw className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Nenhuma troca encontrada</p>
                    <p className="text-xs">Ajuste os filtros ou período</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
