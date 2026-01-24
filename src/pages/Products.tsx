import { useState, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductForm } from '@/components/products/ProductForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useProducts,
  useCategories,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  Product,
  ProductFormData
} from '@/hooks/useProducts';
import { useImportProducts, generateTemplateExcel, parseExcel } from '@/hooks/useImportProducts';
import { Plus, Search, Filter, Grid, List, Upload, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

export default function Products() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const importProducts = useImportProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (product: any) => {
    const dbProduct = products.find(p => p.id === product.id);
    if (dbProduct) {
      setEditingProduct(dbProduct);
      setIsFormOpen(true);
    }
  };

  const handleDelete = (productId: string) => {
    deleteProduct.mutate(productId);
  };

  const handleSave = (productData: ProductFormData) => {
    if (editingProduct) {
      updateProduct.mutate(
        { id: editingProduct.id, data: productData },
        {
          onSuccess: () => {
            setIsFormOpen(false);
            setEditingProduct(undefined);
          },
        }
      );
    } else {
      createProduct.mutate(productData, {
        onSuccess: () => {
          setIsFormOpen(false);
          setEditingProduct(undefined);
        },
      });
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingProduct(undefined);
  };

  const handleDownloadTemplate = () => {
    generateTemplateExcel();
    toast.success('Planilha modelo baixada!');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const products = await parseExcel(file);

      if (products.length === 0) {
        toast.error('Nenhum produto válido encontrado na planilha');
        return;
      }

      importProducts.mutate(products, {
        onSuccess: () => {
          setIsImportDialogOpen(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        },
      });
    } catch (error) {
      toast.error('Erro ao ler arquivo Excel');
    }
  };

  // Convert DB product to legacy format for ProductCard
  const convertToLegacyFormat = (product: Product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category_name || '',
    color: product.color_name || '',
    supplier: product.supplier_name || '',
    costPrice: product.cost_price,
    salePrice: product.sale_price,
    markup: product.markup,
    minStock: product.min_stock,
    photo: product.photo_url,
    createdAt: new Date(product.created_at),
    sizes: product.sizes.map(s => ({
      size: s.size,
      quantity: s.quantity,
      barcode: s.barcode || '',
    })),
  });

  return (
    <MainLayout title="Produtos" subtitle="Gerencie seu catálogo de produtos">
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between opacity-0 animate-fade-in-down">
          <div className="flex flex-1 gap-3">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 transition-all duration-300 focus:shadow-md focus:shadow-primary/10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40 transition-all duration-200 hover:border-primary/50">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <div className="flex border border-border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="rounded-none transition-all duration-200"
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
                className="rounded-none transition-all duration-200"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="hover:border-primary/50">
              <Upload className="w-4 h-4 mr-2" />
              Importar
            </Button>
            <Button variant="pink" onClick={() => setIsFormOpen(true)} className="btn-glow">
              <Plus className="w-4 h-4 mr-2" />
              Novo Produto
            </Button>
          </div>
        </div>

        {/* Products Count */}
        <div className="text-sm text-muted-foreground">
          Exibindo {filteredProducts.length} de {products.length} produtos
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className={viewMode === 'grid'
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-4"
          }>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">Nenhum produto cadastrado.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Importar em Lote
              </Button>
              <Button variant="pink" onClick={() => setIsFormOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Manualmente
              </Button>
            </div>
          </div>
        ) : (
          <div className={viewMode === 'grid'
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-4"
          }>
            {filteredProducts.map((product, index) => (
              <div
                key={product.id}
                className="opacity-0 animate-fade-in-up"
                style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
              >
                <ProductCard
                  product={convertToLegacyFormat(product)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        )}

        {/* Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </DialogTitle>
            </DialogHeader>
            <ProductForm
              product={editingProduct}
              onSave={handleSave}
              onCancel={handleCloseForm}
              isLoading={createProduct.isPending || updateProduct.isPending}
            />
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-pink-primary" />
                Importar Produtos em Lote
              </DialogTitle>
              <DialogDescription>
                Baixe a planilha modelo, preencha com seus produtos e importe.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              {/* Step 1: Download Template */}
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-primary/10 text-pink-primary flex items-center justify-center font-semibold text-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">Baixar Planilha Modelo</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      A planilha contém as colunas: nome, preço de compra, preço de venda e todos os tamanhos (PP, P, M, G, GG, G1, G2, G3, G4).
                    </p>
                    <Button variant="outline" onClick={handleDownloadTemplate} className="w-full sm:w-auto">
                      <Download className="w-4 h-4 mr-2" />
                      Baixar Modelo Excel
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 2: Fill and Import */}
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-primary/10 text-pink-primary flex items-center justify-center font-semibold text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">Preencher e Importar</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Preencha a quantidade de cada tamanho. Deixe 0 para tamanhos que não existem.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                      id="excel-upload"
                    />
                    <Button
                      variant="pink"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importProducts.isPending}
                      className="w-full sm:w-auto"
                    >
                      {importProducts.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Selecionar Arquivo Excel
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <strong>Dica:</strong> Preencha as quantidades nos tamanhos. Deixe 0 para tamanhos que o produto não possui.
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
