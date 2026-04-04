import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface SaleItem {
  product_id: string | null;
  product_size_id: string | null;
  product_name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface PaymentEntry {
  payment_method: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'crediario';
  amount: number;
  card_brand?: string;
  installments?: number;
  card_fee_percent?: number;
}

export interface CreateSaleData {
  items: SaleItem[];
  total: number;
  discount?: number;
  final_total: number;
  base_total?: number;
  payment_method: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'crediario';
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
  installments?: number;
  card_brand?: string;
  card_fee_percent?: number;
  // Split payments
  payments?: PaymentEntry[];
}

export function useSales() {
  return useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useTodaySales() {
  return useQuery({
    queryKey: ['sales', 'today'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('sales')
        .select('final_total')
        .gte('created_at', today.toISOString())
        .eq('status', 'concluida');

      if (error) throw error;

      const total = data.reduce((acc, sale) => acc + Number(sale.final_total), 0);
      return { total, count: data.length };
    },
  });
}

export function useMonthSales() {
  return useQuery({
    queryKey: ['sales', 'month'],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('sales')
        .select('final_total, total')
        .gte('created_at', startOfMonth.toISOString())
        .eq('status', 'concluida');

      if (error) throw error;

      const total = data.reduce((acc, sale) => acc + Number(sale.final_total), 0);
      return { total, count: data.length };
    },
  });
}

export function useMonthProfit() {
  return useQuery({
    queryKey: ['sales', 'month-profit'],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          final_total,
          sale_items(
            product_id,
            quantity,
            unit_price,
            total
          )
        `)
        .gte('created_at', startOfMonth.toISOString())
        .eq('status', 'concluida');

      if (salesError) throw salesError;

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, cost_price');

      if (productsError) throw productsError;

      const productCostMap = new Map<string, number>();
      products.forEach(p => {
        productCostMap.set(p.id, Number(p.cost_price));
      });

      let totalRevenue = 0;
      let totalCost = 0;

      sales.forEach(sale => {
        totalRevenue += Number(sale.final_total);

        sale.sale_items?.forEach((item: any) => {
          if (item.product_id) {
            const costPrice = productCostMap.get(item.product_id) || 0;
            totalCost += costPrice * item.quantity;
          }
        });
      });

      const profit = totalRevenue - totalCost;

      return { profit, totalRevenue, totalCost };
    },
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateSaleData) => {
      const isSplit = data.payments && data.payments.length > 1;
      const cardFeePercent = data.card_fee_percent || 0;
      const baseTotal = data.base_total || data.final_total;
      const cardFeeAmount = data.final_total - baseTotal;
      const netAmount = baseTotal;

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          user_id: user?.id || null,
          total: data.total,
          discount: data.discount || 0,
          final_total: data.final_total,
          payment_method: isSplit ? 'pix' : data.payment_method, // 'pix' as fallback for split (field is required)
          customer_name: data.customer_name || null,
          customer_phone: data.customer_phone || null,
          notes: isSplit ? `Pagamento dividido | ${data.notes || ''}`.trim() : (data.notes || null),
          installments: data.installments || 1,
          status: 'concluida',
          card_brand: isSplit ? null : (data.card_brand || null),
          card_fee_percent: isSplit ? 0 : cardFeePercent,
          card_fee_amount: isSplit ? 0 : cardFeeAmount,
          net_amount: isSplit ? baseTotal : netAmount,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Insert sale items
      const saleItems = data.items.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        product_size_id: item.product_size_id,
        product_name: item.product_name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update stock
      for (const item of data.items) {
        if (item.product_size_id) {
          const { data: sizeData } = await supabase
            .from('product_sizes')
            .select('quantity')
            .eq('id', item.product_size_id)
            .single();

          if (sizeData) {
            const newQuantity = Math.max(0, sizeData.quantity - item.quantity);
            await supabase
              .from('product_sizes')
              .update({ quantity: newQuantity })
              .eq('id', item.product_size_id);

            await supabase
              .from('stock_movements')
              .insert({
                product_id: item.product_id,
                product_size_id: item.product_size_id,
                type: 'saida',
                quantity: item.quantity,
                notes: `Venda #${sale.sale_number}`,
                user_id: user?.id || null,
              });
          }
        }
      }

      // Handle payments and receivables
      if (isSplit && data.payments) {
        // Insert sale_payments records
        const paymentRecords = data.payments.map(p => {
          const pFeePercent = p.card_fee_percent || 0;
          const feeBps = Math.round(pFeePercent * 100);
          const amountCents = Math.round(p.amount * 100);
          const pCardFeeAmount = feeBps > 0 
            ? (amountCents - Math.round((amountCents * 10000) / (10000 + feeBps))) / 100 
            : 0;
          const pNetAmount = p.amount - pCardFeeAmount;

          return {
            sale_id: sale.id,
            payment_method: p.payment_method,
            amount: p.amount,
            card_brand: p.card_brand || null,
            installments: p.installments || 1,
            card_fee_percent: pFeePercent,
            card_fee_amount: pCardFeeAmount,
            net_amount: pNetAmount,
          };
        });

        await supabase.from('sale_payments').insert(paymentRecords);

        // Create one receivable per payment
        for (const pr of paymentRecords) {
          const dueDate = new Date();
          if (pr.payment_method === 'cartao_debito') {
            dueDate.setDate(dueDate.getDate() + 1);
          } else if (pr.payment_method === 'crediario') {
            dueDate.setDate(dueDate.getDate() + 30);
          }

          const isImmediate = pr.payment_method === 'dinheiro' ||
                              pr.payment_method === 'pix' ||
                              pr.payment_method === 'cartao_credito' ||
                              pr.payment_method === 'cartao_debito';

          const methodLabel = {
            dinheiro: 'Dinheiro', pix: 'PIX', cartao_debito: 'Débito',
            cartao_credito: 'Crédito', crediario: 'Crediário',
          }[pr.payment_method] || pr.payment_method;

          await supabase.from('receivables').insert({
            sale_id: sale.id,
            description: `Venda #${sale.sale_number} - ${methodLabel}`,
            amount: pr.amount,
            fee: pr.card_fee_amount,
            net_amount: pr.net_amount,
            due_date: dueDate.toISOString().split('T')[0],
            is_received: isImmediate,
            received_date: isImmediate ? dueDate.toISOString().split('T')[0] : null,
          });
        }
      } else {
        // Single payment — original logic
        const installments = data.installments || 1;
        const dueDate = new Date();

        if (data.payment_method === 'dinheiro' || data.payment_method === 'pix' || data.payment_method === 'cartao_credito') {
          // Immediate
        } else if (data.payment_method === 'cartao_debito') {
          dueDate.setDate(dueDate.getDate() + 1);
        } else {
          dueDate.setDate(dueDate.getDate() + 30);
        }

        const fee = cardFeeAmount;
        const isImmediate = data.payment_method === 'dinheiro' ||
                           data.payment_method === 'pix' ||
                           data.payment_method === 'cartao_credito' ||
                           data.payment_method === 'cartao_debito';

        let description = `Venda #${sale.sale_number}`;
        if (installments > 1) {
          description += ` - ${installments}x`;
        }

        const netAmountReceivable = baseTotal;

        const receivableEntry = {
          sale_id: sale.id,
          description: description,
          amount: data.final_total,
          fee: fee,
          net_amount: netAmountReceivable,
          due_date: dueDate.toISOString().split('T')[0],
          is_received: isImmediate,
          received_date: isImmediate ? dueDate.toISOString().split('T')[0] : null,
        };

        const { error: receivableError } = await supabase
          .from('receivables')
          .insert(receivableEntry);

        if (receivableError) {
          console.error('Error creating receivables:', receivableError);
        }
      }

      return sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      toast.success(`Venda #${sale.sale_number} registrada`);
    },
    onError: (error: any) => {
      console.error('Error creating sale:', error);
      toast.error('Não foi possível finalizar a venda. Verifique os dados e tente novamente.');
    },
  });
}

