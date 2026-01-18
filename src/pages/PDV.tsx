import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, QrCode, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CartItem {
  product_id: string;
  product_size_id: string;
  product_name: string;
  size: string;
  quantity: number;
  unit_price: number;
  total: number;
  max_quantity: number;
}

export default function PDV() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('dinheiro');
  const [installments, setInstallments] = useState(1);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: products } = useQuery({
    queryKey: ['pdv-products', search],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          sale_price,
          barcode,
          product_sizes(id, size, quantity, barcode)
        `)
        .eq('is_active', true);

      if (search) {
        query = query.or(`name.ilike.%${search}%,barcode.ilike.%${search}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const addToCart = (product: any, size: any) => {
    if (size.quantity <= 0) {
      toast.error('Produto sem estoque');
      return;
    }

    const existingItem = cart.find(
      (item) => item.product_size_id === size.id
    );

    if (existingItem) {
      if (existingItem.quantity >= size.quantity) {
        toast.error('Quantidade máxima atingida');
        return;
      }
      setCart(
        cart.map((item) =>
          item.product_size_id === size.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_size_id: size.id,
          product_name: product.name,
          size: size.size,
          quantity: 1,
          unit_price: product.sale_price,
          total: product.sale_price,
          max_quantity: size.quantity,
        },
      ]);
    }

    setSearch('');
    searchRef.current?.focus();
  };

  const updateQuantity = (productSizeId: string, delta: number) => {
    setCart(
      cart.map((item) => {
        if (item.product_size_id === productSizeId) {
          const newQuantity = Math.max(1, Math.min(item.max_quantity, item.quantity + delta));
          return {
            ...item,
            quantity: newQuantity,
            total: newQuantity * item.unit_price,
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productSizeId: string) => {
    setCart(cart.filter((item) => item.product_size_id !== productSizeId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const total = Math.max(0, subtotal - discount);

  const finalizeSale = async () => {
    if (cart.length === 0) {
      toast.error('Adicione produtos ao carrinho');
      return;
    }

    setIsProcessing(true);

    try {
      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          user_id: user?.id,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          payment_method: paymentMethod as any,
          installments,
          total: subtotal,
          discount,
          final_total: total,
          status: 'concluida',
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        product_size_id: item.product_size_id,
        product_name: item.product_name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      }));

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
      if (itemsError) throw itemsError;

      // Update stock
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from('product_sizes')
          .update({ quantity: item.max_quantity - item.quantity })
          .eq('id', item.product_size_id);
        if (stockError) throw stockError;

        // Create stock movement
        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          product_size_id: item.product_size_id,
          type: 'saida',
          quantity: item.quantity,
          notes: `Venda #${sale.sale_number}`,
          user_id: user?.id,
        });
      }

      toast.success('Venda realizada com sucesso!', {
        description: `Venda #${sale.sale_number}`,
      });

      // Reset
      setCart([]);
      setDiscount(0);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('dinheiro');
      setInstallments(1);
      setIsPaymentOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pdv-products'] });

    } catch (error: any) {
      toast.error('Erro ao finalizar venda', { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3 h-[calc(100vh-8rem)] animate-fade-in">
      {/* Products */}
      <div className="lg:col-span-2 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Buscar produto por nome ou código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-lg"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 overflow-auto max-h-[calc(100vh-14rem)] scrollbar-thin">
          {products?.map((product) => (
            <Card key={product.id} className="cursor-pointer hover:border-primary transition-colors">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm line-clamp-2">{product.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-lg font-bold text-primary">{formatCurrency(product.sale_price)}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {product.product_sizes?.map((size: any) => (
                    <Button
                      key={size.id}
                      variant={size.quantity > 0 ? 'outline' : 'ghost'}
                      size="sm"
                      disabled={size.quantity <= 0}
                      onClick={() => addToCart(product, size)}
                      className="h-7 px-2 text-xs"
                    >
                      {size.size} ({size.quantity})
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Cart */}
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrinho ({cart.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto scrollbar-thin">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mb-2" />
                <p>Carrinho vazio</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product_size_id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Tam: {item.size} • {formatCurrency(item.unit_price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.product_size_id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.product_size_id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className="font-medium">{formatCurrency(item.total)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeFromCart(item.product_size_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-4 mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="discount" className="text-sm">Desconto:</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="h-8 w-24"
              />
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>

            <Button
              className="w-full h-12 text-lg"
              disabled={cart.length === 0}
              onClick={() => setIsPaymentOpen(true)}
            >
              <CreditCard className="mr-2 h-5 w-5" />
              Finalizar Venda
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar Venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome do Cliente</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                  { value: 'pix', label: 'PIX', icon: QrCode },
                  { value: 'cartao_debito', label: 'Débito', icon: CreditCard },
                  { value: 'cartao_credito', label: 'Crédito', icon: CreditCard },
                ].map((method) => (
                  <Button
                    key={method.value}
                    variant={paymentMethod === method.value ? 'default' : 'outline'}
                    className="h-12 justify-start"
                    onClick={() => setPaymentMethod(method.value)}
                  >
                    <method.icon className="mr-2 h-4 w-4" />
                    {method.label}
                  </Button>
                ))}
              </div>
            </div>

            {paymentMethod === 'cartao_credito' && (
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Select value={String(installments)} onValueChange={(v) => setInstallments(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x de {formatCurrency(total / n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex justify-between text-xl font-bold mb-4">
                <span>Total:</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
              <Button
                className="w-full h-12 text-lg"
                onClick={finalizeSale}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  'Processando...'
                ) : (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Confirmar Venda
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
