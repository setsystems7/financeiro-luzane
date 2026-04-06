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

    // Verify authenticated user OR service role key
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const token = authHeader.replace('Bearer ', '')
    const isServiceRole = token === serviceRoleKey

    if (!isServiceRole) {
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      })
      const { data: claimsData, error: claimsError } = await anonClient.auth.getUser()
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Fetch ALL receivables with pagination
    let allReceivables: any[] = []
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await adminClient
        .from('receivables')
        .select('id, description, amount, net_amount, fee, due_date, is_received, received_date, sale_id')
        .order('due_date', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      allReceivables = allReceivables.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }

    // Fetch ALL expenses with pagination
    let allExpenses: any[] = []
    from = 0
    while (true) {
      const { data, error } = await adminClient
        .from('expenses')
        .select('id, description, amount, category, due_date, status, paid_date, interest_amount, amount_paid, is_recurring, recurrence_index, supplier_id')
        .order('due_date', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      allExpenses = allExpenses.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }
    
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

    // Efetivamente recebidos
    const receivedReceivables = allReceivables.filter(r => r.is_received === true || r.received_date)
    const notReceivedReceivables = allReceivables.filter(r => !r.is_received && !r.received_date)
    const totalReceivedNet = receivedReceivables.reduce((s, r) => s + Number(r.net_amount || 0), 0)
    const totalNotReceivedNet = notReceivedReceivables.reduce((s, r) => s + Number(r.net_amount || 0), 0)

    // Efetivamente pagas (paid_date OR status=pago)
    const effectivelyPaid = allExpenses.filter(e => e.paid_date || e.status === 'pago')
    const effectivelyPaidAmount = effectivelyPaid.reduce((s, e) => s + Number(e.amount || 0), 0)
    const effectivelyPaidAmountPaid = effectivelyPaid.reduce((s, e) => s + Number(e.amount_paid || e.amount || 0), 0)

    // Inconsistências
    const pagoSemDate = allExpenses.filter(e => e.status === 'pago' && !e.paid_date)
    const dateSemPago = allExpenses.filter(e => e.paid_date && e.status !== 'pago')
    const diffAmounts = effectivelyPaid.filter(e => e.amount_paid && Math.abs(Number(e.amount_paid) - Number(e.amount)) > 0.01)

    const totalFees = allReceivables.reduce((s, r) => s + Number(r.fee || 0), 0)

    // Caixa calculations
    const caixaUsingAmountPaid = totalReceivedNet - effectivelyPaidAmountPaid
    const caixaUsingAmount = totalReceivedNet - effectivelyPaidAmount

    const report = {
      generated_at: new Date().toISOString(),
      receivables_totals: {
        count: allReceivables.length,
        total_amount_bruto: totalAllReceivablesAmount,
        total_net_amount: totalAllReceivablesNet,
        total_fees: totalFees,
        received: {
          count: receivedReceivables.length,
          total_net: totalReceivedNet,
        },
        not_received: {
          count: notReceivedReceivables.length,
          total_net: totalNotReceivedNet,
        },
        manual_entries: {
          count: manualEntries.length,
          total_amount: manualEntries.reduce((s, r) => s + Number(r.amount || 0), 0),
          total_net: manualEntries.reduce((s, r) => s + Number(r.net_amount || 0), 0),
        },
        sales: {
          count: salesReceivables.length,
          total_amount: salesReceivables.reduce((s, r) => s + Number(r.amount || 0), 0),
          total_net: salesReceivables.reduce((s, r) => s + Number(r.net_amount || 0), 0),
        },
      },
      expenses_totals: {
        paid_by_status: { count: paidExpenses.length, total_amount: totalPaidExpensesAmount, total_amount_paid: totalPaidWithInterest },
        overdue: { count: overdueExpenses.length, total_amount: totalOverdueAmount },
        pending: { count: pendingExpenses.length, total_amount: totalPendingAmount },
        effectively_paid: { count: effectivelyPaid.length, total_amount: effectivelyPaidAmount, total_amount_paid: effectivelyPaidAmountPaid },
        all_total: totalPaidExpensesAmount + totalOverdueAmount + totalPendingAmount,
      },
      inconsistencies: {
        pago_sem_paid_date: {
          count: pagoSemDate.length,
          total_amount: pagoSemDate.reduce((s, e) => s + Number(e.amount || 0), 0),
          items: pagoSemDate.map(e => ({ description: e.description, amount: Number(e.amount), category: e.category })),
        },
        paid_date_sem_status_pago: {
          count: dateSemPago.length,
          items: dateSemPago.map(e => ({ description: e.description, amount: Number(e.amount), status: e.status, paid_date: e.paid_date })),
        },
        amount_paid_diferente_amount: {
          count: diffAmounts.length,
          total_diff: diffAmounts.reduce((s, e) => s + (Number(e.amount_paid) - Number(e.amount)), 0),
          items: diffAmounts.map(e => ({ description: e.description, amount: Number(e.amount), amount_paid: Number(e.amount_paid), diff: Number(e.amount_paid) - Number(e.amount) })),
        },
      },
      caixa: {
        recebidos_net: totalReceivedNet,
        pagas_amount_paid: effectivelyPaidAmountPaid,
        pagas_amount: effectivelyPaidAmount,
        caixa_usando_amount_paid: caixaUsingAmountPaid,
        caixa_usando_amount: caixaUsingAmount,
        meta_esperada: 1837.01,
        diff_amount_paid: caixaUsingAmountPaid - 1837.01,
        diff_amount: caixaUsingAmount - 1837.01,
      },
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
