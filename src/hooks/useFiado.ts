import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface FiadoSaleItem {
  product_id: string | null;
  product_size_id: string | null;
  product_name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface CreateFiadoSaleData {
  customer_name: string;
  customer_phone?: string;
  customer_cpf?: string;
  items: FiadoSaleItem[];
  total: number;
  installments: number;
  notes?: string;
}

export interface FiadoPaymentData {
  fiado_sale_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
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
  status: 'pendente' | 'aprovado' | 'pago' | 'cancelado';
  approved_at: string | null;
  approved_by: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  fiado_sale_items?: FiadoSaleItemRow[];
  fiado_payments?: FiadoPaymentRow[];
}

export interface FiadoSaleItemRow {
  id: string;
  fiado_sale_id: string;
  product_id: string | null;
  product_size_id: string | null;
  product_name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface FiadoPaymentRow {
  id: string;
  fiado_sale_id: string;
  amount: number;
  payment_method: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
}

// Hook to fetch all fiado sales
export function useFiadoSales(status?: string) {
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

      if (status) {
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

// Hook to fetch a single fiado sale
export function useFiadoSale(id: string) {
  return useQuery({
    queryKey: ['fiado-sale', id],
    queryFn: async () => {
      const { data: sale, error } = await supabase
        .from('fiado_sales')
        .select(`
          *,
          fiado_sale_items(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch payments separately
      const { data: payments } = await supabase
        .from('fiado_payments')
        .select('*')
        .eq('fiado_sale_id', id)
        .order('created_at', { ascending: false });

      return {
        ...sale,
        fiado_payments: payments || [],
      } as FiadoSale;
    },
    enabled: !!id,
  });
}

// Hook to create a new fiado sale
export function useCreateFiadoSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateFiadoSaleData) => {
      // Create the fiado sale
      const { data: fiadoSale, error: saleError } = await supabase
        .from('fiado_sales')
        .insert({
          customer_name: data.customer_name,
          customer_phone: data.customer_phone || null,
          customer_cpf: data.customer_cpf || null,
          total: data.total,
          amount_paid: 0,
          amount_pending: data.total,
          installments: data.installments,
          notes: data.notes || null,
          user_id: user?.id || null,
          status: 'pendente',
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

      // Update stock for each item (deduct immediately)
      for (const item of data.items) {
        if (item.product_size_id) {
          // Get current quantity
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

// Hook to approve a fiado sale
export function useApproveFiadoSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (fiadoSaleId: string) => {
      // Get the fiado sale details
      const { data: fiadoSale, error: fetchError } = await supabase
        .from('fiado_sales')
        .select('*')
        .eq('id', fiadoSaleId)
        .single();

      if (fetchError) throw fetchError;

      // Update status to approved
      const { error: updateError } = await supabase
        .from('fiado_sales')
        .update({
          status: 'aprovado',
          approved_at: new Date().toISOString(),
          approved_by: user?.id || null,
        })
        .eq('id', fiadoSaleId);

      if (updateError) throw updateError;

      // Create receivables for each installment
      const installmentAmount = Number(fiadoSale.amount_pending) / fiadoSale.installments;
      const today = new Date();

      for (let i = 0; i < fiadoSale.installments; i++) {
        const dueDate = new Date(today);
        dueDate.setMonth(dueDate.getMonth() + i + 1); // First installment due next month

        await supabase
          .from('receivables')
          .insert({
            sale_id: null,
            description: `Fiado - ${fiadoSale.customer_name} (${i + 1}/${fiadoSale.installments})`,
            amount: installmentAmount,
            fee: 0,
            net_amount: installmentAmount,
            due_date: dueDate.toISOString().split('T')[0],
            is_received: false,
            notes: `Venda fiado ID: ${fiadoSaleId}`,
          });
      }

      return fiadoSale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiado-sales'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      toast.success('Venda fiado aprovada! Parcelas criadas no financeiro.');
    },
    onError: (error: any) => {
      console.error('Error approving fiado sale:', error);
      toast.error('Erro ao aprovar venda fiado');
    },
  });
}

// Hook to register a partial payment
export function useRegisterFiadoPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: FiadoPaymentData) => {
      // Get current fiado sale
      const { data: fiadoSale, error: fetchError } = await supabase
        .from('fiado_sales')
        .select('*')
        .eq('id', data.fiado_sale_id)
        .single();

      if (fetchError) throw fetchError;

      // Create payment record
      const { error: paymentError } = await supabase
        .from('fiado_payments')
        .insert({
          fiado_sale_id: data.fiado_sale_id,
          amount: data.amount,
          payment_method: data.payment_method,
          notes: data.notes || null,
          user_id: user?.id || null,
        });

      if (paymentError) throw paymentError;

      // Update amounts in fiado sale
      const newAmountPaid = Number(fiadoSale.amount_paid) + data.amount;
      const newAmountPending = Number(fiadoSale.total) - newAmountPaid;
      const newStatus = newAmountPending <= 0 ? 'pago' : fiadoSale.status;

      const { error: updateError } = await supabase
        .from('fiado_sales')
        .update({
          amount_paid: newAmountPaid,
          amount_pending: Math.max(0, newAmountPending),
          status: newStatus,
        })
        .eq('id', data.fiado_sale_id);

      if (updateError) throw updateError;

      // Create receivable entry for the payment received
      await supabase
        .from('receivables')
        .insert({
          sale_id: null,
          description: `Pagamento Fiado - ${fiadoSale.customer_name}`,
          amount: data.amount,
          fee: 0,
          net_amount: data.amount,
          due_date: new Date().toISOString().split('T')[0],
          is_received: true,
          received_date: new Date().toISOString().split('T')[0],
          notes: `Pagamento parcial - ${data.payment_method}`,
        });

      return { newAmountPaid, newAmountPending };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['fiado-sales'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      if (result.newAmountPending <= 0) {
        toast.success('Pagamento registrado! Venda fiado quitada.');
      } else {
        toast.success(`Pagamento registrado! Pendente: R$ ${result.newAmountPending.toFixed(2)}`);
      }
    },
    onError: (error: any) => {
      console.error('Error registering payment:', error);
      toast.error('Erro ao registrar pagamento');
    },
  });
}

// Hook to cancel a fiado sale
export function useCancelFiadoSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (fiadoSaleId: string) => {
      // Get the fiado sale with items
      const { data: fiadoSale, error: fetchError } = await supabase
        .from('fiado_sales')
        .select(`
          *,
          fiado_sale_items(*)
        `)
        .eq('id', fiadoSaleId)
        .single();

      if (fetchError) throw fetchError;

      // Return items to stock
      for (const item of fiadoSale.fiado_sale_items || []) {
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

            // Record stock movement (return)
            await supabase
              .from('stock_movements')
              .insert({
                product_id: item.product_id,
                product_size_id: item.product_size_id,
                type: 'entrada',
                quantity: item.quantity,
                notes: `Cancelamento Fiado - ${fiadoSale.customer_name}`,
                user_id: user?.id || null,
              });
          }
        }
      }

      // Update status to cancelled
      const { error: updateError } = await supabase
        .from('fiado_sales')
        .update({ status: 'cancelado' })
        .eq('id', fiadoSaleId);

      if (updateError) throw updateError;

      return fiadoSale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiado-sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast.success('Venda fiado cancelada e estoque devolvido.');
    },
    onError: (error: any) => {
      console.error('Error cancelling fiado sale:', error);
      toast.error('Erro ao cancelar venda fiado');
    },
  });
}
