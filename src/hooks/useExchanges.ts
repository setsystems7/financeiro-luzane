import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface ExchangeItem {
  product_id: string | null;
  product_size_id: string | null;
  product_name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
}

export interface CreateExchangeData {
  original_sale_id?: string;
  customer_name?: string;
  customer_phone?: string;
  reason?: string;
  returned_items: ExchangeItem[];
  new_items?: ExchangeItem[];
  value_difference: number; // positive = customer pays, negative = store owes/credit
}

export function useExchanges() {
  return useQuery({
    queryKey: ['exchanges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchanges')
        .select(`
          *,
          exchange_items(*),
          sales:original_sale_id(sale_number, customer_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useMonthExchanges() {
  return useQuery({
    queryKey: ['month-exchanges'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const { data, error } = await supabase
        .from('exchanges')
        .select('id, credit_amount, credit_used, created_at')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      if (error) throw error;

      const total = data?.length || 0;
      const totalValue = data?.reduce((sum, e) => sum + (e.credit_amount || 0), 0) || 0;
      const totalCredit = data?.reduce((sum, e) => sum + (e.credit_used || 0), 0) || 0;

      return { total, totalValue, totalCredit };
    },
  });
}

export function useSaleByNumber(saleNumber: string) {
  return useQuery({
    queryKey: ['sale-by-number', saleNumber],
    queryFn: async () => {
      if (!saleNumber) return null;

      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items(
            *,
            product_sizes:product_size_id(quantity)
          )
        `)
        .eq('sale_number', parseInt(saleNumber))
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    },
    enabled: !!saleNumber && saleNumber.length > 0,
  });
}

export function useCreateExchange() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateExchangeData) => {
      // Calculate totals
      const returnedTotal = data.returned_items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      const newTotal = data.new_items?.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) || 0;

      // Use provided value_difference for financial, but track credit_amount/credit_used for exchange record
      const valueDiff = data.value_difference;
      const creditAmount = Math.max(0, returnedTotal); // Total being returned
      const creditUsed = newTotal; // Total used for new items

      // Create exchange record
      const { data: exchange, error: exchangeError } = await supabase
        .from('exchanges')
        .insert({
          original_sale_id: data.original_sale_id || null,
          customer_name: data.customer_name || null,
          customer_phone: data.customer_phone || null,
          reason: data.reason || null,
          credit_amount: creditAmount,
          credit_used: creditUsed,
          is_active: valueDiff < 0, // Has credit to use if store owes customer
          user_id: user?.id || null,
        })
        .select()
        .single();

      if (exchangeError) throw exchangeError;

      // Create exchange items for returned products
      const returnedExchangeItems = data.returned_items.map(item => ({
        exchange_id: exchange.id,
        product_id: item.product_id,
        product_size_id: item.product_size_id,
        product_name: item.product_name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unit_price,
        returned_to_stock: true,
      }));

      // Create exchange items for new products
      const newExchangeItems = data.new_items?.map(item => ({
        exchange_id: exchange.id,
        product_id: item.product_id,
        product_size_id: item.product_size_id,
        product_name: item.product_name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unit_price,
        returned_to_stock: false,
      })) || [];

      const allItems = [...returnedExchangeItems, ...newExchangeItems];

      if (allItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('exchange_items')
          .insert(allItems);

        if (itemsError) throw itemsError;
      }

      // Return items to stock
      for (const item of data.returned_items) {
        if (item.product_size_id) {
          // Get current quantity
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
                notes: `Devolução - Troca #${exchange.id.slice(0, 8)}`,
                user_id: user?.id || null,
              });
          }
        }
      }

      // Process new items (remove from stock)
      if (data.new_items && data.new_items.length > 0) {
        for (const item of data.new_items) {
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

              // Record stock movement
              await supabase
                .from('stock_movements')
                .insert({
                  product_id: item.product_id,
                  product_size_id: item.product_size_id,
                  type: 'saida',
                  quantity: item.quantity,
                  notes: `Troca #${exchange.id.slice(0, 8)}`,
                  user_id: user?.id || null,
                });
            }
          }
        }
      }

      // Create financial record based on value_difference
      const today = new Date().toISOString().split('T')[0];

      if (valueDiff > 0) {
        // Customer pays more - create receivable (positive difference)
        await supabase
          .from('receivables')
          .insert({
            description: `Diferença troca #${exchange.id.slice(0, 8)} - ${data.customer_name || 'Cliente'}`,
            amount: valueDiff,
            fee: 0,
            net_amount: valueDiff,
            due_date: today,
            is_received: true,
            received_date: today,
          });
      } else if (valueDiff < 0) {
        // Store owes customer - create expense (negative difference = credit for customer)
        await supabase
          .from('expenses')
          .insert({
            description: `Crédito troca #${exchange.id.slice(0, 8)} - ${data.customer_name || 'Cliente'}`,
            amount: Math.abs(valueDiff),
            category: 'Troca/Devolução',
            due_date: today,
            status: 'pago',
            paid_date: today,
            user_id: user?.id || null,
          });
      }

      // Update original sale status if provided
      if (data.original_sale_id) {
        await supabase
          .from('sales')
          .update({ status: 'trocada' })
          .eq('id', data.original_sale_id);
      }

      return exchange;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['month-exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Troca registrada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error creating exchange:', error);
      toast.error('Erro ao registrar troca');
    },
  });
}