export function useRecentSales(limit: number = 5) {
  return useQuery({
    queryKey: ['sales', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items(product_name)
        `)
        .eq('status', 'concluida')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
  });
}

export function useCardSales(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['sales', 'card-sales', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select('*')
        .eq('status', 'concluida')
        .eq('payment_method', 'cartao_credito')
        .not('card_brand', 'is', null)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const totals = (data || []).reduce((acc, sale) => {
        acc.totalSales += Number(sale.final_total) || 0;
        acc.totalFees += Number(sale.card_fee_amount) || 0;
        acc.netAmount += Number(sale.net_amount) || 0;
        return acc;
      }, { totalSales: 0, totalFees: 0, netAmount: 0 });

      return { sales: data || [], totals };
    },
  });
}

export function useCancelSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (saleId: string) => {
      // 1. Get sale items to restore stock
      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (itemsError) throw itemsError;

      // 2. Get sale info
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      // 3. Restore stock for each item
      for (const item of saleItems || []) {
        if (item.product_size_id) {
          const { data: sizeData } = await supabase
            .from('product_sizes')
            .select('quantity')
            .eq('id', item.product_size_id)
            .single();

          if (sizeData) {
            const newQuantity = sizeData.quantity + item.quantity;
            await supabase
              .from('product_sizes')
              .update({ quantity: newQuantity })
              .eq('id', item.product_size_id);

            // Record stock movement
            await supabase
              .from('stock_movements')
              .insert({
                product_id: item.product_id,
                product_size_id: item.product_size_id,
                type: 'entrada',
                quantity: item.quantity,
                notes: `Estorno Venda #${sale.sale_number}`,
                user_id: user?.id || null,
              });
          }
        }
      }

      // 4. Delete related receivables
      await supabase
        .from('receivables')
        .delete()
        .eq('sale_id', saleId);

      // 5. Delete sale items
      await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', saleId);

      // 6. Delete the sale
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId);

      if (deleteError) throw deleteError;

      return sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success(`Venda #${sale.sale_number} cancelada e estoque devolvido!`);
    },
    onError: (error: any) => {
      console.error('Error cancelling sale:', error);
      toast.error('Erro ao cancelar venda');
    },
  });
}
