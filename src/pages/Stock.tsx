import { useState, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts, Product } from '@/hooks/useProducts';
import { useStockMovements, useAddStock } from '@/hooks/useStock';
import { Barcode, Plus, Minus, Package, History, Search, Loader2, Download, HelpCircle, ScanBarcode, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { type SupportSection } from '@/components/layout/SupportButton';

const stockSupportSections: SupportSection[] = [
  { title: 'O que é o módulo Estoque', icon: HelpCircle, content: 'O módulo de Estoque permite controlar a entrada e saída de produtos. Aqui você dá entrada rápida de mercadorias usando leitor de código de barras ou seleção manual, visualiza o estoque atual e acompanha o histórico de movimentações.' },
  { title: 'Como dar entrada de estoque', icon: Plus, content: 'Na seção "Abastecimento Rápido", escaneie o código de barras ou selecione o produto e tamanho manualmente. Defina a quantidade e clique em "Adicionar ao Estoque". A movimentação será registrada automaticamente.' },
  { title: 'Como usar o leitor de código de barras', icon: ScanBarcode, content: 'O sistema detecta automaticamente leitores de código de barras. Basta escanear o produto com o leitor - o sistema identificará o produto e tamanho correspondente. Funciona mesmo sem o cursor no campo de busca.' },
  { title: 'Como exportar estoque para Excel', icon: FileSpreadsheet, content: 'Clique no botão "Exportar" na seção "Estoque Atual". O sistema gerará uma planilha Excel com todos os produtos, tamanhos, quantidades, preços e status de estoque.' },
  { title: 'Histórico de movimentações', icon: History, content: 'A seção "Histórico de Movimentações" mostra todas as entradas e saídas recentes. Cada registro inclui o produto, tamanho, quantidade, tipo (entrada/saída) e data/hora.' },
];

export default function Stock() {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: movements = [], isLoading: movementsLoading } = useStockMovements();
  const addStock = useAddStock();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scanBufferRef = useRef<string>('');
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listener global para capturar leitura de código de barras sem precisar clicar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      const isInInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      // Se está no campo de barcode, deixa o comportamento normal
      if (activeElement === barcodeInputRef.current) {
        return;
      }

      // Se está em outro input, ignora
      if (isInInput) {
        return;
      }

      // Scanner envia caracteres rapidamente seguidos de Enter
      if (e.key === 'Enter' && scanBufferRef.current.length >= 8) {
        e.preventDefault();
        const scannedCode = scanBufferRef.current;
        scanBufferRef.current = '';

        // Busca o produto pelo código escaneado
        handleBarcodeSearch(scannedCode);
        return;
      }

      // Acumula caracteres numéricos (scanner envia muito rápido)
      if (e.key.length === 1 && /[0-9]/.test(e.key)) {
        e.preventDefault();
        scanBufferRef.current += e.key;

        // Reset timeout
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
        }
        scanTimeoutRef.current = setTimeout(() => {
          scanBufferRef.current = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
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
      {
        product_id: selectedProduct.id,
        product_size_id: selectedSizeId,
        quantity,
        notes: 'Entrada via abastecimento rápido',
      },
      {
        onSuccess: () => {
          setSelectedProduct(null);
          setSelectedSizeId('');
          setBarcodeInput('');
          setQuantity(1);
        },
      }
    );
  };

  const selectedSize = selectedProduct?.sizes.find(s => s.id === selectedSizeId);

  const handleExportStock = () => {
    if (products.length === 0) {
      toast.error('Não há produtos para exportar');
      return;
    }

    // Preparar dados para exportação
    const exportData: any[] = [];

    products.forEach(product => {
      product.sizes.forEach(size => {
        exportData.push({
          'Nome do Produto': product.name,
          'Categoria': product.category_name || '',
          'Cor': product.color_name || '',
          'Fornecedor': product.supplier_name || '',
          'Tamanho': size.size,
          'Quantidade': size.quantity,
          'Código de Barras': size.barcode || '',
          'Preço de Custo': product.cost_price,
          'Preço de Venda': product.sale_price,
          'Estoque Mínimo': product.min_stock,
          'Status': size.quantity <= product.min_stock ? 'Baixo' : 'OK'
        });
      });
    });

    // Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 30 }, // Nome do Produto
      { wch: 15 }, // Categoria
      { wch: 12 }, // Cor
      { wch: 20 }, // Fornecedor
      { wch: 10 }, // Tamanho
      { wch: 12 }, // Quantidade
      { wch: 15 }, // Código de Barras
      { wch: 14 }, // Preço de Custo
      { wch: 14 }, // Preço de Venda
      { wch: 14 }, // Estoque Mínimo
      { wch: 10 }, // Status
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Estoque');

    // Download do arquivo
    const fileName = `estoque_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    XLSX.writeFile(wb, fileName);

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
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="barcode">Código de Barras / QR Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    ref={barcodeInputRef}
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Escaneie ou digite o código..."
                    onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                  />
                  <Button onClick={() => handleBarcodeSearch()} variant="pink">
                    <Search className="w-4 h-4 mr-2" />
                    Buscar
                  </Button>
                </div>
              </div>
            </div>

            {/* Manual product selection */}
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label>Ou selecione manualmente</Label>
                <Select
                  value={selectedProduct?.id || ''}
                  onValueChange={(value) => {
                    const product = products.find(p => p.id === value);
                    setSelectedProduct(product || null);
                    setSelectedSizeId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProduct && (
                <div className="flex-1 space-y-2">
                  <Label>Tamanho</Label>
                  <Select value={selectedSizeId} onValueChange={setSelectedSizeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tamanho" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProduct.sizes.map(size => (
                        <SelectItem key={size.id} value={size.id}>
                          {size.size} (atual: {size.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {selectedProduct && selectedSizeId && (
              <div className="p-4 rounded-lg bg-card border border-border animate-scale-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{selectedProduct.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedProduct.category_name} • {selectedProduct.color_name}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="pink">{selectedSize?.size}</Badge>
                        <Badge variant="secondary">Atual: {selectedSize?.quantity}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 text-center"
                        min="1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      onClick={handleAddStock}
                      variant="success"
                      disabled={addStock.isPending}
                    >
                      {addStock.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Adicionar ao Estoque
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Stock */}
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Estoque Atual
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportStock}
                disabled={products.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum produto cadastrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd Total</TableHead>
                      <TableHead className="text-center">Mínimo</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const totalStock = product.sizes.reduce((acc, s) => acc + s.quantity, 0);
                      const isLow = totalStock <= product.min_stock;
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.category_name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-semibold">{totalStock}</TableCell>
                          <TableCell className="text-center text-muted-foreground">{product.min_stock}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={isLow ? 'destructive' : 'success'}>
                              {isLow ? 'Baixo' : 'OK'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Movement History */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico de Movimentações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movementsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : movements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma movimentação registrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {movements.map((movement) => (
                    <div
                      key={movement.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          movement.type === 'entrada' ? 'bg-success/20' :
                          movement.type === 'saida' ? 'bg-destructive/20' : 'bg-warning/20'
                        }`}>
                          {movement.type === 'entrada' ? (
                            <Plus className="w-4 h-4 text-success" />
                          ) : (
                            <Minus className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {movement.product_name}
                            {movement.size && ` (${movement.size})`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(movement.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={movement.type === 'entrada' ? 'success' : 'destructive'}>
                        {movement.type === 'entrada' ? '+' : '-'}{movement.quantity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
