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
  is_recurring: boolean | null;
  recurrence_months: number | null;
  recurrence_index: number | null;
  parent_expense_id: string | null;
  interest_amount: number | null;
  amount_paid: number | null;
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
      const today = new Date().toISOString().split('T')[0];
      
      // First, update any pendente expenses that are now overdue
      await supabase
        .from('expenses')
        .update({ status: 'vencido' })
        .eq('status', 'pendente')
        .lt('due_date', today);

      // Then fetch expenses
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
    staleTime: 0,
    refetchInterval: 30000, // Refetch every 30 seconds
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
      is_recurring?: boolean;
      recurrence_months?: number;
    }) => {
      const expenses: any[] = [];
      const baseDate = new Date(data.due_date);

      // Create main expense
      const mainExpense = {
        description: data.description,
        amount: data.amount,
        category: data.category || null,
        due_date: data.due_date,
        supplier_id: data.supplier_id || null,
        notes: data.notes || null,
        user_id: user?.id || null,
        status: 'pendente' as const,
        is_recurring: data.is_recurring || false,
        recurrence_months: data.recurrence_months || null,
        recurrence_index: data.is_recurring ? 1 : null,
      };

      const { data: createdMain, error: mainError } = await supabase
        .from('expenses')
        .insert(mainExpense)
        .select()
        .single();

      if (mainError) throw mainError;

      // If recurring, create additional expenses for remaining months
      if (data.is_recurring && data.recurrence_months && data.recurrence_months > 1) {
        const recurringExpenses = [];
        const originalDay = baseDate.getDate();
        
        for (let i = 1; i < data.recurrence_months; i++) {
          // Calculate future date keeping the same day of month
          const futureDate = new Date(baseDate);
          futureDate.setMonth(futureDate.getMonth() + i);
          
          // Handle months with fewer days (e.g., Jan 31 -> Feb 28)
          // If the original day doesn't exist in target month, use last day of month
          const targetMonth = futureDate.getMonth();
          futureDate.setDate(originalDay);
          
          // If setting the date changed the month, we went past the end of month
          // So go back to the last day of the intended month
          if (futureDate.getMonth() !== targetMonth) {
            futureDate.setDate(0); // Goes to last day of previous month (which is our target)
          }
          
          recurringExpenses.push({
            description: `${data.description} (${i + 1}/${data.recurrence_months})`,
            amount: data.amount,
            category: data.category || null,
            due_date: futureDate.toISOString().split('T')[0],
            supplier_id: data.supplier_id || null,
            notes: data.notes || null,
            user_id: user?.id || null,
            status: 'pendente' as const,
            is_recurring: true,
            recurrence_months: data.recurrence_months,
            parent_expense_id: createdMain.id,
            recurrence_index: i + 1,
          });
        }

        if (recurringExpenses.length > 0) {
          const { error: recurringError } = await supabase
            .from('expenses')
            .insert(recurringExpenses);

          if (recurringError) throw recurringError;
        }

        // Update the first expense to show it's part of recurrence
        await supabase
          .from('expenses')
          .update({ description: `${data.description} (1/${data.recurrence_months})` })
          .eq('id', createdMain.id);
      }

      return createdMain;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-count'] });
      
      if (variables.is_recurring && variables.recurrence_months) {
        toast.success(`Despesa recorrente criada! ${variables.recurrence_months} parcelas cadastradas.`);
      } else {
        toast.success('Despesa cadastrada com sucesso!');
      }
    },
    onError: () => {
      toast.error('Erro ao cadastrar despesa');
    },
  });
}

export function useMarkExpenseAsPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; interest_amount?: number; amount_paid?: number }) => {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'pago',
          paid_date: new Date().toISOString().split('T')[0],
          interest_amount: data.interest_amount || 0,
          amount_paid: data.amount_paid || null,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-count'] });
      toast.success('Despesa marcada como paga!');
    },
    onError: () => {
      toast.error('Erro ao atualizar despesa');
    },
  });
}

export function useUpdateExpenseDueDate() {
  const queryClient = useQueryClient();

  return useMutation<
    any,
    unknown,
    { id: string; due_date: string },
    { previous: Array<[readonly unknown[], unknown]> }
  >({
    // Otimista: troca na tela imediatamente, depois confirma com o banco.
    onMutate: async ({ id, due_date }: { id: string; due_date: string }) => {
      await queryClient.cancelQueries({ queryKey: ['expenses'] });

      const today = new Date().toISOString().split('T')[0];
      const newStatus = due_date < today ? 'vencido' : 'pendente';

      const previous = queryClient.getQueriesData({
        queryKey: ['expenses'],
      }) as Array<[readonly unknown[], unknown]>;

      // Atualiza todas as variações de queryKey que começam com ['expenses', ...]
      previous.forEach(([key, data]) => {
        if (!Array.isArray(data)) return;
        queryClient.setQueryData(
          key,
          data.map((e: any) =>
            e?.id === id ? { ...e, due_date, status: newStatus } : e
          )
        );
      });

      return { previous };
    },
    mutationFn: async ({ id, due_date }: { id: string; due_date: string }) => {
      const today = new Date().toISOString().split('T')[0];
      const newStatus = due_date < today ? 'vencido' : 'pendente';
      
      const { data, error } = await supabase
        .from('expenses')
        .update({
          due_date,
          status: newStatus,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updated) => {
      // Confirma o valor retornado do banco em todas as caches abertas.
      const queries = queryClient.getQueriesData({ queryKey: ['expenses'] });
      queries.forEach(([key, data]) => {
        if (!Array.isArray(data)) return;
        queryClient.setQueryData(
          key,
          data.map((e: any) => (e?.id === updated?.id ? { ...e, ...updated } : e))
        );
      });

      queryClient.invalidateQueries({ queryKey: ['expenses'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['overdue-expenses'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['overdue-count'], refetchType: 'active' });

      toast.success('Data de vencimento atualizada!');
    },
    onError: (error, _vars, ctx) => {
      // Rollback do otimista
      if (ctx?.previous) {
        ctx.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }

      console.error('Error updating due date:', error);
      toast.error('Erro ao atualizar vencimento');
    },
  });
}

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update({ category })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Categoria atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar categoria');
    },
  });
}

