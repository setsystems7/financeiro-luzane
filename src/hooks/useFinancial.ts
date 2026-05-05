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

const SUMMARY_BATCH_SIZE = 1000;

const isManualReceivable = (description?: string | null) =>
  Boolean(
    description?.includes('[Empréstimo]') ||
    description?.includes('[Entrada Manual]')
  );

const isEffectivelyReceived = (receivable: { is_received?: boolean | null; received_date?: string | null }) =>
  Boolean(receivable.received_date || receivable.is_received);

// FIX 12: renamed from totalReceivable to totalCaixa throughout summary
// FIX 7 helpers: correctly determine if an expense is truly fully paid

/** Expense is fully settled only when amount_paid >= amount (or old data with null amount_paid) */
const isTrulyPaid = (expense: {
  status?: string | null;
  amount?: number | null;
  amount_paid?: number | null;
}) => {
  if (expense.status !== 'pago') return false;
  if (expense.amount_paid === null || expense.amount_paid === undefined) return true; // legacy data
  return Number(expense.amount_paid) >= Number(expense.amount || 0);
};

/** How much has actually left the caixa for this expense */
const getExpenseActualPayment = (expense: {
  status?: string | null;
  amount?: number | null;
  amount_paid?: number | null;
}) => {
  if (expense.amount_paid !== null && expense.amount_paid !== undefined && Number(expense.amount_paid) > 0) {
    return Number(expense.amount_paid);
  }
  if (expense.status === 'pago') return Number(expense.amount || 0);
  return 0;
};

/** How much is still owed on this expense */
const getRemainingBalance = (expense: {
  status?: string | null;
  amount?: number | null;
  amount_paid?: number | null;
}) => {
  if (isTrulyPaid(expense)) return 0;
  return Math.max(0, Number(expense.amount || 0) - Number(expense.amount_paid || 0));
};

const getReceivableNetValue = (receivable: { net_amount?: number | null; amount?: number | null }) =>
  Number(receivable.net_amount ?? receivable.amount ?? 0);

async function fetchAllRows<T>(
  table: 'receivables' | 'expenses',
  select: string,
  buildQuery?: (query: any) => any,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += SUMMARY_BATCH_SIZE) {
    let query = supabase
      .from(table)
      .select(select)
      .range(from, from + SUMMARY_BATCH_SIZE - 1);

    if (buildQuery) {
      query = buildQuery(query);
    }

    const { data, error } = await query;

    if (error) throw error;

    const batch = (data || []) as T[];
    rows.push(...batch);

    if (batch.length < SUMMARY_BATCH_SIZE) {
      break;
    }
  }

  return rows;
}

export function useFinancialRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const receivablesChannel = supabase
      .channel('financial-receivables-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receivables' },
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
        { event: '*', schema: 'public', table: 'expenses' },
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

// FIX 3: Separate mutation for marking overdue — never inside a queryFn
export function useMarkOverdueExpenses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('expenses')
        .update({ status: 'vencido' })
        .eq('status', 'pendente')
        .lt('due_date', today);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-count'] });
    },
  });
}

