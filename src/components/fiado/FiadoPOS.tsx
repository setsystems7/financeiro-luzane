import { useState, useEffect, useMemo, forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  FileText,
  Phone,
  CreditCard,
  ShoppingBag
} from 'lucide-react';
import { useProducts, Product } from '@/hooks/useProducts';
import { useCreateFiadoSale, FiadoSaleItem } from '@/hooks/useFiado';
import { cn } from '@/lib/utils';

interface CartItem extends FiadoSaleItem {
  id: string;
}

interface FiadoPOSProps {
  onSaleComplete: () => void;
}

export const FiadoPOS = forwardRef<HTMLDivElement, FiadoPOSProps>(function FiadoPOS({ onSaleComplete }, ref) {
  const { data: products, isLoading: loadingProducts } = useProducts();
  const createFiadoSale = useCreateFiadoSale();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');
  const [installments, setInstallments] = useState('1');
  const [notes, setNotes] = useState('');

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.total, 0);
  }, [cart]);

  const installmentValue = useMemo(() => {
    const numInstallments = parseInt(installments) || 1;
    return cartTotal / numInstallments;
  }, [cartTotal, installments]);

  // Filter products by search term
  const filteredProducts = useMemo(() => {
    if (!products || !searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.sizes?.some(s => s.barcode?.includes(searchTerm))
    ).slice(0, 10);
  }, [products, searchTerm]);

  // Handle barcode scan
  useEffect(() => {
    if (!searchTerm || !products) return;

    const matchingProduct = products.find(p =>
      p.sizes?.some(s => s.barcode === searchTerm)
    );

    if (matchingProduct) {
      const matchingSize = matchingProduct.sizes?.find(s => s.barcode === searchTerm);
      if (matchingSize && matchingSize.quantity > 0) {
        selectProduct(matchingProduct, matchingSize);
        setSearchTerm('');
        setShowSuggestions(false);
      }
    }
  }, [searchTerm, products]);

  const selectProduct = (product: Product, size: { id: string; size: string; quantity: number }) => {
    const existingIndex = cart.findIndex(
      item => item.product_id === product.id && item.size === size.size
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      const currentQty = newCart[existingIndex].quantity;
      if (currentQty < size.quantity) {
        newCart[existingIndex].quantity += 1;
        newCart[existingIndex].total = newCart[existingIndex].quantity * newCart[existingIndex].unit_price;
        setCart(newCart);
      }
    } else {
      const newItem: CartItem = {
        id: `${product.id}-${size.size}`,
        product_id: product.id,
        product_size_id: size.id,
        product_name: product.name,
        size: size.size,
        quantity: 1,
        unit_price: Number(product.sale_price),
        total: Number(product.sale_price),
      };
      setCart([...cart, newItem]);
    }

    setSearchTerm('');
    setShowSuggestions(false);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    const newCart = cart.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(1, item.quantity + delta);

        // Check stock
        const product = products?.find(p => p.id === item.product_id);
        const size = product?.sizes?.find(s => s.size === item.size);
        const maxQty = size?.quantity || 0;

        const finalQty = Math.min(newQty, maxQty);
        return {
          ...item,
          quantity: finalQty,
          total: finalQty * item.unit_price,
        };
      }
      return item;
    });
    setCart(newCart);
  };

  const removeItem = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerCpf('');
    setInstallments('1');
    setNotes('');
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      return;
    }

    if (!customerName.trim()) {
      return;
    }

    const saleItems: FiadoSaleItem[] = cart.map(item => ({
      product_id: item.product_id,
      product_size_id: item.product_size_id,
      product_name: item.product_name,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
    }));

    await createFiadoSale.mutateAsync({
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || undefined,
      customer_cpf: customerCpf.trim() || undefined,
      items: saleItems,
      total: cartTotal,
      installments: parseInt(installments) || 1,
      notes: notes.trim() || undefined,
    });

    clearCart();
    onSaleComplete();
  };

  const isFormValid = cart.length > 0 && customerName.trim().length > 0;

  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      {/* Left: Cart and Customer Info */}
      <div className="space-y-6">
        {/* Customer Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="customer-name">Nome do Cliente *</Label>
                <Input
                  id="customer-name"
                  placeholder="Nome completo"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="customer-phone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="customer-phone"
                    placeholder="(00) 00000-0000"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="customer-cpf">CPF</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="customer-cpf"
                    placeholder="000.000.000-00"
                    value={customerCpf}
                    onChange={(e) => setCustomerCpf(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cart Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Itens da Venda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum item adicionado</p>
                  <p className="text-sm">Bipe ou pesquise produtos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {item.size}
                          </Badge>
                          <span>R$ {item.unit_price.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="w-20 text-right font-medium">
                        R$ {item.total.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Payment Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Condição de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="installments">Parcelas (Promissória)</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x de R$ {(cartTotal / n).toFixed(2)} sem juros
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações sobre a venda..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-primary">R$ {cartTotal.toFixed(2)}</span>
              </div>
              {parseInt(installments) > 1 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{installments}x de:</span>
                  <span>R$ {installmentValue.toFixed(2)}</span>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleFinalizeSale}
              disabled={!isFormValid || createFiadoSale.isPending}
            >
              {createFiadoSale.isPending ? 'Registrando...' : 'Registrar Venda Fiado'}
            </Button>

            {cart.length > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={clearCart}
              >
                Limpar Carrinho
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Product Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" />
            Adicionar Produtos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Bipe o código de barras ou pesquise..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="pl-10"
              autoFocus
            />
          </div>

          {showSuggestions && filteredProducts.length > 0 && (
            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="p-2 space-y-2">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="border rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      {product.photo_url ? (
                        <img
                          src={product.photo_url}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                          <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-primary font-bold">
                          R$ {Number(product.sale_price).toFixed(2)}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {product.sizes?.map((size) => (
                            <Button
                              key={size.id}
                              variant={size.quantity > 0 ? 'outline' : 'ghost'}
                              size="sm"
                              disabled={size.quantity === 0}
                              className={cn(
                                "text-xs",
                                size.quantity === 0 && "opacity-50"
                              )}
                              onClick={() => {
                                if (size.quantity > 0) {
                                  selectProduct(product, size);
                                }
                              }}
                            >
                              {size.size} ({size.quantity})
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {showSuggestions && searchTerm && filteredProducts.length === 0 && !loadingProducts && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum produto encontrado</p>
            </div>
          )}

          {!searchTerm && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Digite para pesquisar produtos</p>
              <p className="text-sm">ou bipe o código de barras</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

FiadoPOS.displayName = 'FiadoPOS';
