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

    // Fetch ALL with pagination
    async function fetchAll(table: string, select: string) {
      let all: any[] = []; let from = 0; const ps = 1000;
      while (true) {
        const { data, error } = await adminClient.from(table).select(select).order('due_date', { ascending: true }).range(from, from + ps - 1)
        if (error) throw error
        if (!data || !data.length) break
        all = all.concat(data)
        if (data.length < ps) break
        from += ps
      }
      return all
    }

    const allReceivables = await fetchAll('receivables', 'id, description, amount, net_amount, fee, due_date, is_received, received_date, sale_id')
    const allExpenses = await fetchAll('expenses', 'id, description, amount, category, due_date, status, paid_date, interest_amount, amount_paid, is_recurring, recurrence_index, supplier_id')
    
    const totalAllReceivablesAmount = allReceivables.reduce((s, r) => s + Number(r.amount || 0), 0)
    const totalAllReceivablesNet = allReceivables.reduce((s, r) => s + Number(r.net_amount || 0), 0)
    const totalFees = allReceivables.reduce((s, r) => s + Number(r.fee || 0), 0)

    const receivedReceivables = allReceivables.filter(r => r.is_received === true || r.received_date)
    const notReceived = allReceivables.filter(r => !r.is_received && !r.received_date)
    const totalReceivedNet = receivedReceivables.reduce((s, r) => s + Number(r.net_amount || 0), 0)
    const totalNotReceivedNet = notReceived.reduce((s, r) => s + Number(r.net_amount || 0), 0)

    const manualEntries = allReceivables.filter(r => r.description?.includes('[Empréstimo]') || r.description?.includes('[Entrada Manual]'))
    const salesRecv = allReceivables.filter(r => !r.description?.includes('[Empréstimo]') && !r.description?.includes('[Entrada Manual]'))

    const paidExpenses = allExpenses.filter(e => e.status === 'pago')
    const overdueExpenses = allExpenses.filter(e => e.status === 'vencido')
    const pendingExpenses = allExpenses.filter(e => e.status === 'pendente')
    const effectivelyPaid = allExpenses.filter(e => e.paid_date || e.status === 'pago')

    const totalPaidAmount = paidExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalPaidAmountPaid = paidExpenses.reduce((s, e) => s + Number(e.amount_paid || e.amount || 0), 0)
    const totalOverdue = overdueExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalPending = pendingExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const effectivelyPaidAmount = effectivelyPaid.reduce((s, e) => s + Number(e.amount || 0), 0)
    const effectivelyPaidAmountPaid = effectivelyPaid.reduce((s, e) => s + Number(e.amount_paid || e.amount || 0), 0)

    const pagoSemDate = allExpenses.filter(e => e.status === 'pago' && !e.paid_date)
    const dateSemPago = allExpenses.filter(e => e.paid_date && e.status !== 'pago')
    const diffAmounts = effectivelyPaid.filter(e => e.amount_paid && Math.abs(Number(e.amount_paid) - Number(e.amount)) > 0.01)

    const report = {
      generated_at: new Date().toISOString(),
      receivables: {
        total_registros: allReceivables.length,
        total_bruto: totalAllReceivablesAmount,
        total_liquido: totalAllReceivablesNet,
        total_taxas: totalFees,
        recebidos: { count: receivedReceivables.length, total_net: totalReceivedNet },
        nao_recebidos: { count: notReceived.length, total_net: totalNotReceivedNet },
        manuais: { count: manualEntries.length, total_amount: manualEntries.reduce((s, r) => s + Number(r.amount || 0), 0), total_net: manualEntries.reduce((s, r) => s + Number(r.net_amount || 0), 0) },
        vendas: { count: salesRecv.length, total_amount: salesRecv.reduce((s, r) => s + Number(r.amount || 0), 0), total_net: salesRecv.reduce((s, r) => s + Number(r.net_amount || 0), 0) },
      },
      expenses: {
        por_status: {
          pago: { count: paidExpenses.length, total_amount: totalPaidAmount, total_amount_paid: totalPaidAmountPaid },
          vencido: { count: overdueExpenses.length, total_amount: totalOverdue },
          pendente: { count: pendingExpenses.length, total_amount: totalPending },
        },
        efetivamente_pagas: { count: effectivelyPaid.length, total_amount: effectivelyPaidAmount, total_amount_paid: effectivelyPaidAmountPaid },
        total_geral: totalPaidAmount + totalOverdue + totalPending,
      },
      inconsistencias: {
        pago_sem_paid_date: { count: pagoSemDate.length, total: pagoSemDate.reduce((s, e) => s + Number(e.amount || 0), 0), items: pagoSemDate.map(e => ({ desc: e.description, amount: Number(e.amount) })) },
        paid_date_sem_status_pago: { count: dateSemPago.length, items: dateSemPago.map(e => ({ desc: e.description, amount: Number(e.amount), status: e.status })) },
        amount_paid_diff: { count: diffAmounts.length, total_diff: diffAmounts.reduce((s, e) => s + (Number(e.amount_paid) - Number(e.amount)), 0), items: diffAmounts.map(e => ({ desc: e.description, amount: Number(e.amount), paid: Number(e.amount_paid), diff: Number(e.amount_paid) - Number(e.amount) })) },
      },
      caixa: {
        recebidos_liquido: totalReceivedNet,
        pagas_amount_paid: effectivelyPaidAmountPaid,
        pagas_amount: effectivelyPaidAmount,
        caixa_com_amount_paid: totalReceivedNet - effectivelyPaidAmountPaid,
        caixa_com_amount: totalReceivedNet - effectivelyPaidAmount,
        meta: 1837.01,
        diff_com_amount_paid: (totalReceivedNet - effectivelyPaidAmountPaid) - 1837.01,
        diff_com_amount: (totalReceivedNet - effectivelyPaidAmount) - 1837.01,
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
