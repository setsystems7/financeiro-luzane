import { useState, useRef, useEffect } from 'react';
import { Product as DBProduct, ProductFormData, useCategories, useColors, useSuppliers, SIZE_ORDER, sortSizesByOrder } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Save, Loader2, Building2, Barcode, RefreshCw, Tag, Palette, Pencil } from 'lucide-react';
import { SupplierDialog } from './SupplierDialog';
import { CategoryDialog } from './CategoryDialog';
import { ColorDialog } from './ColorDialog';
import { Supplier } from '@/hooks/useSuppliers';

interface SizeVariant {
  size: string;
  quantity: number;
  barcode?: string;
}

interface ProductFormProps {
  product?: DBProduct;
  onSave: (product: ProductFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// Usar a ordem de tamanhos do hook
const availableSizes = SIZE_ORDER;

// Calcula o dígito verificador EAN-13
function calculateEAN13CheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

// Gera código de barras no padrão EAN-13
function generateBarcode(): string {
  // 789 = Prefixo Brasil
  const countryCode = '789';
  // Código do fabricante (4 dígitos) - usando timestamp parcial
  const manufacturer = Date.now().toString().slice(-4);
  // Código do produto (5 dígitos) - aleatório
  const productCode = Math.floor(Math.random() * 100000).toString().padStart(5, '0');

  const baseCode = countryCode + manufacturer + productCode;
  const checkDigit = calculateEAN13CheckDigit(baseCode);

  return baseCode + checkDigit.toString();
}

export function ProductForm({ product, onSave, onCancel, isLoading }: ProductFormProps) {
  const { data: categories = [], refetch: refetchCategories } = useCategories();
  const { data: colors = [], refetch: refetchColors } = useColors();
  const { data: suppliers = [], refetch: refetchSuppliers } = useSuppliers();

  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    category_id: product?.category_id || '',
    color_id: product?.color_id || '',
    supplier_id: product?.supplier_id || '',
    cost_price: product?.cost_price?.toString() || '',
    sale_price: product?.sale_price?.toString() || '',
    min_stock: product?.min_stock?.toString() || '5',
  });

  const [sizeVariants, setSizeVariants] = useState<SizeVariant[]>(
    product?.sizes?.map(s => ({
      size: s.size,
      quantity: s.quantity,
      barcode: s.barcode || undefined,
    })) || []
  );

  const [selectedSize, setSelectedSize] = useState('');
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const barcodeInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const scanBufferRef = useRef<string>('');
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listener global para capturar leitura de código de barras
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se está em um input que não é de barcode
      const activeElement = document.activeElement as HTMLElement;
      const isInBarcodeInput = Object.values(barcodeInputRefs.current).some(
        ref => ref === activeElement
      );
      const isInOtherInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      // Se está em outro input (não barcode), deixa o comportamento normal
      if (isInOtherInput && !isInBarcodeInput) {
        return;
      }

      // Scanner geralmente envia caracteres rapidamente seguidos de Enter
      if (e.key === 'Enter' && scanBufferRef.current.length >= 8) {
        e.preventDefault();
        const scannedCode = scanBufferRef.current;
        scanBufferRef.current = '';

        // Encontra o primeiro campo de barcode vazio ou o focado
        const sizes = Object.keys(barcodeInputRefs.current);
        let targetSize = sizes.find(size => {
          const ref = barcodeInputRefs.current[size];
          return ref === activeElement;
        });

        if (!targetSize) {
          targetSize = sizes.find(size => {
            const variant = sizeVariants.find(v => v.size === size);
            return !variant?.barcode;
          });
        }

        if (targetSize) {
          setSizeVariants(prev => prev.map(v =>
            v.size === targetSize ? { ...v, barcode: scannedCode } : v
          ));
          // Foca no próximo campo vazio
          const nextSize = sizes.find(size => {
            if (size === targetSize) return false;
            const variant = sizeVariants.find(v => v.size === size);
            return !variant?.barcode;
          });
          if (nextSize && barcodeInputRefs.current[nextSize]) {
            barcodeInputRefs.current[nextSize]?.focus();
          }
        }
        return;
      }