export function useUpdateExpenseDescription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update({ description })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Descrição atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar descrição');
    },
  });
}

export function useCanDeleteRecurringExpense() {
  return async (expense: Expense): Promise<{ canDelete: boolean; reason?: string }> => {
    // Non-recurring expenses can always be deleted
    if (!expense.is_recurring) {
      return { canDelete: true };
    }

    // Check if this expense is already paid
    if (expense.status === 'pago') {
      return { canDelete: false, reason: 'Esta parcela já foi paga e não pode ser excluída.' };
    }

    // For recurring expenses, check if any installment is paid
    // Get all related expenses (same parent or same id as parent)
    const parentId = expense.parent_expense_id || expense.id;
    
    const { data: relatedExpenses, error } = await supabase
      .from('expenses')
      .select('id, status')
      .or(`id.eq.${parentId},parent_expense_id.eq.${parentId}`);

    if (error) {
      console.error('Error checking related expenses:', error);
      return { canDelete: false, reason: 'Erro ao verificar parcelas relacionadas.' };
    }

    const hasPaidInstallment = relatedExpenses?.some(e => e.status === 'pago');
    
    if (hasPaidInstallment) {
      return { 
        canDelete: false, 
        reason: 'Não é possível excluir: existe pelo menos uma parcela paga neste lançamento recorrente.' 
      };
    }

    return { canDelete: true };
  };
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-count'] });
      toast.success('Despesa excluída!');
    },
    onError: () => {
      toast.error('Erro ao excluir despesa');
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
      // Period-filtered receivables (for Entrada de Vendas and Taxas)
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

      // All-time receivables for Valor do Caixa (independent of period)
      const { data: allReceivables, error: allRecError } = await supabase
        .from('receivables')
        .select('net_amount, description');
      if (allRecError) throw allRecError;

      // All-time paid expenses to subtract from Valor do Caixa
      const { data: allPaidExpenses, error: paidExpErr } = await supabase
        .from('expenses')
        .select('amount')
        .eq('status', 'pago');
      if (paidExpErr) throw paidExpErr;

      // Separate manual cash entries from sales receivables
      const manualEntries = (allReceivables || []).filter(r => 
        r.description?.includes('[Empréstimo]') || r.description?.includes('[Entrada Manual]')
      );
      const salesReceivables = (allReceivables || []).filter(r => 
        !r.description?.includes('[Empréstimo]') && !r.description?.includes('[Entrada Manual]')
      );
      const totalManualCash = manualEntries.reduce((acc, r) => acc + Number(r.net_amount), 0);
      const totalSalesNet = salesReceivables.reduce((acc, r) => acc + Number(r.net_amount), 0);

      // Current month expenses (based on filter period)
      const periodStart = filters?.startDate ? filters.startDate.toISOString().split('T')[0] : null;
      const periodEnd = filters?.endDate ? filters.endDate.toISOString().split('T')[0] : null;

      let monthExpensesQuery = supabase
        .from('expenses')
        .select('amount, status, due_date')
        .neq('status', 'pago');

      if (periodStart) {
        monthExpensesQuery = monthExpensesQuery.gte('due_date', periodStart);
      }
      if (periodEnd) {
        monthExpensesQuery = monthExpensesQuery.lte('due_date', periodEnd);
      }

      const { data: monthExpenses, error: monthExpErr } = await monthExpensesQuery;
      if (monthExpErr) throw monthExpErr;

      // Overdue expenses from BEFORE the period start (vencido status)
      let overdueQuery = supabase
        .from('expenses')
        .select('amount, status, due_date')
        .eq('status', 'vencido');

      if (periodStart) {
        overdueQuery = overdueQuery.lt('due_date', periodStart);
      }

      const { data: overdueExpenses, error: overdueErr } = await overdueQuery;
      if (overdueErr) throw overdueErr;

      const totalGrossReceivable = (receivables || []).reduce((acc, r) => acc + Number(r.amount), 0);
      const totalFees = (receivables || []).reduce((acc, r) => acc + Number(r.fee || 0), 0);
      const totalAllReceivables = (allReceivables || []).reduce((acc, r) => acc + Number(r.net_amount), 0);
      const totalPaidExpenses = (allPaidExpenses || []).reduce((acc, e) => acc + Number(e.amount), 0);
      const totalCaixa = totalAllReceivables - totalPaidExpenses;
      const totalMonthPayable = (monthExpenses || []).reduce((acc, e) => acc + Number(e.amount), 0);
      const totalOverdue = (overdueExpenses || []).reduce((acc, e) => acc + Number(e.amount), 0);
      const totalPayable = totalMonthPayable + totalOverdue;

      return {
        totalGrossReceivable,
        totalFees,
        totalReceivable: totalCaixa,
        totalPayable,
        totalMonthPayable,
        totalOverdue,
        balance: totalGrossReceivable - totalFees - totalPayable,
        receivablesCount: receivables?.length || 0,
        expensesCount: (monthExpenses?.length || 0) + (overdueExpenses?.length || 0),
        totalManualCash,
        totalSalesNet,
        totalPaidExpenses,
        manualEntriesCount: manualEntries.length,
      };
    },
    staleTime: 0,
    refetchInterval: 3000,
  });
}
