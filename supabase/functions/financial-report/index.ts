import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: claimsData, error: claimsError } = await anonClient.auth.getUser()
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: expenses, error: expError } = await adminClient
      .from('expenses')
      .select('id, description, amount, category, due_date, status, paid_date, interest_amount, amount_paid, is_recurring, recurrence_index, supplier_id')
      .order('due_date', { ascending: true })
    if (expError) throw expError

    const { data: receivables, error: recError } = await adminClient
      .from('receivables')
      .select('id, description, amount, net_amount, fee, due_date, is_received, received_date, sale_id')
      .order('due_date', { ascending: true })
    if (recError) throw recError

    const allReceivables = receivables || []
    const allExpenses = expenses || []
    
    const totalAllReceivablesAmount = allReceivables.reduce((s, r) => s + Number(r.amount || 0), 0)
    const totalAllReceivablesNet = allReceivables.reduce((s, r) => s + Number(r.net_amount || 0), 0)
    
    const paidExpenses = allExpenses.filter(e => e.status === 'pago')
    const overdueExpenses = allExpenses.filter(e => e.status === 'vencido')
    const pendingExpenses = allExpenses.filter(e => e.status === 'pendente')

    const totalPaidExpensesAmount = paidExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalPaidWithInterest = paidExpenses.reduce((s, e) => s + Number(e.amount_paid || e.amount || 0), 0)
    const totalOverdueAmount = overdueExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalPendingAmount = pendingExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)

    const manualEntries = allReceivables.filter(r => 
      r.description?.includes('[Empréstimo]') || r.description?.includes('[Entrada Manual]')
    )
    const salesReceivables = allReceivables.filter(r => 
      !r.description?.includes('[Empréstimo]') && !r.description?.includes('[Entrada Manual]')
    )

    const totalFees = allReceivables.reduce((s, r) => s + Number(r.fee || 0), 0)

    const caixaUsingAmount = totalAllReceivablesAmount - totalPaidExpensesAmount
    const caixaUsingNet = totalAllReceivablesNet - totalPaidExpensesAmount

    const report = {
      generated_at: new Date().toISOString(),
      kpi_comparison: {
        'Valor do Caixa (amount bruto)': caixaUsingAmount,
        'Valor do Caixa (net_amount)': caixaUsingNet,
        'Diferença (amount - net)': caixaUsingAmount - caixaUsingNet,
        'Total Taxas': totalFees,
      },
      receivables_totals: {
        count: allReceivables.length,
        total_amount_bruto: totalAllReceivablesAmount,
        total_net_amount: totalAllReceivablesNet,
        manual_entries_count: manualEntries.length,
        manual_entries_amount: manualEntries.reduce((s, r) => s + Number(r.amount || 0), 0),
        sales_count: salesReceivables.length,
        sales_amount: salesReceivables.reduce((s, r) => s + Number(r.amount || 0), 0),
      },
      expenses_totals: {
        paid: { count: paidExpenses.length, total_amount: totalPaidExpensesAmount, total_paid_with_interest: totalPaidWithInterest },
        overdue: { count: overdueExpenses.length, total_amount: totalOverdueAmount },
        pending: { count: pendingExpenses.length, total_amount: totalPendingAmount },
        all_total: totalPaidExpensesAmount + totalOverdueAmount + totalPendingAmount,
      },
      detail_paid_expenses: paidExpenses.map(e => ({
        description: e.description,
        amount: Number(e.amount),
        interest: Number(e.interest_amount || 0),
        amount_paid: Number(e.amount_paid || e.amount),
        category: e.category,
        due_date: e.due_date,
      })),
      detail_overdue_expenses: overdueExpenses.map(e => ({
        description: e.description,
        amount: Number(e.amount),
        category: e.category,
        due_date: e.due_date,
      })),
    }

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
