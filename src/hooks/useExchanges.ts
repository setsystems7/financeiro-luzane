import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface ExchangeItem {
  id?: string;
  product_id: string | null;
  product_size_id: string | null;
  product_name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  returned_to_stock?: boolean;
}

export interface Exchange {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  original_sale_id: string | null;
  reason: string | null;
  credit_amount: number;
  credit_used: number;
  is_active: boolean;
  created_at: string;
  used_at: string | null;
  exchange_items?: ExchangeItem[];
}

export interface CreateExchangeData {
  customer_name?: string;
  customer_phone?: string;
  original_sale_id?: string;
  reason?: string;
  items: ExchangeItem[];
  return_to_stock: boolean;
}

export function useExchanges() {
  return useQuery({
    queryKey: ['exchanges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchanges')
        .select(`
          *,
          exchange_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Exchange[];
    },
  });
}

export function useActiveExchanges() {
  return useQuery({
    queryKey: ['active-exchanges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchanges')
        .select('*')
        .eq('is_active', true)
        .gt('credit_amount', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data.filter(e => (e.credit_amount - (e.credit_used || 0)) > 0) as Exchange[];
    },
  });
}

export function useCreateExchange() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateExchangeData) => {
      const creditAmount = data.items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);

      // Create exchange
      const { data: exchange, error: exchangeError } = await supabase
        .from('exchanges')
        .insert({
          customer_name: data.customer_name || null,
          customer_phone: data.customer_phone || null,
          original_sale_id: data.original_sale_id || null,
          reason: data.reason || null,
          credit_amount: creditAmount,
          credit_used: 0,
          is_active: true,
          user_id: user?.id || null,
        })
        .select()
        .single();

      if (exchangeError) throw exchangeError;

      // Create exchange items
      const exchangeItems = data.items.map(item => ({
        exchange_id: exchange.id,
        product_id: item.product_id,
        product_size_id: item.product_size_id,
        product_name: item.product_name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unit_price,
        returned_to_stock: data.return_to_stock,
      }));

      const { error: itemsError } = await supabase
        .from('exchange_items')
        .insert(exchangeItems);

      if (itemsError) throw itemsError;

      // Return items to stock if requested
      if (data.return_to_stock) {
        for (const item of data.items) {
          if (item.product_size_id) {
            const { data: sizeData } = await supabase
              .from('product_sizes')
              .select('quantity')
              .eq('id', item.product_size_id)
              .single();

            if (sizeData) {
              await supabase
                .from('product_sizes')
                .update({ quantity: (sizeData.quantity || 0) + item.quantity })
                .eq('id', item.product_size_id);

              // Register stock movement
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
      }

      return exchange;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['active-exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast.success('Troca registrada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error creating exchange:', error);
      toast.error('Erro ao registrar troca');
    },
  });
}

export function useUseExchangeCredit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ exchangeId, amount }: { exchangeId: string; amount: number }) => {
      const { data: exchange, error: fetchError } = await supabase
        .from('exchanges')
        .select('credit_amount, credit_used')
        .eq('id', exchangeId)
        .single();

      if (fetchError) throw fetchError;

      const newCreditUsed = (exchange.credit_used || 0) + amount;
      const remainingCredit = exchange.credit_amount - newCreditUsed;

      const { error } = await supabase
        .from('exchanges')
        .update({
          credit_used: newCreditUsed,
          is_active: remainingCredit > 0,
          used_at: new Date().toISOString(),
        })
        .eq('id', exchangeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['active-exchanges'] });
    },
  });
}
