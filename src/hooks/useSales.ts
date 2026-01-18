import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTodaySales() {
  return useQuery({
    queryKey: ['sales', 'today'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase.from('sales').select('final_total').gte('created_at', today.toISOString()).eq('status', 'concluida');
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
      const { data, error } = await supabase.from('sales').select('final_total').gte('created_at', startOfMonth.toISOString()).eq('status', 'concluida');
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
      const { data: sales, error } = await supabase.from('sales').select('final_total').gte('created_at', startOfMonth.toISOString()).eq('status', 'concluida');
      if (error) throw error;
      const totalRevenue = sales.reduce((acc, sale) => acc + Number(sale.final_total), 0);
      return { profit: totalRevenue * 0.3, totalRevenue };
    },
  });
}
