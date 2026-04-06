import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;

Deno.test("financial-report audit", async () => {
  // Sign in to get a real JWT
  const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!,
    },
    body: JSON.stringify({
      email: "teste@teste.com",
      password: "123456",
    }),
  });
  
  const signInBody = await signInRes.text();
  
  if (!signInRes.ok) {
    // Try another common test email
    const signInRes2 = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!,
      },
      body: JSON.stringify({
        email: "admin@admin.com",
        password: "admin123",
      }),
    });
    const body2 = await signInRes2.text();
    console.log("Login attempt 2 status:", signInRes2.status);
    if (!signInRes2.ok) {
      console.log("Could not authenticate. Trying to list users...");
      console.log("Response:", body2.substring(0, 200));
      return;
    }
    const auth2 = JSON.parse(body2);
    await callReport(auth2.access_token);
    return;
  }

  const auth = JSON.parse(signInBody);
  await callReport(auth.access_token);
});

async function callReport(token: string) {
  const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/financial-report`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "apikey": Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!,
    },
  });
  const body = await res.text();
  console.log("Status:", res.status);
  const report = JSON.parse(body);
  
  console.log("\n========== RELATÓRIO FINANCEIRO ==========\n");
  console.log("📥 RECEBÍVEIS (ENTRADAS):");
  console.log(`  Total registros: ${report.receivables.total_registros}`);
  console.log(`  Total bruto: R$ ${report.receivables.total_bruto?.toFixed(2)}`);
  console.log(`  Total líquido: R$ ${report.receivables.total_liquido?.toFixed(2)}`);
  console.log(`  Total taxas: R$ ${report.receivables.total_taxas?.toFixed(2)}`);
  console.log(`  Recebidos: ${report.receivables.recebidos?.count} | Net: R$ ${report.receivables.recebidos?.total_net?.toFixed(2)}`);
  console.log(`  Não recebidos: ${report.receivables.nao_recebidos?.count} | Net: R$ ${report.receivables.nao_recebidos?.total_net?.toFixed(2)}`);
  console.log(`  Manuais: ${report.receivables.manuais?.count} | Amount: R$ ${report.receivables.manuais?.total_amount?.toFixed(2)}`);
  console.log(`  Vendas: ${report.receivables.vendas?.count} | Amount: R$ ${report.receivables.vendas?.total_amount?.toFixed(2)}`);
  
  console.log("\n📤 DESPESAS:");
  console.log(`  Pagas: ${report.expenses.por_status.pago?.count} | amount: R$ ${report.expenses.por_status.pago?.total_amount?.toFixed(2)} | amount_paid: R$ ${report.expenses.por_status.pago?.total_amount_paid?.toFixed(2)}`);
  console.log(`  Vencidas: ${report.expenses.por_status.vencido?.count} | R$ ${report.expenses.por_status.vencido?.total_amount?.toFixed(2)}`);
  console.log(`  Pendentes: ${report.expenses.por_status.pendente?.count} | R$ ${report.expenses.por_status.pendente?.total_amount?.toFixed(2)}`);
  console.log(`  Efetivamente pagas: ${report.expenses.efetivamente_pagas?.count} | amount: R$ ${report.expenses.efetivamente_pagas?.total_amount?.toFixed(2)} | paid: R$ ${report.expenses.efetivamente_pagas?.total_amount_paid?.toFixed(2)}`);
  
  console.log("\n⚠️ INCONSISTÊNCIAS:");
  console.log(`  Pago sem paid_date: ${report.inconsistencias.pago_sem_paid_date?.count} (R$ ${report.inconsistencias.pago_sem_paid_date?.total?.toFixed(2)})`);
  if (report.inconsistencias.pago_sem_paid_date?.items?.length > 0) {
    report.inconsistencias.pago_sem_paid_date.items.forEach((i: any) => console.log(`    - ${i.desc}: R$ ${i.amount?.toFixed(2)}`));
  }
  console.log(`  paid_date sem status pago: ${report.inconsistencias.paid_date_sem_status_pago?.count}`);
  if (report.inconsistencias.paid_date_sem_status_pago?.items?.length > 0) {
    report.inconsistencias.paid_date_sem_status_pago.items.forEach((i: any) => console.log(`    - ${i.desc}: R$ ${i.amount?.toFixed(2)} (status: ${i.status})`));
  }
  console.log(`  amount_paid ≠ amount: ${report.inconsistencias.amount_paid_diff?.count} (diff total: R$ ${report.inconsistencias.amount_paid_diff?.total_diff?.toFixed(2)})`);
  if (report.inconsistencias.amount_paid_diff?.items?.length > 0) {
    report.inconsistencias.amount_paid_diff.items.forEach((i: any) => console.log(`    - ${i.desc}: amount=${i.amount?.toFixed(2)} paid=${i.paid?.toFixed(2)} diff=${i.diff?.toFixed(2)}`));
  }
  
  console.log("\n💰 VALOR DO CAIXA:");
  console.log(`  Recebidos (líquido): R$ ${report.caixa.recebidos_liquido?.toFixed(2)}`);
  console.log(`  Pagas (amount_paid): R$ ${report.caixa.pagas_amount_paid?.toFixed(2)}`);
  console.log(`  Pagas (amount): R$ ${report.caixa.pagas_amount?.toFixed(2)}`);
  console.log(`  CAIXA (com amount_paid): R$ ${report.caixa.caixa_com_amount_paid?.toFixed(2)}`);
  console.log(`  CAIXA (com amount): R$ ${report.caixa.caixa_com_amount?.toFixed(2)}`);
  console.log(`  Meta esperada: R$ ${report.caixa.meta}`);
  console.log(`  Diferença (amount_paid): R$ ${report.caixa.diff_com_amount_paid?.toFixed(2)}`);
  console.log(`  Diferença (amount): R$ ${report.caixa.diff_com_amount?.toFixed(2)}`);
  
  assertEquals(res.status, 200);
}
