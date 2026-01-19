import { useState, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Printer, Plus, Minus, Trash2, Tag, 
  Settings2, Eye, Package
} from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import JsBarcode from 'jsbarcode';
import { toast } from 'sonner';

interface LabelItem {
  id: string;
  productId: string;
  productName: string;
  size: string;
  sizeId: string;
  barcode: string | null;
  price: number;
  quantity: number;
}

interface LabelSettings {
  showPrice: boolean;
  showBarcode: boolean;
  showName: boolean;
  showSize: boolean;
  labelWidth: number;
  labelHeight: number;
  fontSize: number;
  columns: number;
}

const DEFAULT_SETTINGS: LabelSettings = {
  showPrice: true,
  showBarcode: true,
  showName: true,
  showSize: true,
  labelWidth: 50,
  labelHeight: 25,
  fontSize: 10,
  columns: 3,
};

export default function Labels() {
  const { data: products = [] } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [labelItems, setLabelItems] = useState<LabelItem[]>([]);
  const [settings, setSettings] = useState<LabelSettings>(DEFAULT_SETTINGS);
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sizes?.some(s => s.barcode?.includes(searchTerm))
  );

  const handleAddProduct = (product: any, size: any) => {
    const existingIndex = labelItems.findIndex(
      item => item.productId === product.id && item.sizeId === size.id
    );

    if (existingIndex >= 0) {
      const newItems = [...labelItems];
      newItems[existingIndex].quantity += 1;
      setLabelItems(newItems);
    } else {
      setLabelItems([...labelItems, {
        id: `${product.id}-${size.id}`,
        productId: product.id,
        productName: product.name,
        size: size.size,
        sizeId: size.id,
        barcode: size.barcode || product.barcode,
        price: product.sale_price,
        quantity: 1,
      }]);
    }
    toast.success('Produto adicionado');
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setLabelItems(items => 
      items.map(item => 
        item.id === id 
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const handleRemoveItem = (id: string) => {
    setLabelItems(items => items.filter(item => item.id !== id));
  };

  const totalLabels = labelItems.reduce((acc, item) => acc + item.quantity, 0);

  const handlePrint = () => {
    if (labelItems.length === 0) {
      toast.error('Adicione produtos para imprimir');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup bloqueado. Permita popups para imprimir.');
      return;
    }

    // Generate labels HTML
    const labelsHtml = generateLabelsHtml();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas</title>
          <style>
            @page {
              size: auto;
              margin: 5mm;
            }
            body {
              margin: 0;
              padding: 10px;
              font-family: Arial, sans-serif;
            }
            .labels-container {
              display: flex;
              flex-wrap: wrap;
              gap: 5px;
            }
            .label {
              width: ${settings.labelWidth}mm;
              height: ${settings.labelHeight}mm;
              border: 1px dashed #ccc;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              box-sizing: border-box;
              overflow: hidden;
              page-break-inside: avoid;
            }
            .label-name {
              font-size: ${settings.fontSize}px;
              font-weight: bold;
              margin-bottom: 2px;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .label-size {
              font-size: ${settings.fontSize - 2}px;
              color: #666;
              margin-bottom: 2px;
            }
            .label-price {
              font-size: ${settings.fontSize + 2}px;
              font-weight: bold;
              margin-top: 2px;
            }
            .label-barcode {
              max-width: 100%;
              height: auto;
            }
            @media print {
              .label {
                border: 1px dashed #ddd;
              }
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${labelsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const generateLabelsHtml = () => {
    let html = '';

    labelItems.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        html += `
          <div class="label">
            ${settings.showName ? `<div class="label-name">${item.productName}</div>` : ''}
            ${settings.showSize ? `<div class="label-size">${item.size}</div>` : ''}
            ${settings.showBarcode && item.barcode ? `
              <svg class="label-barcode" id="barcode-${item.id}-${i}"></svg>
            ` : ''}
            ${settings.showPrice ? `<div class="label-price">${formatCurrency(item.price)}</div>` : ''}
          </div>
        `;
      }
    });

    return html;
  };

  return (
    <MainLayout title="Etiquetas" subtitle="Geração e impressão de etiquetas de produtos">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search */}
          <Card className="opacity-0 animate-fade-in-up stagger-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Selecionar Produtos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por nome ou código de barras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          {searchTerm ? 'Nenhum produto encontrado' : 'Digite para buscar produtos'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.flatMap(product => 
                        product.sizes?.map(size => (
                          <TableRow key={`${product.id}-${size.id}`}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{size.size}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(product.sale_price)}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAddProduct(product, size)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )) || []
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Selected Items */}
          <Card className="opacity-0 animate-fade-in-up stagger-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Etiquetas Selecionadas
                </div>
                <Badge variant="secondary">{totalLabels} etiquetas</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {labelItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhum produto selecionado</p>
                  <p className="text-sm">Busque e adicione produtos acima</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead className="text-center">Quantidade</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labelItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.size}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => handleUpdateQuantity(item.id, -1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => handleUpdateQuantity(item.id, 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Settings & Preview */}
        <div className="space-y-6">
          {/* Settings */}
          <Card className="opacity-0 animate-fade-in-up stagger-3">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Configurações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Exibir na Etiqueta</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="showName"
                      checked={settings.showName}
                      onCheckedChange={(checked) => 
                        setSettings(s => ({ ...s, showName: !!checked }))
                      }
                    />
                    <label htmlFor="showName" className="text-sm">Nome do produto</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="showSize"
                      checked={settings.showSize}
                      onCheckedChange={(checked) => 
                        setSettings(s => ({ ...s, showSize: !!checked }))
                      }
                    />
                    <label htmlFor="showSize" className="text-sm">Tamanho</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="showBarcode"
                      checked={settings.showBarcode}
                      onCheckedChange={(checked) => 
                        setSettings(s => ({ ...s, showBarcode: !!checked }))
                      }
                    />
                    <label htmlFor="showBarcode" className="text-sm">Código de barras</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="showPrice"
                      checked={settings.showPrice}
                      onCheckedChange={(checked) => 
                        setSettings(s => ({ ...s, showPrice: !!checked }))
                      }
                    />
                    <label htmlFor="showPrice" className="text-sm">Preço</label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Largura (mm)</Label>
                  <Input
                    type="number"
                    value={settings.labelWidth}
                    onChange={(e) => setSettings(s => ({ ...s, labelWidth: parseInt(e.target.value) || 50 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Altura (mm)</Label>
                  <Input
                    type="number"
                    value={settings.labelHeight}
                    onChange={(e) => setSettings(s => ({ ...s, labelHeight: parseInt(e.target.value) || 25 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Tamanho da Fonte</Label>
                <Select 
                  value={settings.fontSize.toString()} 
                  onValueChange={(v) => setSettings(s => ({ ...s, fontSize: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8px - Pequeno</SelectItem>
                    <SelectItem value="10">10px - Normal</SelectItem>
                    <SelectItem value="12">12px - Grande</SelectItem>
                    <SelectItem value="14">14px - Extra Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="opacity-0 animate-fade-in-up stagger-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Prévia da Etiqueta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <div 
                  className="border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center text-center"
                  style={{ 
                    width: `${settings.labelWidth * 2}px`, 
                    minHeight: `${settings.labelHeight * 2}px` 
                  }}
                >
                  {settings.showName && (
                    <p className="font-bold truncate w-full" style={{ fontSize: `${settings.fontSize}px` }}>
                      Nome do Produto
                    </p>
                  )}
                  {settings.showSize && (
                    <p className="text-muted-foreground" style={{ fontSize: `${settings.fontSize - 2}px` }}>
                      M
                    </p>
                  )}
                  {settings.showBarcode && (
                    <div className="my-1">
                      <svg className="w-full h-8">
                        <rect width="100%" height="100%" fill="#f0f0f0" />
                        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize="8">
                          |||||||||||
                        </text>
                      </svg>
                    </div>
                  )}
                  {settings.showPrice && (
                    <p className="font-bold" style={{ fontSize: `${settings.fontSize + 2}px` }}>
                      R$ 99,90
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Print Button */}
          <Button
            onClick={handlePrint}
            disabled={labelItems.length === 0}
            className="w-full gap-2"
            size="lg"
          >
            <Printer className="w-5 h-5" />
            Imprimir {totalLabels} Etiquetas
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
