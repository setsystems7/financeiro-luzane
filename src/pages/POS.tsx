import { useState, useRef, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProducts, Product } from '@/hooks/useProducts';
import { useCreateSale, SaleItem, PaymentEntry } from '@/hooks/useSales';
import { CARD_BRANDS, getCardFee } from '@/data/cardFees';
import { CardBrandIcon } from '@/components/pos/CardBrandLogos';
import { SaleConfirmationModal } from '@/components/pos/SaleConfirmationModal';
import { formatCurrency } from '@/lib/utils';
import {
  Barcode,
  Plus,
  Minus,
  ShoppingCart,
  X,
  Loader2,
  Search,
  Percent,
  CheckCircle2,
  Banknote,
  QrCode,
  CreditCard,
  Wallet,
  Info,
  Keyboard
} from 'lucide-react';
import { toast } from 'sonner';
import { type SupportSection } from '@/components/layout/SupportButton';

const posSupportSections: SupportSection[] = [
  {
    title: 'O que é o PDV',
    tag: 'essencial',
    content: 'O PDV (Ponto de Venda) é a tela principal onde você registra todas as vendas da loja. Aqui você monta o carrinho com os produtos, aplica descontos e finaliza com o pagamento.',
    icon: undefined,
  },
  {
    title: 'Como registrar uma venda',
    tag: 'essencial',
    content: 'Siga os passos abaixo para fazer uma venda completa:',
    steps: [
      { text: 'No painel da direita, busque o produto pelo nome ou escaneie o código de barras com o leitor.', tip: 'O cursor já fica posicionado no campo de busca automaticamente.' },
      { text: 'Clique no produto desejado e selecione o tamanho. O item será adicionado ao carrinho à esquerda.', tip: 'Se o produto não tiver estoque naquele tamanho, ele não poderá ser adicionado.' },
      { text: 'Repita para todos os produtos que o cliente deseja comprar.' },
      { text: 'Se necessário, aplique um desconto no campo "Desconto (%)" — digite o percentual (ex: 10 para 10%).' },
      { text: 'Escolha o método de pagamento: Dinheiro, PIX, Débito ou Crédito.' },
      { text: 'Para crédito, selecione a bandeira do cartão e o número de parcelas. As taxas são calculadas automaticamente.', tip: 'A taxa do cartão é somada ao valor final que o cliente paga, garantindo que a loja receba o valor integral.' },
      { text: 'Confira o resumo e clique em "Finalizar Venda" para concluir.' },
    ],
    warning: 'Após finalizar, a venda não pode ser desfeita — apenas trocada pelo módulo de Trocas.',
  },
  {
    title: 'Como usar o leitor de código de barras',
    content: 'O sistema detecta automaticamente leitores de código de barras USB.',
    steps: [
      { text: 'Certifique-se de que o cursor está no campo de busca de produtos (painel da direita).' },
      { text: 'Escaneie o produto com o leitor de código de barras.' },
      { text: 'Se o código for EAN-13 (13 dígitos), o produto é identificado e adicionado ao carrinho automaticamente.', tip: 'Se o produto não for encontrado, verifique se o código de barras foi cadastrado corretamente em Produtos.' },
    ],
  },
  {
    title: 'Como alterar quantidade ou remover itens',
    content: 'No carrinho (painel esquerdo):',
    steps: [
      { text: 'Use os botões "+" e "-" ao lado de cada item para aumentar ou diminuir a quantidade.' },
      { text: 'Clique no ícone de lixeira (X) para remover o item completamente do carrinho.' },
    ],
    tips: [
      'O sistema não permite vender mais do que o estoque disponível.',
      'Os valores são recalculados em tempo real a cada alteração.',
    ],
  },
  {
    title: 'Taxas de cartão de crédito',
    tag: 'avançado',
    content: 'Ao pagar com cartão de crédito, o sistema aplica automaticamente a taxa com base na bandeira e número de parcelas.',
    tips: [
      'A taxa é somada ao valor que o cliente paga — a loja recebe sempre o valor cheio.',
      'As taxas podem ser configuradas por bandeira e parcelas nas Configurações.',
      'Para pagamento à vista no crédito (1x), a taxa costuma ser menor.',
    ],
  },
];

