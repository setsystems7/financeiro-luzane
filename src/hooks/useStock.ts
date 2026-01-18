import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface StockMovement {
  id: string;
  product_id: string;
  product_size_id: string | null;
  type: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  notes: string | null;
  created_at: string;
  product_name?: string;
  size?: string;
}

export function useStockMovements(limit: number = 50) {
  return useQuery({
    queryKey: ['stock-movements', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products(name),
          product_sizes(size)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data.map((movement: any) => ({
        id: movement.id,
        product_id: movement.product_id,
        product_size_id: movement.product_size_id,
        type: movement.type,
        quantity: movement.quantity,
        notes: movement.notes,
        created_at: movement.created_at,
        product_name: movement.products?.name || 'Produto desconhecido',
        size: movement.product_sizes?.size || null,
      })) as StockMovement[];
    },
  });
}

export function useLowStockProducts() {
  return useQuery({
    queryKey: ['low-stock-products'],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          min_stock,
          product_sizes(quantity)
        `)
        .eq('is_active', true);

      if (error) throw error;

      const lowStockProducts = products
        .map((product: any) => {
          const totalStock = product.product_sizes?.reduce(
            (acc: number, size: any) => acc + (size.quantity || 0),
            0
          ) || 0;
          return {
            id: product.id,
            name: product.name,
            totalStock,
            minStock: product.min_stock,
            isLow: totalStock <= product.min_stock,
          };
        })
        .filter((p: any) => p.isLow);

      return lowStockProducts;
    },
  });
}

export function useAddStock() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      product_id,
      product_size_id,
      quantity,
      notes,
    }: {
      product_id: string;
      product_size_id: string;
      quantity: number;
      notes?: string;
    }) => {
      const { data: sizeData, error: sizeError } = await supabase
        .from('product_sizes')
        .select('quantity')
        .eq('id', product_size_id)
        .single();

      if (sizeError) throw sizeError;

      const newQuantity = (sizeData.quantity || 0) + quantity;

      const { error: updateError } = await supabase
        .from('product_sizes')
        .update({ quantity: newQuantity })
        .eq('id', product_size_id);

      if (updateError) throw updateError;

      const { data: movement, error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id,
          product_size_id,
          type: 'entrada',
          quantity,
          notes: notes || 'Entrada manual',
          user_id: user?.id || null,
        })
        .select()
        .single();

      if (movementError) throw movementError;

      return movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
      toast.success('Entrada registrada');
    },
    onError: (error: any) => {
      console.error('Error adding stock:', error);
      toast.error('Não foi possível registrar a entrada. Tente novamente.');
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      product_id,
      product_size_id,
      new_quantity,
      notes,
    }: {
      product_id: string;
      product_size_id: string;
      new_quantity: number;
      notes?: string;
    }) => {
      const { data: sizeData, error: sizeError } = await supabase
        .from('product_sizes')
        .select('quantity')
        .eq('id', product_size_id)
        .single();

      if (sizeError) throw sizeError;

      const difference = new_quantity - (sizeData.quantity || 0);

      const { error: updateError } = await supabase
        .from('product_sizes')
        .update({ quantity: new_quantity })
        .eq('id', product_size_id);

      if (updateError) throw updateError;

      const { data: movement, error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id,
          product_size_id,
          type: 'ajuste',
          quantity: Math.abs(difference),
          notes: notes || `Ajuste de estoque (${difference >= 0 ? '+' : ''}${difference})`,
          user_id: user?.id || null,
        })
        .select()
        .single();

      if (movementError) throw movementError;

      return movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
      toast.success('Estoque ajustado');
    },
    onError: (error: any) => {
      console.error('Error adjusting stock:', error);
      toast.error('Não foi possível ajustar o estoque. Tente novamente.');
    },
  });
}