export function useReceivables(filters?: {
  status?: 'all' | 'pending' | 'received';
  startDate?: Date;
  endDate?: Date;
  // FIX 13: allow caller to skip DB date filter and apply in JS instead (sale_date mode)
  skipDateFilter?: boolean;
}) {
  return useQuery({
    queryKey: ['receivables', filters],
    queryFn: async () => {
      let query = supabase
        .from('receivables')
        .select('*, sales(id, sale_number, created_at, total, discount, final_total, net_amount, card_brand, installments, card_fee_percent, card_fee_amount, payment_method, sale_items(id, product_name, size, quantity, unit_price, total))')
        .order('created_at', { ascending: false });

      // FIX 5: filter covers both is_received and received_date
      if (filters?.status === 'pending') {
        query = query.is('received_date', null).or('is_received.eq.false,is_received.is.null');
      } else if (filters?.status === 'received') {
        query = query.or('is_received.eq.true,received_date.not.is.null');
      }

      // FIX 13: only apply DB date filter in due_date mode
      if (!filters?.skipDateFilter) {
        if (filters?.startDate) {
          query = query.gte('due_date', filters.startDate.toISOString().split('T')[0]);
        }
        if (filters?.endDate) {
          query = query.lte('due_date', filters.endDate.toISOString().split('T')[0]);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Receivable[];
    },
    staleTime: 0,
    // FIX 8: realtime channel handles updates — no polling needed
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
      // FIX 3: UPDATE removed from queryFn — use useMarkOverdueExpenses mutation instead

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

      // Also fetch overdue expenses from before the period so they always appear until settled
      let overdueFromPast: Expense[] = [];
      if (filters?.startDate && (filters?.status === 'all' || filters?.status === 'vencido' || !filters?.status)) {
        const { data: overdueData, error: overdueErr } = await supabase
          .from('expenses')
          .select('*, suppliers(name)')
          .eq('status', 'vencido')
          .lt('due_date', filters.startDate.toISOString().split('T')[0])
          .order('due_date', { ascending: true });
        if (overdueErr) throw overdueErr;
        overdueFromPast = (overdueData || []) as Expense[];
      }

      // FIX 1 (display): fetch partially-paid expenses from before the period so they
      // continue to appear until fully settled — including historical "pago but partial" cases
      let partialFromPast: Expense[] = [];
      if (filters?.startDate && (filters?.status === 'all' || !filters?.status)) {
        const { data: partialData, error: partialErr } = await supabase
          .from('expenses')
          .select('*, suppliers(name)')
          .not('amount_paid', 'is', null)
          .gt('amount_paid', 0)
          .lt('due_date', filters.startDate.toISOString().split('T')[0])
          .order('due_date', { ascending: true });
        if (partialErr) throw partialErr;
        // JS filter: only show expenses that still have a remaining balance
        // This correctly handles historical data where status='pago' but amount_paid < amount
        partialFromPast = ((partialData || []) as Expense[]).filter(e => getRemainingBalance(e) > 0);
      }

      const periodIds = new Set((data || []).map((e: Expense) => e.id));
      const uniqueOverdue = overdueFromPast.filter(e => !periodIds.has(e.id));
      const uniquePartial = partialFromPast.filter(
        e => !periodIds.has(e.id) && !uniqueOverdue.find(o => o.id === e.id)
      );

      return [...uniqueOverdue, ...uniquePartial, ...(data || [])] as Expense[];
    },
    staleTime: 0,
    // FIX 8: realtime channel handles updates — no polling
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
      const baseDate = new Date(data.due_date);

      // FIX 9: include (1/N) suffix directly in INSERT — no separate UPDATE needed
      const firstDescription = data.is_recurring && data.recurrence_months
        ? `${data.description} (1/${data.recurrence_months})`
        : data.description;

      const mainExpense = {
        description: firstDescription,
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

      if (data.is_recurring && data.recurrence_months && data.recurrence_months > 1) {
        const recurringExpenses = [];
        const originalDay = baseDate.getDate();

        for (let i = 1; i < data.recurrence_months; i++) {
          const futureDate = new Date(baseDate);
          futureDate.setMonth(futureDate.getMonth() + i);

          const targetMonth = futureDate.getMonth();
          futureDate.setDate(originalDay);

          if (futureDate.getMonth() !== targetMonth) {
            futureDate.setDate(0);
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

export interface ExpensePayment {
  id: string;
  expense_id: string;
  amount: number;
  interest_amount: number;
  paid_date: string;
  notes: string | null;
  created_at: string;
}

export function useExpensePayments(expenseId: string | null) {
  return useQuery({
    queryKey: ['expense-payments', expenseId],
    queryFn: async () => {
      if (!expenseId) return [];
      const { data, error } = await (supabase as any)
        .from('expense_payments')
        .select('*')
        .eq('expense_id', expenseId)
        .order('paid_date', { ascending: false });
      if (error) throw error;
      return (data || []) as ExpensePayment[];
    },
    enabled: !!expenseId,
  });
}

// FIX 1: useMarkExpenseAsPaid now handles partial payments correctly
export function useMarkExpenseAsPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      interest_amount?: number;
      amount_paid?: number;         // amount being paid NOW (not accumulated)
      current_amount_paid?: number; // amount already paid before this payment
      expense_amount?: number;      // original expense amount to decide if fully paid
    }) => {
      const nowPaying = data.amount_paid || 0;
      const newTotal = (data.current_amount_paid || 0) + nowPaying;
      const isFullPayment = newTotal >= (data.expense_amount || 0);
      const today = new Date().toISOString().split('T')[0];

      const updateData: Record<string, unknown> = {
        amount_paid: newTotal,
        interest_amount: (data.current_amount_paid ? 0 : 0) + (data.interest_amount || 0),
      };

      if (isFullPayment) {
        updateData.status = 'pago';
        updateData.paid_date = today;
      }

      const { error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', data.id);

      if (error) throw error;

      // Record in payment history
      const { error: histErr } = await (supabase as any)
        .from('expense_payments')
        .insert({
          expense_id: data.id,
          amount: nowPaying,
          interest_amount: data.interest_amount || 0,
          paid_date: today,
        });
      // Silently ignore if table doesn't exist yet (before migration is run)
      if (histErr && !histErr.message?.includes('does not exist')) throw histErr;

      return { isFullPayment };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-count'] });
      queryClient.invalidateQueries({ queryKey: ['expense-payments', variables.id] });
      toast.success(result.isFullPayment ? 'Despesa paga integralmente!' : 'Pagamento parcial registrado!');
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
    onMutate: async ({ id, due_date }: { id: string; due_date: string }) => {
      await queryClient.cancelQueries({ queryKey: ['expenses'] });

      const today = new Date().toISOString().split('T')[0];
      const newStatus = due_date < today ? 'vencido' : 'pendente';

      const previous = queryClient.getQueriesData({
        queryKey: ['expenses'],
      }) as Array<[readonly unknown[], unknown]>;

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
        .update({ due_date, status: newStatus })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (updated) => {
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
    if (!expense.is_recurring) {
      return { canDelete: true };
    }

    if (expense.status === 'pago') {
      return { canDelete: false, reason: 'Esta parcela já foi paga e não pode ser excluída.' };
    }

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
        reason: 'Não é possível excluir: existe pelo menos uma parcela paga neste lançamento recorrente.',
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

export function useDeleteReceivable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('receivables')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Entrada removida com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao remover entrada');
    },
  });
}

export function useUpdateReceivable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { amount?: number; net_amount?: number; description?: string; notes?: string } }) => {
      const { error } = await supabase
        .from('receivables')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Entrada atualizada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao atualizar entrada');
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
      const periodStart = filters?.startDate ? filters.startDate.toISOString().split('T')[0] : null;
      const periodEnd = filters?.endDate ? filters.endDate.toISOString().split('T')[0] : null;

      const receivables = await fetchAllRows<{
        amount: number | null;
        fee: number | null;
        net_amount: number | null;
        is_received: boolean | null;
        received_date: string | null;
        due_date: string;
        description: string | null;
      }>('receivables', 'amount, fee, net_amount, is_received, received_date, due_date, description', (query) => {
        let nextQuery = query;
        if (periodStart) nextQuery = nextQuery.gte('due_date', periodStart);
        if (periodEnd) nextQuery = nextQuery.lte('due_date', periodEnd);
        return nextQuery.order('due_date', { ascending: true });
      });

      const filteredPeriodReceivables = receivables.filter((receivable) => {
        if (filters?.receivableStatus === 'received') return isEffectivelyReceived(receivable);
        if (filters?.receivableStatus === 'pending') return !isEffectivelyReceived(receivable);
        return true;
      });

      const periodSalesReceivables = filteredPeriodReceivables.filter(
        (receivable) => !isManualReceivable(receivable.description)
      );
      const periodManualReceivables = filteredPeriodReceivables.filter(
        (receivable) => isManualReceivable(receivable.description)
      );

      // All-time receivables for Valor do Caixa
      const allReceivables = await fetchAllRows<{
        amount: number | null;
        net_amount: number | null;
        description: string | null;
        is_received: boolean | null;
        received_date: string | null;
      }>('receivables', 'amount, net_amount, description, is_received, received_date');

      // All-time expenses for caixa calculations
      const allExpenses = await fetchAllRows<{
        amount: number | null;
        amount_paid: number | null;
        status: 'pendente' | 'pago' | 'vencido' | null;
        paid_date: string | null;
        due_date: string;
      }>('expenses', 'amount, amount_paid, status, paid_date, due_date');

      // FIX 7: totalCaixa deducts what was ACTUALLY paid (including partial payments)
      const totalAllReceivables = allReceivables.reduce(
        (acc, receivable) => acc + getReceivableNetValue(receivable),
        0
      );
      const totalPaidExpenses = allExpenses.reduce(
        (acc, expense) => acc + getExpenseActualPayment(expense),
        0
      );
      const totalCaixa = totalAllReceivables - totalPaidExpenses;

      // FIX 7: use getRemainingBalance so partial payments reduce "Contas a Pagar"
      const monthExpenses = allExpenses.filter((expense) => {
        if (getRemainingBalance(expense) <= 0) return false;
        if (periodStart && expense.due_date < periodStart) return false;
        if (periodEnd && expense.due_date > periodEnd) return false;
        return true;
      });

      const overdueExpenses = allExpenses.filter((expense) => {
        if (getRemainingBalance(expense) <= 0) return false;
        if (!periodStart) return expense.status === 'vencido';
        return expense.due_date < periodStart;
      });

      const allPaidExpenses = allExpenses.filter(e => e.status === 'pago');
      const paidInPeriod = allPaidExpenses.filter((expense) => {
        if (!expense.paid_date) return false;
        if (periodStart && expense.paid_date < periodStart) return false;
        if (periodEnd && expense.paid_date > periodEnd) return false;
        return true;
      });

      const totalGrossReceivable = periodSalesReceivables.reduce(
        (acc, receivable) => acc + Number(receivable.amount ?? 0),
        0
      );
      const totalPeriodManualCash = periodManualReceivables.reduce(
        (acc, receivable) => acc + getReceivableNetValue(receivable),
        0
      );
      const totalFees = periodSalesReceivables.reduce(
        (acc, receivable) => acc + Number(receivable.fee ?? 0),
        0
      );
      const totalMonthPayable = monthExpenses.reduce((acc, e) => acc + getRemainingBalance(e), 0);
      const totalOverdue = overdueExpenses.reduce((acc, e) => acc + getRemainingBalance(e), 0);
      const totalPayable = totalMonthPayable + totalOverdue;
      const totalPaidInPeriod = paidInPeriod.reduce(
        (acc, expense) => acc + getExpenseActualPayment(expense),
        0
      );
      const totalPeriodEntries = totalGrossReceivable + totalPeriodManualCash;

      const manualEntries = allReceivables.filter((r) => isManualReceivable(r.description));
      const salesReceivables = allReceivables.filter((r) => !isManualReceivable(r.description));
      const totalManualCash = manualEntries.reduce((acc, r) => acc + getReceivableNetValue(r), 0);
      const totalSalesNet = salesReceivables.reduce((acc, r) => acc + getReceivableNetValue(r), 0);

      return {
        totalGrossReceivable,
        totalFees,
        // FIX 12: renamed from totalReceivable to totalCaixa
        totalCaixa,
        totalPayable,
        totalMonthPayable,
        totalOverdue,
        balance: totalCaixa - totalPayable,
        receivablesCount: periodSalesReceivables.length,
        expensesCount: (monthExpenses?.length || 0) + (overdueExpenses?.length || 0),
        totalPeriodEntries,
        totalPeriodManualCash,
        periodManualEntriesCount: periodManualReceivables.length,
        totalManualCash,
        totalSalesNet,
        totalPaidExpenses,
        totalPaidInPeriod,
        manualEntriesCount: manualEntries.length,
      };
    },
    staleTime: 0,
    // FIX 8: realtime channel handles updates — no polling
  });
}
