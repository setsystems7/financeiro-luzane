import { useState, useRef, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useProducts, Product } from '@/hooks/useProducts';
import { useStockMovements, useAddStock, useAdjustStock } from '@/hooks/useStock';
import { Barcode, Plus, Minus, Package, History, Search, Loader2, Download, HelpCircle, ScanBarcode, FileSpreadsheet, ChevronDown, ChevronUp, ArrowDownCircle, Settings2 } from 'lucide-react';
import { format, subDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { type SupportSection } from '@/components/layout/SupportButton';

const stockSupportSections: SupportSection[] = [
  {
    title: 'O que é o módulo Estoque',
    icon: HelpCircle,
    tag: 'essencial',
    content: 'O módulo de Estoque permite dar entrada e saída de mercadorias, visualizar o estoque atual de todos os produtos e acompanhar o histórico completo de movimentações.',
  },
  {
    title: 'Como dar entrada de estoque (abastecer)',
    icon: Plus,
    tag: 'essencial',
    content: 'Use o "Abastecimento Rápido" no topo da página para dar entrada de mercadorias:',
    steps: [
      { text: 'Na seção "Abastecimento Rápido", escaneie o código de barras do produto OU selecione manualmente o produto e tamanho nos campos abaixo.', tip: 'O leitor de código de barras funciona automaticamente — basta escanear com o cursor em qualquer lugar da página.' },
      { text: 'Defina a quantidade que está entrando (ex: 5 unidades do tamanho M).' },
      { text: 'Clique em "Adicionar ao Estoque" para confirmar a entrada.' },
      { text: 'O sistema registra a movimentação automaticamente e atualiza o estoque do produto.' },
    ],
    tips: [
      'Você pode dar entrada de vários tamanhos seguidos — o sistema limpa o formulário após cada entrada.',
      'Toda entrada aparece no histórico de movimentações com data e hora.',
    ],
  },
  {
    title: 'Como registrar saída ou ajuste manual',
    icon: ArrowDownCircle,
    tag: 'essencial',
    content: 'Para saídas (perdas, doações) ou corrigir o estoque:',
    steps: [
      { text: 'Na tabela "Estoque Atual", encontre o produto e clique nele para expandir os tamanhos.' },
      { text: 'Clique no botão "Saída" para registrar uma saída manual (ex: peça danificada).' },
      { text: 'Ou clique em "Ajustar" para definir uma nova quantidade exata de estoque (ex: contagem física).' },
      { text: 'Informe a quantidade e uma observação opcional, depois confirme.' },
    ],
    warning: 'Saídas manuais descontam do estoque imediatamente. Use com cuidado.',
  },
  {
    title: 'Como usar o leitor de código de barras',
    icon: ScanBarcode,
    content: 'O sistema detecta automaticamente leitores de código de barras USB:',
    steps: [
      { text: 'Conecte o leitor USB ao computador — ele funciona como um teclado.' },
      { text: 'Escaneie o código de barras do produto em qualquer momento.' },
      { text: 'O sistema identifica automaticamente o produto e tamanho correspondente ao código.' },
    ],
    tips: [
      'Cada tamanho pode ter seu próprio código de barras — configure no cadastro do produto.',
      'Se o código não for encontrado, verifique o cadastro em Produtos.',
    ],
  },
  {
    title: 'Como exportar estoque para Excel',
    icon: FileSpreadsheet,
    tag: 'avançado',
    content: 'Exporte a planilha completa do estoque:',
    steps: [
      { text: 'Na seção "Estoque Atual", clique no botão "Exportar" no canto superior direito.' },
      { text: 'Uma planilha Excel será gerada automaticamente com: produto, tamanhos, quantidades, preços e status de estoque.' },
      { text: 'O arquivo é baixado para sua pasta de Downloads.' },
    ],
  },
  {
    title: 'Histórico de movimentações',
    icon: History,
    tag: 'dica',
    content: 'Consulte todas as entradas e saídas do estoque:',
    steps: [
      { text: 'Role até a seção "Histórico de Movimentações" na parte inferior da página.' },
      { text: 'Use o filtro de produto para ver movimentações de um item específico.' },
      { text: 'Use o filtro de período (7, 30, 90 dias) para limitar o intervalo de tempo.' },
    ],
    tips: [
      'Entradas aparecem em verde, saídas em vermelho e ajustes em azul.',
      'O histórico mostra quem fez a movimentação e quando.',
    ],
  },
];

export default function Stock() {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: movements = [], isLoading: movementsLoading } = useStockMovements(200);
  const addStock = useAddStock();
  const adjustStock = useAdjustStock();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [activeStockTab, setActiveStockTab] = useState<'stock' | 'history'>('stock');
  const [movementProductFilter, setMovementProductFilter] = useState<string>('all');
  const [movementPeriod, setMovementPeriod] = useState<string>('all');
  const [movementPage, setMovementPage] = useState(1);
  const MOVEMENTS_PER_PAGE = 20;

  // Manual out/adjust dialog
  const [outDialog, setOutDialog] = useState<{ product: Product; sizeId: string; mode: 'saida' | 'ajuste' } | null>(null);
  const [outQuantity, setOutQuantity] = useState(1);
  const [outNotes, setOutNotes] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scanBufferRef = useRef<string>('');
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Barcode scanner listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      const isInInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      if (activeElement === barcodeInputRef.current) return;
      if (isInInput) return;

      if (e.key === 'Enter' && scanBufferRef.current.length >= 8) {
        e.preventDefault();
        const scannedCode = scanBufferRef.current;
        scanBufferRef.current = '';
        handleBarcodeSearch(scannedCode);
        return;
      }

      if (e.key.length === 1 && /[0-9]/.test(e.key)) {
        e.preventDefault();
        scanBufferRef.current += e.key;
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = setTimeout(() => { scanBufferRef.current = ''; }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, [products]);

  const handleBarcodeSearch = (barcode?: string) => {
    const trimmedBarcode = (barcode || barcodeInput).trim();
    if (!trimmedBarcode) return;
    for (const product of products) {
      const sizeMatch = product.sizes.find(s => s.barcode === trimmedBarcode);
      if (sizeMatch) {
        setSelectedProduct(product);
        setSelectedSizeId(sizeMatch.id);
        setQuantity(1);
        toast.success(`Produto encontrado: ${product.name} - ${sizeMatch.size}`);
        setBarcodeInput('');
        return;
      }
    }
    toast.error('Produto não encontrado com este código de barras');
    setBarcodeInput('');
  };

  const handleAddStock = () => {
    if (!selectedProduct || !selectedSizeId) return;
    addStock.mutate(
      { product_id: selectedProduct.id, product_size_id: selectedSizeId, quantity, notes: 'Entrada via abastecimento rápido' },
      { onSuccess: () => { setSelectedProduct(null); setSelectedSizeId(''); setBarcodeInput(''); setQuantity(1); } }
    );
  };

  const handleManualOut = () => {
    if (!outDialog) return;
    const size = outDialog.product.sizes.find(s => s.id === outDialog.sizeId);
    if (!size) return;

    if (outDialog.mode === 'saida') {
      if (outQuantity > size.quantity) {
        toast.error('Quantidade de saída maior que o estoque disponível');
        return;
      }
      adjustStock.mutate(
        { product_id: outDialog.product.id, product_size_id: outDialog.sizeId, new_quantity: size.quantity - outQuantity, notes: outNotes || 'Saída manual' },
        { onSuccess: () => { setOutDialog(null); setOutQuantity(1); setOutNotes(''); } }
      );
    } else {
      adjustStock.mutate(
        { product_id: outDialog.product.id, product_size_id: outDialog.sizeId, new_quantity: outQuantity, notes: outNotes || 'Ajuste manual' },
        { onSuccess: () => { setOutDialog(null); setOutQuantity(1); setOutNotes(''); } }
      );
    }
  };

  const toggleProductExpand = (id: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedSize = selectedProduct?.sizes.find(s => s.id === selectedSizeId);

  // Filter stock products by search
  const filteredStockProducts = useMemo(() => {
    if (!stockSearchTerm) return products;
    const term = stockSearchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.category_name?.toLowerCase().includes(term) ||
      p.sizes.some(s => s.barcode?.includes(stockSearchTerm))
    );
  }, [products, stockSearchTerm]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    let filtered = movements;

    if (movementProductFilter !== 'all') {
      filtered = filtered.filter(m => m.product_id === movementProductFilter);
    }

    if (movementPeriod !== 'all') {
      const now = new Date();
      let start: Date;
      switch (movementPeriod) {
        case '7d': start = subDays(now, 7); break;
        case '30d': start = subDays(now, 30); break;
        case '90d': start = subDays(now, 90); break;
        default: start = subDays(now, 9999);
      }
      filtered = filtered.filter(m => isAfter(new Date(m.created_at), startOfDay(start)));
    }

    return filtered;
  }, [movements, movementProductFilter, movementPeriod]);

  const movementTotalPages = Math.max(1, Math.ceil(filteredMovements.length / MOVEMENTS_PER_PAGE));
  const paginatedMovements = filteredMovements.slice(
    (movementPage - 1) * MOVEMENTS_PER_PAGE,
    movementPage * MOVEMENTS_PER_PAGE
  );

  const handleExportStock = () => {
    if (products.length === 0) { toast.error('Não há produtos para exportar'); return; }
    const exportData: any[] = [];
    products.forEach(product => {
      product.sizes.forEach(size => {
        exportData.push({
          'Nome do Produto': product.name, 'Categoria': product.category_name || '', 'Cor': product.color_name || '',
          'Fornecedor': product.supplier_name || '', 'Tamanho': size.size, 'Quantidade': size.quantity,
          'Código de Barras': size.barcode || '', 'Preço de Custo': product.cost_price, 'Preço de Venda': product.sale_price,
          'Estoque Mínimo': product.min_stock, 'Status': size.quantity <= product.min_stock ? 'Baixo' : 'OK'
        });
      });
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
    XLSX.writeFile(wb, `estoque_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`);
    toast.success('Planilha de estoque exportada com sucesso!');
  };

  return (
    <MainLayout title="Gestão de Estoque" subtitle="Controle entradas e saídas de produtos" supportContent={{ moduleName: 'Estoque', sections: stockSupportSections }}>
      <div className="space-y-6 animate-fade-in">
        {/* Quick Entry Section */}
        <Card variant="pink">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Barcode className="w-5 h-5" />
              Abastecimento Rápido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
           <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="barcode">Código de Barras / QR Code</Label>
                <div className="flex gap-2">
                  <Input id="barcode" ref={barcodeInputRef} value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} placeholder="Escaneie ou digite o código..." onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()} />
                  <Button onClick={() => handleBarcodeSearch()} variant="pink" className="shrink-0"><Search className="w-4 h-4 mr-2" />Buscar</Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label>Ou selecione manualmente</Label>
                <Select value={selectedProduct?.id || ''} onValueChange={(value) => { const product = products.find(p => p.id === value); setSelectedProduct(product || null); setSelectedSizeId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                  <SelectContent>{products.map(product => (<SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              {selectedProduct && (
                <div className="flex-1 space-y-2">
                  <Label>Tamanho</Label>
                  <Select value={selectedSizeId} onValueChange={setSelectedSizeId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tamanho" /></SelectTrigger>
                    <SelectContent>{selectedProduct.sizes.map(size => (<SelectItem key={size.id} value={size.id}>{size.size} (atual: {size.quantity})</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {selectedProduct && selectedSizeId && (
              <div className="p-4 rounded-lg bg-card border border-border animate-scale-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-muted flex items-center justify-center shrink-0"><Package className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" /></div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{selectedProduct.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{selectedProduct.category_name} • {selectedProduct.color_name}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="pink">{selectedSize?.size}</Badge>
                        <Badge variant="secondary">Atual: {selectedSize?.quantity}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="w-4 h-4" /></Button>
                      <Input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 text-center h-8" min="1" />
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(quantity + 1)}><Plus className="w-4 h-4" /></Button>
                    </div>
                    <Button onClick={handleAddStock} variant="success" disabled={addStock.isPending} className="flex-1 sm:flex-none text-xs sm:text-sm">
                      {addStock.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                      Adicionar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeStockTab} onValueChange={(v) => setActiveStockTab(v as 'stock' | 'history')}>
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
            <TabsTrigger value="stock" className="gap-2"><Package className="w-4 h-4" />Estoque Atual</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" />Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="stock">
          <Card variant="elevated">
             <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Package className="w-5 h-5" />Estoque Atual</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar produto..." 
                    value={stockSearchTerm} 
                    onChange={(e) => setStockSearchTerm(e.target.value)} 
                    className="pl-8 w-full sm:w-48 h-8 text-sm"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleExportStock} disabled={products.length === 0} className="shrink-0"><Download className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Exportar</span></Button>
              </div>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}</div>
              ) : products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><p>Nenhum produto cadastrado</p></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-center hidden sm:table-cell">Mínimo</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStockProducts.map((product) => {
                      const totalStock = product.sizes.reduce((acc, s) => acc + s.quantity, 0);
                      const isLow = totalStock <= product.min_stock;
                      const isExpanded = expandedProducts.has(product.id);
                      return (
                        <>
                          <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleProductExpand(product.id)}>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground">{product.category_name}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">{totalStock}</TableCell>
                            <TableCell className="text-center text-muted-foreground hidden sm:table-cell">{product.min_stock}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={isLow ? 'destructive' : 'success'}>{isLow ? 'Baixo' : 'OK'}</Badge>
                            </TableCell>
                          </TableRow>
                          {isExpanded && product.sizes.map((size) => (
                            <TableRow key={size.id} className="bg-muted/20">
                              <TableCell />
                              <TableCell className="pl-10">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{size.size}</Badge>
                                  {size.barcode && <span className="text-xs text-muted-foreground">{size.barcode}</span>}
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-medium">{size.quantity}</TableCell>
                              <TableCell className="hidden sm:table-cell" />
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); setOutDialog({ product, sizeId: size.id, mode: 'saida' }); setOutQuantity(1); setOutNotes(''); }}>
                                    <Minus className="w-3 h-3 mr-1" />Saída
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setOutDialog({ product, sizeId: size.id, mode: 'ajuste' }); setOutQuantity(size.quantity); setOutNotes(''); }}>
                                    <Settings2 className="w-3 h-3 mr-1" />Ajustar
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="history">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />Histórico de Movimentações</CardTitle>
              <div className="flex gap-2 mt-2">
                <Select value={movementProductFilter} onValueChange={(v) => { setMovementProductFilter(v); setMovementPage(1); }}>
                  <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {products.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={movementPeriod} onValueChange={(v) => { setMovementPeriod(v); setMovementPage(1); }}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo período</SelectItem>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {movementsLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}</div>
              ) : filteredMovements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma movimentação encontrada</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedMovements.map((movement) => (
                      <div key={movement.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            movement.type === 'entrada' ? 'bg-success/20' :
                            movement.type === 'saida' ? 'bg-destructive/20' : 'bg-warning/20'
                          }`}>
                            {movement.type === 'entrada' ? <Plus className="w-4 h-4 text-success" /> : <Minus className="w-4 h-4 text-destructive" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{movement.product_name}{movement.size && ` (${movement.size})`}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(movement.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                            {movement.notes && <p className="text-xs text-muted-foreground italic">{movement.notes}</p>}
                          </div>
                        </div>
                        <Badge variant={movement.type === 'entrada' ? 'success' : movement.type === 'ajuste' ? 'warning' : 'destructive'}>
                          {movement.type === 'entrada' ? '+' : movement.type === 'ajuste' ? '~' : '-'}{movement.quantity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  {movementTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                      <span className="text-sm text-muted-foreground">Página {movementPage} de {movementTotalPages} ({filteredMovements.length} registros)</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setMovementPage(p => Math.max(1, p - 1))} disabled={movementPage === 1}>Anterior</Button>
                        <Button variant="outline" size="sm" onClick={() => setMovementPage(p => Math.min(movementTotalPages, p + 1))} disabled={movementPage === movementTotalPages}>Próxima</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        </Tabs>

        {/* Manual Out/Adjust Dialog */}
        <Dialog open={!!outDialog} onOpenChange={(open) => { if (!open) setOutDialog(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{outDialog?.mode === 'saida' ? 'Saída Manual' : 'Ajuste de Estoque'}</DialogTitle>
            </DialogHeader>
            {outDialog && (() => {
              const size = outDialog.product.sizes.find(s => s.id === outDialog.sizeId);
              return (
                <div className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">{outDialog.product.name}</p>
                    <p className="text-xs text-muted-foreground">Tamanho: {size?.size} • Estoque atual: {size?.quantity}</p>
                  </div>
                  <div>
                    <Label>{outDialog.mode === 'saida' ? 'Quantidade de saída' : 'Nova quantidade'}</Label>
                    <Input type="number" min={outDialog.mode === 'saida' ? 1 : 0} max={outDialog.mode === 'saida' ? size?.quantity : undefined} value={outQuantity} onChange={(e) => setOutQuantity(Math.max(0, parseInt(e.target.value) || 0))} />
                  </div>
                  <div>
                    <Label>Observação</Label>
                    <Input value={outNotes} onChange={(e) => setOutNotes(e.target.value)} placeholder={outDialog.mode === 'saida' ? 'Motivo da saída...' : 'Motivo do ajuste...'} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOutDialog(null)}>Cancelar</Button>
                    <Button variant={outDialog.mode === 'saida' ? 'destructive' : 'default'} onClick={handleManualOut} disabled={adjustStock.isPending}>
                      {adjustStock.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {outDialog.mode === 'saida' ? 'Registrar Saída' : 'Ajustar Estoque'}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
