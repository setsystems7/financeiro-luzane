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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || ''
    
    // Allow service_role key OR authenticated user
    if (token !== serviceRoleKey) {
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || '' } }
      })
      const { data: claimsData, error: claimsError } = await anonClient.auth.getUser()
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
      }
    }

    // Use service role to bypass RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Fetch all expenses
    const { data: expenses, error: expError } = await adminClient
      .from('expenses')
      .select('id, description, amount, category, due_date, status, paid_date, interest_amount, amount_paid, is_recurring, recurrence_index, supplier_id')
      .order('due_date', { ascending: true })

    if (expError) throw expError

    // Fetch all receivables
    const { data: receivables, error: recError } = await adminClient
      .from('receivables')
      .select('id, description, amount, net_amount, fee, due_date, is_received, received_date, sale_id')
      .order('due_date', { ascending: true })

    if (recError) throw recError

    // Compute summaries
    const paidExpenses = expenses?.filter(e => e.status === 'pago') || []
    const overdueExpenses = expenses?.filter(e => e.status === 'vencido') || []
    const pendingExpenses = expenses?.filter(e => e.status === 'pendente') || []

    const totalPaidAmount = paidExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalPaidWithInterest = paidExpenses.reduce((s, e) => s + Number(e.amount_paid || e.amount || 0), 0)
    const totalOverdueAmount = overdueExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const totalPendingAmount = pendingExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)

    const receivedReceivables = receivables?.filter(r => r.is_received) || []
    const pendingReceivables = receivables?.filter(r => !r.is_received) || []

    const totalReceivedGross = receivedReceivables.reduce((s, r) => s + Number(r.amount || 0), 0)
    const totalReceivedNet = receivedReceivables.reduce((s, r) => s + Number(r.net_amount || 0), 0)
    const totalReceivedFees = receivedReceivables.reduce((s, r) => s + Number(r.fee || 0), 0)
    const totalPendingReceivablesGross = pendingReceivables.reduce((s, r) => s + Number(r.amount || 0), 0)

    const cashUsingGross = totalReceivedGross - totalPaidWithInterest
    const cashUsingNet = totalReceivedNet - totalPaidWithInterest

    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        cash_using_gross_amount: cashUsingGross,
        cash_using_net_amount: cashUsingNet,
        difference_gross_vs_net: cashUsingGross - cashUsingNet,
        total_fees_deducted: totalReceivedFees,
      },
      expenses: {
        paid: { count: paidExpenses.length, total_amount: totalPaidAmount, total_paid_with_interest: totalPaidWithInterest },
        overdue: { count: overdueExpenses.length, total_amount: totalOverdueAmount },
        pending: { count: pendingExpenses.length, total_amount: totalPendingAmount },
        all_total: totalPaidAmount + totalOverdueAmount + totalPendingAmount,
      },
      receivables: {
        received: { count: receivedReceivables.length, total_gross: totalReceivedGross, total_net: totalReceivedNet, total_fees: totalReceivedFees },
        pending: { count: pendingReceivables.length, total_gross: totalPendingReceivablesGross },
      },
      detail_paid_expenses: paidExpenses.map(e => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        interest: Number(e.interest_amount || 0),
        amount_paid: Number(e.amount_paid || e.amount),
        category: e.category,
        due_date: e.due_date,
        paid_date: e.paid_date,
      })),
      detail_overdue_expenses: overdueExpenses.map(e => ({
        id: e.id,
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
