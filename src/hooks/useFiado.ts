import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface FiadoSaleItem {
  id?: string;
  product_id: string | null;
  product_size_id: string | null;
  product_name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface FiadoPayment {
  id: string;
  fiado_sale_id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

export interface FiadoSale {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_cpf: string | null;
  total: number;
  amount_paid: number;
  amount_pending: number;
  installments: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  fiado_sale_items?: FiadoSaleItem[];
  fiado_payments?: FiadoPayment[];
}

export interface CreateFiadoData {
  customer_name: string;
  customer_phone?: string;
  customer_cpf?: string;
  installments?: number;
  notes?: string;
  items: FiadoSaleItem[];
}

export function useFiadoSales(status?: 'all' | 'pendente' | 'pago' | 'parcial') {
  return useQuery({
    queryKey: ['fiado-sales', status],
    queryFn: async () => {
      let query = supabase
        .from('fiado_sales')
        .select(`
          *,
          fiado_sale_items(*)
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data: sales, error } = await query;
      if (error) throw error;

      // Fetch payments separately for each sale
      const salesWithPayments = await Promise.all(
        (sales || []).map(async (sale) => {
          const { data: payments } = await supabase
            .from('fiado_payments')
            .select('*')
            .eq('fiado_sale_id', sale.id)
            .order('created_at', { ascending: false });

          return {
            ...sale,
            fiado_payments: payments || [],
          };
        })
      );

      return salesWithPayments as FiadoSale[];
    },
  });
}

export function useFiadoSummary() {
  return useQuery({
    queryKey: ['fiado-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiado_sales')
        .select('total, amount_paid, amount_pending, status');

      if (error) throw error;

      const totalPending = data
        .filter(s => s.status !== 'pago')
        .reduce((acc, s) => acc + Number(s.amount_pending), 0);

      const totalReceived = data.reduce((acc, s) => acc + Number(s.amount_paid), 0);

      const pendingCount = data.filter(s => s.status === 'pendente').length;
      const partialCount = data.filter(s => s.status === 'parcial').length;
      const paidCount = data.filter(s => s.status === 'pago').length;

      return {
        totalPending,
        totalReceived,
        pendingCount,
        partialCount,
        paidCount,
        totalCount: data.length,
      };
    },
  });
}

export function useCreateFiadoSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateFiadoData) => {
      const total = data.items.reduce((acc, item) => acc + item.total, 0);

      // Create fiado sale
      const { data: fiadoSale, error: saleError } = await supabase
        .from('fiado_sales')
        .insert({
          customer_name: data.customer_name,
          customer_phone: data.customer_phone || null,
          customer_cpf: data.customer_cpf || null,
          total,
          amount_paid: 0,
          amount_pending: total,
          installments: data.installments || 1,
          status: 'pendente',
          notes: data.notes || null,
          user_id: user?.id || null,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = data.items.map(item => ({
        fiado_sale_id: fiadoSale.id,
        product_id: item.product_id,
        product_size_id: item.product_size_id,
        product_name: item.product_name,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('fiado_sale_items')
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
            await supabase
              .from('product_sizes')
              .update({ quantity: Math.max(0, (sizeData.quantity || 0) - item.quantity) })
              .eq('id', item.product_size_id);

            await supabase
              .from('stock_movements')
              .insert({
                product_id: item.product_id,
                product_size_id: item.product_size_id,
                type: 'saida',
                quantity: item.quantity,
                notes: `Venda Fiado - ${data.customer_name}`,
                user_id: user?.id || null,
              });
          }
        }
      }

      return fiadoSale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiado-sales'] });
      queryClient.invalidateQueries({ queryKey: ['fiado-summary'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast.success('Venda fiado registrada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error creating fiado sale:', error);
      toast.error('Erro ao registrar venda fiado');
    },
  });
}

export function useAddFiadoPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      fiado_sale_id,
      amount,
      payment_method,
      notes,
    }: {
      fiado_sale_id: string;
      amount: number;
      payment_method: string;
      notes?: string;
    }) => {
      // Get current sale
      const { data: sale, error: saleError } = await supabase
        .from('fiado_sales')
        .select('amount_paid, amount_pending, total')
        .eq('id', fiado_sale_id)
        .single();

      if (saleError) throw saleError;

      const newAmountPaid = Number(sale.amount_paid) + amount;
      const newAmountPending = Number(sale.total) - newAmountPaid;
      const newStatus = newAmountPending <= 0 ? 'pago' : 'parcial';

      // Add payment
      const { error: paymentError } = await supabase
        .from('fiado_payments')
        .insert({
          fiado_sale_id,
          amount,
          payment_method,
          notes: notes || null,
          user_id: user?.id || null,
        });

      if (paymentError) throw paymentError;

      // Update sale
      const { error: updateError } = await supabase
        .from('fiado_sales')
        .update({
          amount_paid: newAmountPaid,
          amount_pending: Math.max(0, newAmountPending),
          status: newStatus,
        })
        .eq('id', fiado_sale_id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiado-sales'] });
      queryClient.invalidateQueries({ queryKey: ['fiado-summary'] });
      toast.success('Pagamento registrado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error adding payment:', error);
      toast.error('Erro ao registrar pagamento');
    },
  });
}
