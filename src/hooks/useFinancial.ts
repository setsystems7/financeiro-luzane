import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface SaleItem {
  id: string;
  product_name: string;
  size: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Receivable {
  id: string;
  sale_id: string | null;
  description: string;
  amount: number;
  fee: number | null;
  net_amount: number;
  due_date: string;
  is_received: boolean | null;
  received_date: string | null;
  notes: string | null;
  created_at: string;
  sales?: {
    id?: string;
    sale_number: number | null;
    created_at: string | null;
    total: number | null;
    discount: number | null;
    final_total: number | null;
    net_amount: number | null;
    card_brand: string | null;
    installments: number | null;
    card_fee_percent: number | null;
    card_fee_amount: number | null;
    payment_method: string | null;
    sale_items?: SaleItem[];
  } | null;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string | null;
  due_date: string;
  status: 'pendente' | 'pago' | 'vencido';
  paid_date: string | null;
  supplier_id: string | null;
  notes: string | null;
  created_at: string;
  suppliers?: { name: string } | null;
}

export function useFinancialRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const receivablesChannel = supabase
      .channel('financial-receivables-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'receivables'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['receivables'] });
          queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
        }
      )
      .subscribe();

    const expensesChannel = supabase
      .channel('financial-expenses-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['expenses'] });
          queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(receivablesChannel);
      supabase.removeChannel(expensesChannel);
    };
  }, [queryClient]);
}

export function useReceivables(filters?: {
  status?: 'all' | 'pending' | 'received';
  startDate?: Date;
  endDate?: Date;
}) {
  return useQuery({
    queryKey: ['receivables', filters],
    queryFn: async () => {
      let query = supabase
        .from('receivables')
        .select('*, sales(id, sale_number, created_at, total, discount, final_total, net_amount, card_brand, installments, card_fee_percent, card_fee_amount, payment_method, sale_items(id, product_name, size, quantity, unit_price, total))')
        .order('created_at', { ascending: false });

      if (filters?.status === 'pending') {
        query = query.eq('is_received', false);
      } else if (filters?.status === 'received') {
        query = query.eq('is_received', true);
      }

      if (filters?.startDate) {
        query = query.gte('due_date', filters.startDate.toISOString().split('T')[0]);
      }

      if (filters?.endDate) {
        query = query.lte('due_date', filters.endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Receivable[];
    },
    staleTime: 0,
    refetchInterval: 3000,
  });
}

export function useExpenses(filters?: {
  status?: 'all' | 'pendente' | 'pago' | 'vencido';
  startDate?: Date;
  endDate?: Date;
}) {
  return useQuery({
    queryKey: ['expenses', filters],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('*, suppliers(name)')
        .order('due_date', { ascending: true });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.startDate) {
        query = query.gte('due_date', filters.startDate.toISOString().split('T')[0]);
      }

      if (filters?.endDate) {
        query = query.lte('due_date', filters.endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      description: string;
      amount: number;
      category?: string;
      due_date: string;
      supplier_id?: string;
      notes?: string;
    }) => {
      const { data: expense, error } = await supabase
        .from('expenses')
        .insert({
          ...data,
          user_id: user?.id || null,
          status: 'pendente',
        })
        .select()
        .single();

      if (error) throw error;
      return expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Despesa cadastrada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao cadastrar despesa');
    },
  });
}

export function useMarkExpenseAsPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'pago',
          paid_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Despesa marcada como paga!');
    },
    onError: () => {
      toast.error('Erro ao atualizar despesa');
    },
  });
}

export function useMarkReceivableAsReceived() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('receivables')
        .update({
          is_received: true,
          received_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Recebimento confirmado!');
    },
    onError: () => {
      toast.error('Erro ao confirmar recebimento');
    },
  });
}

export function useFinancialSummary(filters?: {
  receivableStatus?: 'all' | 'pending' | 'received';
  expenseStatus?: 'all' | 'pendente' | 'pago' | 'vencido';
  startDate?: Date;
  endDate?: Date;
}) {
  return useQuery({
    queryKey: ['financial-summary', filters],
    queryFn: async () => {
      let receivablesQuery = supabase
        .from('receivables')
        .select('amount, fee, net_amount, is_received, due_date');

      if (filters?.receivableStatus === 'pending') {
        receivablesQuery = receivablesQuery.eq('is_received', false);
      } else if (filters?.receivableStatus === 'received') {
        receivablesQuery = receivablesQuery.eq('is_received', true);
      }

      if (filters?.startDate) {
        receivablesQuery = receivablesQuery.gte('due_date', filters.startDate.toISOString().split('T')[0]);
      }
      if (filters?.endDate) {
        receivablesQuery = receivablesQuery.lte('due_date', filters.endDate.toISOString().split('T')[0]);
      }

      const { data: receivables, error: recError } = await receivablesQuery;
      if (recError) throw recError;

      let expensesQuery = supabase
        .from('expenses')
        .select('amount, status, due_date');

      if (filters?.expenseStatus && filters.expenseStatus !== 'all') {
        expensesQuery = expensesQuery.eq('status', filters.expenseStatus);
      }

      if (filters?.startDate) {
        expensesQuery = expensesQuery.gte('due_date', filters.startDate.toISOString().split('T')[0]);
      }
      if (filters?.endDate) {
        expensesQuery = expensesQuery.lte('due_date', filters.endDate.toISOString().split('T')[0]);
      }

      const { data: expenses, error: expError } = await expensesQuery;
      if (expError) throw expError;

      const totalGrossReceivable = (receivables || []).reduce((acc, r) => acc + Number(r.amount), 0);
      const totalFees = (receivables || []).reduce((acc, r) => acc + Number(r.fee || 0), 0);
      const totalReceivable = (receivables || []).reduce((acc, r) => acc + Number(r.net_amount), 0);
      const totalPayable = (expenses || []).reduce((acc, e) => acc + Number(e.amount), 0);

      return {
        totalGrossReceivable,
        totalFees,
        totalReceivable,
        totalPayable,
        balance: totalReceivable - totalPayable,
        receivablesCount: receivables?.length || 0,
        expensesCount: expenses?.length || 0,
      };
    },
    staleTime: 0,
    refetchInterval: 3000,
  });
}