      // Acumula caracteres (scanner envia muito rápido)
      if (e.key.length === 1 && /[0-9]/.test(e.key)) {
        if (!isInBarcodeInput) {
          e.preventDefault();
        }
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
  }, [sizeVariants]);

  const costPrice = parseFloat(formData.cost_price) || 0;
  const salePrice = parseFloat(formData.sale_price) || 0;
  const markup = costPrice > 0
    ? ((salePrice - costPrice) / costPrice * 100).toFixed(2)
    : '0.00';

  const handleAddSize = () => {
    if (selectedSize && !sizeVariants.find(s => s.size === selectedSize)) {
      // Adiciona e reordena conforme SIZE_ORDER
      const newVariants = sortSizesByOrder([
        ...sizeVariants,
        { size: selectedSize, quantity: 0, barcode: '' }
      ]);
      setSizeVariants(newVariants);
      setSelectedSize('');
      // Foca no campo de barcode do novo tamanho após renderizar
      setTimeout(() => {
        barcodeInputRefs.current[selectedSize]?.focus();
      }, 100);
    }
  };

  const handleRemoveSize = (size: string) => {
    setSizeVariants(sizeVariants.filter(s => s.size !== size));
  };

  const handleSizeQuantityChange = (size: string, quantity: number) => {
    setSizeVariants(sizeVariants.map(s =>
      s.size === size ? { ...s, quantity } : s
    ));
  };

  const handleBarcodeChange = (size: string, barcode: string) => {
    setSizeVariants(sizeVariants.map(s =>
      s.size === size ? { ...s, barcode } : s
    ));
  };

  const handleGenerateBarcode = (size: string) => {
    const newBarcode = generateBarcode();
    setSizeVariants(sizeVariants.map(s =>
      s.size === size ? { ...s, barcode: newBarcode } : s
    ));
  };

  const handleSupplierCreated = (supplierId: string) => {
    refetchSuppliers();
    setFormData({ ...formData, supplier_id: supplierId });
  };

  const handleCategoryCreated = (categoryId: string) => {
    refetchCategories();
    setFormData({ ...formData, category_id: categoryId });
  };

  const handleColorCreated = (colorId: string) => {
    refetchColors();
    setFormData({ ...formData, color_id: colorId });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSave({
      name: formData.name,
      description: formData.description || undefined,
      category_id: formData.category_id || undefined,
      color_id: formData.color_id || undefined,
      supplier_id: formData.supplier_id || undefined,
      cost_price: parseFloat(formData.cost_price) || 0,
      sale_price: parseFloat(formData.sale_price) || 0,
      min_stock: parseInt(formData.min_stock) || 0,
      sizes: sizeVariants,
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Produto *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Legging Fitness Premium"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional do produto..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Categoria</Label>
                    <div className="flex items-center gap-1">
                      {formData.category_id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground hover:text-foreground px-1"
                          onClick={() => {
                            const cat = categories.find(c => c.id === formData.category_id);
                            if (cat) {
                              setEditingCategory({ id: cat.id, name: cat.name });
                              setIsCategoryDialogOpen(true);
                            }
                          }}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-pink-primary hover:text-pink-dark px-1"
                        onClick={() => {
                          setEditingCategory(null);
                          setIsCategoryDialogOpen(true);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Nova
                      </Button>
                    </div>
                  </div>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <Tag className="w-3 h-3 text-muted-foreground" />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Cor</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-pink-primary hover:text-pink-dark px-1"
                      onClick={() => setIsColorDialogOpen(true)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Nova
                    </Button>
                  </div>
                  <Select
                    value={formData.color_id}
                    onValueChange={(value) => setFormData({ ...formData, color_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {colors.map(color => (
                        <SelectItem key={color.id} value={color.id}>
                          <div className="flex items-center gap-2">
                            <Palette className="w-3 h-3 text-muted-foreground" />
                            {color.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Fornecedor</Label>
                  <div className="flex items-center gap-1">
                    {formData.supplier_id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          const sup = suppliers.find(s => s.id === formData.supplier_id);
                          if (sup) {
                            setEditingSupplier(sup as Supplier);
                            setIsSupplierDialogOpen(true);
                          }
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-pink-primary hover:text-pink-dark"
                      onClick={() => {
                        setEditingSupplier(null);
                        setIsSupplierDialogOpen(true);
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Novo Fornecedor
                    </Button>
                  </div>
                </div>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(sup => (
                      <SelectItem key={sup.id} value={sup.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          {sup.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">Preços e Estoque</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="costPrice">Preço de Custo *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                      className="pl-10"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salePrice">Preço de Venda *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      id="salePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.sale_price}
                      onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                      className="pl-10"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
              </div>


              <div className="p-3 rounded-lg bg-pink-glow border border-pink-light w-fit">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">Porcentagem de Lucro</span>
                  <Badge variant="pink" className="text-sm font-bold px-2 py-0.5">
                    {markup}%
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minStock">Estoque Mínimo</Label>
                <Input
                  id="minStock"
                  type="number"
                  min="0"
                  value={formData.min_stock}
                  onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                  placeholder="5"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Size Grid */}
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Grade de Tamanhos</CardTitle>
            {sizeVariants.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Estoque Total:</span>
                <Badge variant="pink" className="text-base font-bold px-3 py-1">
                  {sizeVariants.reduce((sum, v) => sum + v.quantity, 0)} un
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tamanho" />
                </SelectTrigger>
                <SelectContent>
                  {availableSizes.filter(s => !sizeVariants.find(sv => sv.size === s)).map(size => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="pink" onClick={handleAddSize} disabled={!selectedSize}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>

            {sizeVariants.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sizeVariants.map((variant) => (
                  <div key={variant.size} className="p-4 rounded-xl border-2 border-border bg-card shadow-sm hover:border-pink-light transition-colors space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="pink" className="text-sm font-bold px-3 py-1">{variant.size}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveSize(variant.size)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-medium">Quantidade</Label>
                        <Input
                          type="number"
                          min="0"
                          value={variant.quantity || ''}
                          onChange={(e) => handleSizeQuantityChange(variant.size, parseInt(e.target.value) || 0)}
                          className="h-10 text-center text-lg font-semibold"
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Barcode className="w-3 h-3" />
                          Código de Barras
                        </Label>
                        
                        {/* Botões de ação para código de barras */}
                        <div className="flex gap-1.5 flex-wrap">
                          <Button
                            type="button"
                            variant={!variant.barcode ? 'pink' : 'outline'}
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                              handleBarcodeChange(variant.size, '');
                              setTimeout(() => {
                                barcodeInputRefs.current[variant.size]?.focus();
                              }, 50);
                            }}
                            title="Limpar e focar para bipar ou digitar"
                          >
                            <Barcode className="w-3 h-3" />
                            Bipar/Digitar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleGenerateBarcode(variant.size)}
                            title="Gerar código EAN-13 automático"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Gerar Auto
                          </Button>
                          {variant.barcode && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                              onClick={() => handleBarcodeChange(variant.size, '')}
                              title="Limpar código"
                            >
                              <X className="w-3 h-3" />
                              Limpar
                            </Button>
                          )}
                        </div>

                        {/* Input do código de barras */}
                        <div className="relative">
                          <Input
                            ref={(el) => { barcodeInputRefs.current[variant.size] = el; }}
                            type="text"
                            value={variant.barcode || ''}
                            onChange={(e) => handleBarcodeChange(variant.size, e.target.value)}
                            className="h-10 font-mono text-sm tracking-wider pr-8"
                            placeholder="Clique em Bipar/Digitar ou Gerar Auto"
                          />
                          {variant.barcode && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-600 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-700">
                                ✓
                              </Badge>
                            </div>
                          )}
                        </div>
                        
                        <p className="text-[10px] text-muted-foreground">
                          Use o leitor de código de barras, digite manualmente ou gere automaticamente
                        </p>
                      </div>
                    </div>

                    {variant.quantity > 0 ? (
                      <div className="text-center">
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800">
                          Em estoque
                        </Badge>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
                          Sem estoque
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {sizeVariants.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                <p className="text-sm">Nenhum tamanho adicionado</p>
                <p className="text-xs mt-1">Selecione um tamanho acima para adicionar à grade</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" variant="pink" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {product ? 'Atualizar Produto' : 'Cadastrar Produto'}
          </Button>
        </div>
      </form>

      <SupplierDialog
        open={isSupplierDialogOpen}
        onOpenChange={(open) => {
          setIsSupplierDialogOpen(open);
          if (!open) setEditingSupplier(null);
        }}
        onSuccess={handleSupplierCreated}
        editSupplier={editingSupplier}
      />

      <CategoryDialog
        open={isCategoryDialogOpen}
        onOpenChange={(open) => {
          setIsCategoryDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        onSuccess={handleCategoryCreated}
        editCategory={editingCategory}
      />

      <ColorDialog
        open={isColorDialogOpen}
        onOpenChange={setIsColorDialogOpen}
        onSuccess={handleColorCreated}
      />
    </>
  );
}