interface CartItem extends SaleItem {
  product_size_id: string | null;
  original_price: number;
}

export default function POS() {
  const { data: products = [], isLoading } = useProducts();
  const createSale = useCreateSale();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [installments, setInstallments] = useState<number>(1);
  const [cardBrand, setCardBrand] = useState<string>('');

  // Split payment state
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Array<{
    id: number;
    payment_method: string;
    amount: number;
    card_brand: string;
    installments: number;
  }>>([]);
  const [splitCounter, setSplitCounter] = useState(0);
  const [showSaleConfirmation, setShowSaleConfirmation] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Precisão máxima: fazemos os cálculos em centavos (inteiros) e arredondamos "para cima"
  // no valor que o cliente paga, igual à maquininha (evita diferença de R$ 0,01).
  const toCents = (value: number): number => Math.round(value * 100);
  const fromCents = (cents: number): number => cents / 100;

  // Calcular totais
  const cartSubtotalCents = toCents(
    cartItems.reduce((acc, item) => acc + item.original_price * item.quantity, 0)
  );
  const discountAmountCents = toCents((fromCents(cartSubtotalCents) * discount) / 100);
  const cartTotalCents = cartSubtotalCents - discountAmountCents; // Valor da peça (fixo)

  const cartSubtotal = fromCents(cartSubtotalCents);
  const discountAmount = fromCents(discountAmountCents);
  const cartTotal = fromCents(cartTotalCents);

  // Calcular taxa do cartão (A MAIS - cliente paga)
  // Fórmula da maquininha: para a loja receber "cartTotal", o cliente paga um valor maior
  // tal que: recebido = pago * (1 - taxa%).
  const cardFeePercent = getCardFee(paymentMethod, cardBrand, installments);

  // Converte a taxa (ex.: 5.39%) em basis points (ex.: 539) para evitar floats
  const feeBps = Math.round(cardFeePercent * 100);
  const grossCents = feeBps > 0
    ? Math.ceil((cartTotalCents * 10000) / (10000 - feeBps))
    : cartTotalCents;

  const totalWithFee = fromCents(grossCents);
  const cardFeeAmount = fromCents(grossCents - cartTotalCents);
  const netAmount = cartTotal; // Loja recebe: valor da peça (sem a taxa)

  // Atualizar preços com desconto — usa functional updater para evitar dependência de cartItems
  useEffect(() => {
    setCartItems(prevItems => {
      if (prevItems.length === 0) return prevItems;
      return prevItems.map(item => ({
        ...item,
        unit_price: item.original_price * (1 - discount / 100),
        total: item.original_price * item.quantity * (1 - discount / 100),
      }));
    });
  }, [discount]);

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrar produtos para autocomplete
  const filteredProducts = searchInput.length >= 2
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchInput.toLowerCase()) ||
        p.sizes.some(s => s.barcode === searchInput)
      ).slice(0, 8)
    : [];

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      for (const product of products) {
        const sizeMatch = product.sizes.find(s => s.barcode === searchInput);
        if (sizeMatch) {
          addToCart(product, sizeMatch);
          setSearchInput('');
          setShowSuggestions(false);
          inputRef.current?.focus();
          return;
        }
      }

      if (filteredProducts.length > 0) {
        setShowSuggestions(true);
      } else if (searchInput.length > 0) {
        toast.error('Nenhum produto encontrado com esse termo');
      }
    }
  };

  const handleInputChange = (value: string) => {
    setSearchInput(value);

    if (/^\d{13}$/.test(value)) {
      for (const product of products) {
        const sizeMatch = product.sizes.find(s => s.barcode === value);
        if (sizeMatch) {
          addToCart(product, sizeMatch);
          setSearchInput('');
          setShowSuggestions(false);
          inputRef.current?.focus();
          return;
        }
      }
    }

    setShowSuggestions(value.length >= 2);
  };

  const addToCart = (product: Product, size: { id: string; size: string; quantity: number }) => {
    if (size.quantity <= 0) {
      toast.error('Sem estoque disponível para este tamanho');
      return;
    }

    const existingItem = cartItems.find(
      item => item.product_id === product.id && item.size === size.size
    );

    if (existingItem) {
      const newQty = existingItem.quantity + 1;
      if (newQty > size.quantity) {
        toast.error(`Estoque insuficiente. Disponível: ${size.quantity} un`);
        return;
      }
      setCartItems(cartItems.map(item =>
        item.product_id === product.id && item.size === size.size
          ? {
              ...item,
              quantity: newQty,
              total: item.original_price * newQty * (1 - discount / 100)
            }
          : item
      ));
    } else {
      const priceWithDiscount = product.sale_price * (1 - discount / 100);
      const newItem: CartItem = {
        product_id: product.id,
        product_size_id: size.id,
        product_name: product.name,
        size: size.size,
        quantity: 1,
        unit_price: priceWithDiscount,
        original_price: product.sale_price,
        total: priceWithDiscount,
      };
      setCartItems([...cartItems, newItem]);
    }
  };

  const selectProduct = (product: Product, size: { id: string; size: string; quantity: number }) => {
    addToCart(product, size);
    setSearchInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const updateQuantity = (productId: string, size: string, delta: number) => {
    const item = cartItems.find(i => i.product_id === productId && i.size === size);
    if (!item) return;

    const product = products.find(p => p.id === productId);
    const sizeData = product?.sizes.find(s => s.size === size);

    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    if (sizeData && newQty > sizeData.quantity) {
      toast.error(`Máximo disponível: ${sizeData.quantity} unidades`);
      return;
    }

    setCartItems(cartItems.map(i => {
      if (i.product_id === productId && i.size === size) {
        return {
          ...i,
          quantity: newQty,
          total: i.original_price * newQty * (1 - discount / 100)
        };
      }
      return i;
    }));
  };

  const removeItem = (productId: string, size: string) => {
    setCartItems(cartItems.filter(
      item => !(item.product_id === productId && item.size === size)
    ));
  };

  // Split payment helpers — fixo em 2 pagamentos
  const splitTotal = splitPayments.reduce((acc, p) => acc + p.amount, 0);
  const splitRemaining = Math.max(0, Math.round((cartTotal - splitTotal) * 100) / 100);

  const updateSplitPayment = (id: number, field: string, value: any) => {
    setSplitPayments(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, [field]: value } : p);
      // Se alterou o valor do pagamento 1, auto-preencher pagamento 2
      if (field === 'amount' && updated.length === 2) {
        const first = updated.find(p => p.id === id);
        const second = updated.find(p => p.id !== id);
        if (first && second) {
          const remaining = Math.max(0, Math.round((cartTotal - (value as number)) * 100) / 100);
          return updated.map(p => p.id === second.id ? { ...p, amount: remaining } : p);
        }
      }
      return updated;
    });
  };

  const enterSplitMode = () => {
    setIsSplitMode(true);
    setPaymentMethod('');
    setCardBrand('');
    setSplitPayments([
      { id: 1, payment_method: '', amount: 0, card_brand: '', installments: 1 },
      { id: 2, payment_method: '', amount: 0, card_brand: '', installments: 1 },
    ]);
    setSplitCounter(2);
  };

  const exitSplitMode = () => {
    setIsSplitMode(false);
    setSplitPayments([]);
  };

  // Calculate split total with fees (crédito + débito)
  const getSplitGrossTotal = () => {
    let gross = 0;
    for (const p of splitPayments) {
      const isCard = (p.payment_method === 'cartao_credito' || p.payment_method === 'cartao_debito') && p.card_brand;
      if (isCard) {
        const fee = getCardFee(p.payment_method, p.card_brand, p.installments);
        const bps = Math.round(fee * 100);
        const amtCents = Math.round(p.amount * 100);
        gross += bps > 0 ? Math.ceil((amtCents * 10000) / (10000 - bps)) / 100 : p.amount;
      } else {
        gross += p.amount;
      }
    }
    return gross;
  };

  const handleFinalizeSale = () => {
    if (cartItems.length === 0) {
      toast.error('Adicione produtos ao carrinho para finalizar');
      return;
    }

    if (isSplitMode) {
      // Validate split payments
      for (const p of splitPayments) {
        if (!p.payment_method) {
          toast.error('Selecione o método de pagamento para todas as parcelas');
          return;
        }
        if (p.amount <= 0) {
          toast.error('Todos os valores devem ser maiores que zero');
          return;
        }
        if ((p.payment_method === 'cartao_credito' || p.payment_method === 'cartao_debito') && !p.card_brand) {
          toast.error('Selecione a bandeira do cartão para pagamentos com cartão');
          return;
        }
      }

      if (Math.abs(splitTotal - cartTotal) > 0.01) {
        toast.error(`A soma dos pagamentos (R$ ${formatCurrency(splitTotal)}) deve ser igual ao total (R$ ${formatCurrency(cartTotal)})`);
        return;
      }

      const payments: PaymentEntry[] = splitPayments.map(p => ({
        payment_method: p.payment_method as any,
        amount: p.amount,
        card_brand: p.card_brand || undefined,
        installments: p.installments,
        card_fee_percent: (p.payment_method === 'cartao_credito' || p.payment_method === 'cartao_debito') && p.card_brand
          ? getCardFee(p.payment_method, p.card_brand, p.installments)
          : 0,
      }));

      const grossTotal = getSplitGrossTotal();

      createSale.mutate(
        {
          items: cartItems.map(item => ({
            product_id: item.product_id,
            product_size_id: item.product_size_id,
            product_name: item.product_name,
            size: item.size,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          })),
          total: cartSubtotal,
          discount: discountAmount,
          final_total: grossTotal,
          base_total: cartTotal,
          payment_method: 'dinheiro', // fallback for DB constraint
          payments,
        },
        {
          onSuccess: () => {
            resetAll();
          },
        }
      );
    } else {
      // Original single payment logic
      const finalPaymentMethod = paymentMethod || 'dinheiro';

      if (finalPaymentMethod === 'cartao_credito' && !cardBrand) {
        toast.error('Selecione a bandeira do cartão');
        return;
      }

      createSale.mutate(
        {
          items: cartItems.map(item => ({
            product_id: item.product_id,
            product_size_id: item.product_size_id,
            product_name: item.product_name,
            size: item.size,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          })),
          total: cartSubtotal,
          discount: discountAmount,
          final_total: paymentMethod === 'cartao_credito' ? totalWithFee : cartTotal,
          base_total: cartTotal,
          payment_method: finalPaymentMethod as any,
          installments: paymentMethod === 'cartao_credito' ? installments : 1,
          card_brand: cardBrand || undefined,
          card_fee_percent: cardFeePercent,
        },
        {
          onSuccess: () => {
            resetAll();
          },
        }
      );
    }
  };

  const resetAll = () => {
    setCartItems([]);
    setDiscount(0);
    setPaymentMethod('');
    setInstallments(1);
    setCardBrand('');
    setIsSplitMode(false);
    setSplitPayments([]);
    inputRef.current?.focus();
  };

  const clearCart = () => {
    setCartItems([]);
    setDiscount(0);
    setCardBrand('');
    setIsSplitMode(false);
    setSplitPayments([]);
  };

  return (
    <MainLayout title="PDV" subtitle="Ponto de venda" supportContent={{ moduleName: 'PDV', sections: posSupportSections }}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-110px)]">
        {/* Carrinho e Pagamento - Área Principal à Esquerda */}
        <Card variant="elevated" className="lg:col-span-2 flex flex-col overflow-hidden opacity-0 animate-fade-in-left">
          <CardHeader className="pb-2 shrink-0 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="w-5 h-5 text-pink-primary" />
                Carrinho
                {cartItems.length > 0 && (
                  <Badge variant="pink" className="text-sm px-2">{cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'}</Badge>
                )}
              </CardTitle>
              {cartItems.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex flex-col p-0 overflow-hidden flex-1">
            {/* Produtos do Carrinho - Lista com scroll */}
            <div className="flex-1 overflow-y-auto p-4">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <ShoppingCart className="w-16 h-16 mb-3 opacity-20" />
                  <p className="text-lg font-medium">Carrinho vazio</p>
                  <p className="text-sm">Escaneie ou pesquise produtos para adicionar</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {cartItems.map((item, index) => (
                    <div
                      key={`${item.product_id}-${item.size}`}
                      className="flex flex-col p-3 rounded-xl bg-background border-2 border-border/50 relative group transition-all duration-200 hover:shadow-md hover:border-pink-primary/30 opacity-0 animate-fade-in-up"
                      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                    >
                      {/* Botão remover */}
                      <button
                        onClick={() => removeItem(item.product_id!, item.size!)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:scale-110 shadow-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Nome e tamanho */}
                      <div className="mb-2">
                        <p className="font-semibold text-sm leading-tight line-clamp-2" title={item.product_name}>
                          {item.product_name}
                        </p>
                        <Badge variant="outline" className="text-xs mt-1">{item.size}</Badge>
                      </div>

                      {/* Controle de quantidade */}
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-background rounded-md"
                            onClick={() => updateQuantity(item.product_id!, item.size!, -1)}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                          <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-background rounded-md"
                            onClick={() => updateQuantity(item.product_id!, item.size!, 1)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <p className="font-bold text-pink-primary">
                          R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Área Fixa - Pagamento, Desconto e Total */}
            <div className="shrink-0 border-t-2 border-border bg-card/80 backdrop-blur-sm p-4 space-y-3">
              {/* Linha 1: Desconto e Métodos de Pagamento */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Desconto */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background">
                  <Percent className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Desconto</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    placeholder="0"
                    className="w-16 h-8 text-sm text-center border-0 bg-muted/50 rounded-md"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>

                {!isSplitMode ? (
                  <>
                    {/* Métodos de Pagamento — modo normal */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => { setPaymentMethod(paymentMethod === 'dinheiro' ? '' : 'dinheiro'); setCardBrand(''); }}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all duration-200 ${
                          paymentMethod === 'dinheiro'
                            ? 'border-pink-primary bg-pink-glow shadow-md'
                            : 'border-border bg-background hover:border-pink-primary/50'
                        }`}
                      >
                        <Banknote className={`w-4 h-4 ${paymentMethod === 'dinheiro' ? 'text-pink-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-sm font-medium ${paymentMethod === 'dinheiro' ? 'text-pink-primary' : 'text-foreground'}`}>Dinheiro</span>
                      </button>

                      <button
                        onClick={() => { setPaymentMethod(paymentMethod === 'pix' ? '' : 'pix'); setCardBrand(''); }}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all duration-200 ${
                          paymentMethod === 'pix'
                            ? 'border-pink-primary bg-pink-glow shadow-md'
                            : 'border-border bg-background hover:border-pink-primary/50'
                        }`}
                      >
                        <QrCode className={`w-4 h-4 ${paymentMethod === 'pix' ? 'text-pink-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-sm font-medium ${paymentMethod === 'pix' ? 'text-pink-primary' : 'text-foreground'}`}>PIX</span>
                      </button>

                      <button
                        onClick={() => { setPaymentMethod(paymentMethod === 'cartao_debito' ? '' : 'cartao_debito'); setCardBrand(''); }}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all duration-200 ${
                          paymentMethod === 'cartao_debito'
                            ? 'border-pink-primary bg-pink-glow shadow-md'
                            : 'border-border bg-background hover:border-pink-primary/50'
                        }`}
                      >
                        <Wallet className={`w-4 h-4 ${paymentMethod === 'cartao_debito' ? 'text-pink-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-sm font-medium ${paymentMethod === 'cartao_debito' ? 'text-pink-primary' : 'text-foreground'}`}>Débito</span>
                      </button>

                      <button
                        onClick={() => setPaymentMethod(paymentMethod === 'cartao_credito' ? '' : 'cartao_credito')}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all duration-200 ${
                          paymentMethod === 'cartao_credito'
                            ? 'border-pink-primary bg-pink-glow shadow-md'
                            : 'border-border bg-background hover:border-pink-primary/50'
                        }`}
                      >
                        <CreditCard className={`w-4 h-4 ${paymentMethod === 'cartao_credito' ? 'text-pink-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-sm font-medium ${paymentMethod === 'cartao_credito' ? 'text-pink-primary' : 'text-foreground'}`}>Crédito</span>
                      </button>
                    </div>

                    {/* Botão Múltipla Forma */}
                    {cartItems.length > 0 && (
                      <button
                        onClick={enterSplitMode}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-muted-foreground/40 bg-background hover:border-pink-primary/50 hover:bg-pink-glow/30 transition-all duration-200"
                      >
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">Múltipla Forma de Pagamento</span>
                      </button>
                    )}
                  </>
                ) : (
                  /* Modo Split — botão para voltar */
                  <button
                    onClick={exitSplitMode}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-destructive/50 bg-destructive/10 hover:bg-destructive/20 transition-all duration-200"
                  >
                    <X className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">Cancelar divisão</span>
                  </button>
                )}
              </div>

              {/* Bandeira e Parcelas (modo normal - crédito selecionado) */}
              {!isSplitMode && paymentMethod === 'cartao_credito' && (
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Bandeira:</span>
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      {CARD_BRANDS.map(brand => (
                        <button
                          key={brand.id}
                          onClick={() => setCardBrand(brand.id)}
                          className={`flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border-2 text-xs sm:text-sm font-medium transition-all duration-200 ${
                            cardBrand === brand.id
                              ? 'border-pink-primary bg-pink-glow text-pink-primary'
                              : 'border-border bg-background hover:border-pink-primary/50'
                          }`}
                        >
                          <CardBrandIcon brand={brand.id} className="h-4 sm:h-5 w-auto" />
                          <span>{brand.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Separator orientation="vertical" className="h-8 mx-2 hidden sm:block" />
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">Parcelas:</span>
                    <Select value={installments.toString()} onValueChange={(v) => setInstallments(parseInt(v))}>
                      <SelectTrigger className="w-32 sm:w-40 h-8 sm:h-9 text-xs sm:text-sm bg-background border-border">
                        <SelectValue placeholder="Parcelas" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => {
                          const fee = cardBrand ? getCardFee('cartao_credito', cardBrand, n) : 0;
                          const feeAmount = (cartTotal * fee) / 100;
                          const totalWithFeeOption = cartTotal + feeAmount;
                          return (
                            <SelectItem key={n} value={n.toString()} className="text-xs sm:text-sm">
                              {n}x {cartTotal > 0 ? `R$ ${formatCurrency(totalWithFeeOption / n)}` : ''}
                              {fee > 0 && <span className="text-muted-foreground ml-1">(+{fee.toFixed(2)}%)</span>}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {cardBrand && cardFeePercent > 0 && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto mt-1 sm:mt-0">
                      <Separator orientation="vertical" className="h-8 mx-2 hidden sm:block" />
                      <Info className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-muted-foreground">
                        Taxa: <span className="font-semibold text-amber-500">+{cardFeePercent.toFixed(2)}% (+R$ {formatCurrency(cardFeeAmount)})</span>
                        <span className="mx-1">|</span>
                        Cliente paga: <span className="font-semibold text-pink-primary">R$ {formatCurrency(totalWithFee)}</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Split Payment UI */}
              {isSplitMode && (
                <div className="space-y-2 p-3 rounded-lg border-2 border-pink-primary/30 bg-pink-glow/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">Pagamento dividido</span>
                    <span className={`text-xs font-medium ${Math.abs(splitRemaining) < 0.01 ? 'text-green-500' : 'text-amber-500'}`}>
                      {Math.abs(splitRemaining) < 0.01
                        ? '✓ Valor completo'
                        : `Faltam R$ ${formatCurrency(splitRemaining)}`}
                    </span>
                  </div>

                  {splitPayments.map((sp, idx) => {
                    const isCardPayment = sp.payment_method === 'cartao_credito' || sp.payment_method === 'cartao_debito';
                    const spFee = isCardPayment && sp.card_brand
                      ? getCardFee(sp.payment_method, sp.card_brand, sp.installments)
                      : 0;
                    const spFeeBps = Math.round(spFee * 100);
                    const spAmtCents = Math.round(sp.amount * 100);
                    const spGross = spFeeBps > 0
                      ? Math.ceil((spAmtCents * 10000) / (10000 - spFeeBps)) / 100
                      : sp.amount;
                    const spFeeAmount = spGross - sp.amount;
                    const isSecond = idx === 1;

                    return (
                      <div key={sp.id} className="space-y-2 p-3 rounded-lg bg-background border border-border">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}.</span>

                          {/* Valor */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">R$</span>
                            {isSecond ? (
                              <div className="w-24 h-8 flex items-center justify-center text-sm font-medium bg-muted/50 rounded-md border border-border text-foreground">
                                {sp.amount > 0 ? sp.amount.toFixed(2).replace('.', ',') : '0,00'}
                              </div>
                            ) : (
                              <Input
                                type="number"
                                min="0"
                                max={cartTotal}
                                step="0.01"
                                value={sp.amount || ''}
                                onChange={(e) => {
                                  const val = Math.max(0, Math.min(cartTotal, parseFloat(e.target.value) || 0));
                                  updateSplitPayment(sp.id, 'amount', val);
                                }}
                                className="w-24 h-8 text-sm text-center border-border"
                              />
                            )}
                          </div>

                          {/* Método */}
                          <Select value={sp.payment_method} onValueChange={(v) => {
                            updateSplitPayment(sp.id, 'payment_method', v);
                            if (v !== 'cartao_credito' && v !== 'cartao_debito') {
                              updateSplitPayment(sp.id, 'card_brand', '');
                              updateSplitPayment(sp.id, 'installments', 1);
                            }
                          }}>
                            <SelectTrigger className="w-32 h-8 text-xs bg-background border-border">
                              <SelectValue placeholder="Método" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="dinheiro"><span className="flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Dinheiro</span></SelectItem>
                              <SelectItem value="pix"><span className="flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5" /> PIX</span></SelectItem>
                              <SelectItem value="cartao_debito"><span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Débito</span></SelectItem>
                              <SelectItem value="cartao_credito"><span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Crédito</span></SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Bandeira + Parcelas (se cartão) */}
                        {isCardPayment && (
                          <div className="flex flex-wrap items-center gap-2 ml-7">
                            <Select value={sp.card_brand} onValueChange={(v) => updateSplitPayment(sp.id, 'card_brand', v)}>
                              <SelectTrigger className="w-28 h-8 text-xs bg-background border-border">
                                <SelectValue placeholder="Bandeira" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {CARD_BRANDS.map(b => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {sp.payment_method === 'cartao_credito' && (
                              <Select value={sp.installments.toString()} onValueChange={(v) => updateSplitPayment(sp.id, 'installments', parseInt(v))}>
                                <SelectTrigger className="w-20 h-8 text-xs bg-background border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border">
                                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                                    <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {spFee > 0 && sp.amount > 0 && (
                              <div className="flex flex-col text-xs">
                                <span className="text-amber-500 font-medium">
                                  +{spFee.toFixed(1)}% (R$ {formatCurrency(spFeeAmount)})
                                </span>
                                <span className="text-foreground font-semibold">
                                  Cliente: R$ {formatCurrency(spGross)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                </div>
              )}

              {/* Total e Botão Finalizar */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  {discount > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <span className="line-through">R$ {formatCurrency(cartSubtotal)}</span>
                      <span className="ml-2 text-green-500 font-medium">-{discount}%</span>
                    </div>
                  )}

                  {isSplitMode ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg text-muted-foreground">Total:</span>
                      <span className="text-3xl font-bold text-pink-primary">
                        R$ {formatCurrency(cartTotal)}
                      </span>
                      {getSplitGrossTotal() > cartTotal && (
                        <span className="text-sm text-amber-500 font-medium">
                          (Cliente: R$ {formatCurrency(getSplitGrossTotal())})
                        </span>
                      )}
                    </div>
                  ) : cardBrand && cardFeePercent > 0 ? (
                    <>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-glow border-2 border-pink-primary/50 shadow-lg">
                        <span className="text-lg text-muted-foreground">Peça:</span>
                        <span className="text-4xl font-bold text-pink-primary">
                          R$ {formatCurrency(totalWithFee)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        <span className="text-sm">(+Taxa {cardFeePercent.toFixed(2)}%:</span>
                        <span className="font-semibold">R$ {formatCurrency(cardFeeAmount)})</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg text-muted-foreground">Total:</span>
                      <span className="text-3xl font-bold text-pink-primary">
                        R$ {formatCurrency(cartTotal)}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  variant="pink"
                  className="h-12 px-8 text-base font-semibold btn-glow"
                  onClick={handleFinalizeSale}
                  disabled={cartItems.length === 0 || createSale.isPending}
                >
                  {createSale.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Finalizar Venda
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Busca - Área Menor à Direita */}
        <div className="space-y-4 opacity-0 animate-fade-in-right">
          <Card variant="pink" className="overflow-visible">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="w-4 h-4" />
                Buscar Produto
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="relative" ref={suggestionsRef}>
                <div className="relative group">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    ref={inputRef}
                    value={searchInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleSearch}
                    onFocus={() => searchInput.length >= 2 && setShowSuggestions(true)}
                    placeholder="Bipe ou digite..."
                    className="pl-10 pr-4 h-12 text-base font-medium border-2 focus:border-pink-primary transition-all duration-300"
                    autoFocus
                  />
                </div>

                {/* Autocomplete Suggestions */}
                {showSuggestions && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-card border-2 border-border rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-down max-h-[400px] overflow-y-auto">
                    {filteredProducts.map((product, index) => (
                      <div
                        key={product.id}
                        className="border-b border-border last:border-0 opacity-0 animate-fade-in-up"
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                      >
                        <div className="p-3 bg-muted/30">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-foreground text-sm block truncate">{product.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {product.category_name}
                              </span>
                            </div>
                            <span className="font-bold text-pink-primary shrink-0">
                              R$ {product.sale_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <div className="p-2 flex flex-wrap gap-1.5">
                          {product.sizes.filter(s => s.quantity > 0).map(size => (
                            <button
                              key={size.id}
                              onClick={() => selectProduct(product, size)}
                              className="px-3 py-1.5 rounded-lg border-2 border-border bg-background hover:border-pink-primary hover:bg-pink-glow hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-1.5 text-sm"
                            >
                              <span className="font-medium">{size.size}</span>
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {size.quantity}
                              </Badge>
                            </button>
                          ))}
                          {product.sizes.filter(s => s.quantity > 0).length === 0 && (
                            <span className="text-xs text-muted-foreground py-1">Sem estoque</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-2 text-center">
                Escaneie o código de barras ou pesquise pelo nome
              </p>
            </CardContent>
          </Card>

          {/* Dica de uso */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
            <p className="text-xs text-muted-foreground">
              💡 O leitor de código de barras adiciona automaticamente ao carrinho
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
