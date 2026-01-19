import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PurchaseSuggestion {
  id: string;
  product_id: string;
  supplier_id: string | null;
  suggested_quantity: number;
  current_stock: number;
  daily_demand: number;
  days_until_stockout: number | null;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'ordered' | 'ignored';
  estimated_cost: number;
  suggested_order_date: string | null;
  notes: string | null;
  created_at: string;
  products?: {
    id: string;
    name: string;
    cost_price: number;
    min_stock: number;
    supplier_id: string | null;
  };
  suppliers?: {
    id: string;
    name: string;
  };
}

export interface RestockSettings {
  id: string;
  product_id: string;
  lead_time_days: number;
  reorder_point: number;
  safety_stock_multiplier: number;
  economic_order_qty: number;
  abc_class: 'A' | 'B' | 'C';
  xyz_class: 'X' | 'Y' | 'Z';
  min_stock_override: number | null;
}

export function usePurchaseSuggestions(status?: string) {
  return useQuery({
    queryKey: ['purchase-suggestions', status],
    queryFn: async () => {
      let query = supabase
        .from('purchase_suggestions')
        .select(`
          *,
          products(id, name, cost_price, min_stock, supplier_id),
          suppliers(id, name)
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status as 'pending' | 'ordered' | 'ignored');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PurchaseSuggestion[];
    },
  });
}

export function useRestockSummary() {
  return useQuery({
    queryKey: ['restock-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_suggestions')
        .select('urgency, status, estimated_cost');

      if (error) throw error;

      const pending = data.filter(s => s.status === 'pending');
      const critical = pending.filter(s => s.urgency === 'critical').length;
      const high = pending.filter(s => s.urgency === 'high').length;
      const totalCost = pending.reduce((acc, s) => acc + Number(s.estimated_cost || 0), 0);

      return {
        pendingCount: pending.length,
        criticalCount: critical,
        highCount: high,
        totalEstimatedCost: totalCost,
      };
    },
  });
}

export function useGenerateSuggestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Get all active products with their stock
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          cost_price,
          min_stock,
          supplier_id,
          product_sizes(quantity)
        `)
        .eq('is_active', true);

      if (productsError) throw productsError;

      // Get sales data for last 30 days for demand calculation
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: salesData, error: salesError } = await supabase
        .from('sale_items')
        .select(`
          product_id,
          quantity,
          sales!inner(created_at, status)
        `)
        .eq('sales.status', 'concluida')
        .gte('sales.created_at', thirtyDaysAgo.toISOString());

      if (salesError) throw salesError;

      // Calculate daily demand per product
      const demandByProduct: Record<string, number> = {};
      salesData?.forEach(item => {
        if (!demandByProduct[item.product_id]) {
          demandByProduct[item.product_id] = 0;
        }
        demandByProduct[item.product_id] += item.quantity;
      });

      // Clear old pending suggestions
      await supabase
        .from('purchase_suggestions')
        .delete()
        .eq('status', 'pending');

      // Generate new suggestions
      const suggestions = [];

      for (const product of products || []) {
        const totalStock = product.product_sizes?.reduce(
          (acc: number, size: any) => acc + (size.quantity || 0),
          0
        ) || 0;

        const totalSold = demandByProduct[product.id] || 0;
        const dailyDemand = totalSold / 30;
        const daysUntilStockout = dailyDemand > 0 ? Math.floor(totalStock / dailyDemand) : 999;

        // Only suggest if below min_stock or will run out in 14 days
        if (totalStock <= product.min_stock || daysUntilStockout <= 14) {
          let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
          if (daysUntilStockout <= 3 || totalStock === 0) {
            urgency = 'critical';
          } else if (daysUntilStockout <= 7) {
            urgency = 'high';
          } else if (daysUntilStockout <= 14) {
            urgency = 'medium';
          }

          // Calculate suggested quantity (enough for 30 days + safety stock)
          const suggestedQty = Math.max(
            product.min_stock - totalStock,
            Math.ceil(dailyDemand * 30) - totalStock + product.min_stock
          );

          if (suggestedQty > 0) {
            suggestions.push({
              product_id: product.id,
              supplier_id: product.supplier_id,
              suggested_quantity: suggestedQty,
              current_stock: totalStock,
              daily_demand: dailyDemand,
              days_until_stockout: daysUntilStockout,
              urgency,
              status: 'pending',
              estimated_cost: suggestedQty * product.cost_price,
              suggested_order_date: new Date().toISOString().split('T')[0],
            });
          }
        }
      }

      if (suggestions.length > 0) {
        const { error: insertError } = await supabase
          .from('purchase_suggestions')
          .insert(suggestions);

        if (insertError) throw insertError;
      }

      return suggestions.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['restock-summary'] });
      toast.success(`${count} sugestões de reposição geradas`);
    },
    onError: (error: any) => {
      console.error('Error generating suggestions:', error);
      toast.error('Erro ao gerar sugestões');
    },
  });
}

export function useUpdateSuggestionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'ordered' | 'ignored' }) => {
      const { error } = await supabase
        .from('purchase_suggestions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['restock-summary'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}

export function useCreateStockEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      suggestion,
      quantity,
    }: {
      suggestion: PurchaseSuggestion;
      quantity: number;
    }) => {
      // Get the first product size to add stock to
      const { data: sizes, error: sizesError } = await supabase
        .from('product_sizes')
        .select('id, quantity')
        .eq('product_id', suggestion.product_id)
        .limit(1);

      if (sizesError) throw sizesError;

      if (sizes && sizes.length > 0) {
        const size = sizes[0];
        
        // Update stock
        await supabase
          .from('product_sizes')
          .update({ quantity: (size.quantity || 0) + quantity })
          .eq('id', size.id);

        // Register movement
        await supabase
          .from('stock_movements')
          .insert({
            product_id: suggestion.product_id,
            product_size_id: size.id,
            type: 'entrada',
            quantity,
            notes: 'Reposição de estoque',
          });
      }

      // Mark suggestion as ordered (completed)
      await supabase
        .from('purchase_suggestions')
        .delete()
        .eq('id', suggestion.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['restock-summary'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-products'] });
      toast.success('Entrada de estoque registrada');
    },
    onError: () => {
      toast.error('Erro ao registrar entrada');
    },
  });
}
