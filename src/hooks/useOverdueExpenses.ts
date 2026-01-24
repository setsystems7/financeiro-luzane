import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface OverdueExpense {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  due_date: string;
  days_overdue: number;
}

export function useOverdueExpenses() {
  const queryClient = useQueryClient();

  // Update overdue expenses on first load
  useEffect(() => {
    const updateOverdueStatus = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      await supabase
        .from('expenses')
        .update({ status: 'vencido' })
        .eq('status', 'pendente')
        .lt('due_date', today);
    };

    updateOverdueStatus();
  }, []);

  return useQuery({
    queryKey: ['overdue-expenses'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // First, update any pendente that are now vencido
      await supabase
        .from('expenses')
        .update({ status: 'vencido' })
        .eq('status', 'pendente')
        .lt('due_date', today);

      // Then fetch all vencido
      const { data, error } = await supabase
        .from('expenses')
        .select('id, description, amount, category, due_date')
        .eq('status', 'vencido')
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Calculate days overdue
      const todayDate = new Date();
      return (data || []).map(expense => ({
        ...expense,
        days_overdue: Math.floor(
          (todayDate.getTime() - new Date(expense.due_date).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })) as OverdueExpense[];
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
  });
}

export function useOverdueCount() {
  return useQuery({
    queryKey: ['overdue-count'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { count, error } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'vencido');

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}
