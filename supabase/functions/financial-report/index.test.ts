import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("financial-report audit", async () => {
  const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ email: "gustavogomesleitefranco@gmail.com", password: "Carmelita.1963" }),
  });
  const signInBody = await signInRes.json();
  if (!signInRes.ok) { console.log("Login failed:", signInBody); return; }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/financial-report`, {
    headers: { "Authorization": `Bearer ${signInBody.access_token}`, "apikey": ANON_KEY },
  });
  const report = await res.json();
  assertEquals(res.status, 200);

  console.log("\n========== RELATÓRIO FINANCEIRO ==========\n");
  const r = report.receivables;
  console.log("📥 RECEBÍVEIS:");
  console.log(`  Total: ${r.total_registros} | Bruto: R$ ${r.total_bruto?.toFixed(2)} | Líquido: R$ ${r.total_liquido?.toFixed(2)} | Taxas: R$ ${r.total_taxas?.toFixed(2)}`);
  console.log(`  Recebidos: ${r.recebidos?.count} | Net: R$ ${r.recebidos?.total_net?.toFixed(2)}`);
  console.log(`  Não recebidos: ${r.nao_recebidos?.count} | Net: R$ ${r.nao_recebidos?.total_net?.toFixed(2)}`);
  console.log(`  Manuais: ${r.manuais?.count} | R$ ${r.manuais?.total_amount?.toFixed(2)}`);
  console.log(`  Vendas: ${r.vendas?.count} | R$ ${r.vendas?.total_amount?.toFixed(2)}`);

  const e = report.expenses;
  console.log("\n📤 DESPESAS:");
  console.log(`  Pagas: ${e.por_status.pago?.count} | amount: R$ ${e.por_status.pago?.total_amount?.toFixed(2)} | paid: R$ ${e.por_status.pago?.total_amount_paid?.toFixed(2)}`);
  console.log(`  Vencidas: ${e.por_status.vencido?.count} | R$ ${e.por_status.vencido?.total_amount?.toFixed(2)}`);
  console.log(`  Pendentes: ${e.por_status.pendente?.count} | R$ ${e.por_status.pendente?.total_amount?.toFixed(2)}`);
  console.log(`  Efetivamente pagas: ${e.efetivamente_pagas?.count} | amount: R$ ${e.efetivamente_pagas?.total_amount?.toFixed(2)} | paid: R$ ${e.efetivamente_pagas?.total_amount_paid?.toFixed(2)}`);

  const ic = report.inconsistencias;
  console.log("\n⚠️ INCONSISTÊNCIAS:");
  console.log(`  Pago sem paid_date: ${ic.pago_sem_paid_date?.count} (R$ ${ic.pago_sem_paid_date?.total?.toFixed(2)})`);
  ic.pago_sem_paid_date?.items?.forEach((i: any) => console.log(`    - ${i.desc}: R$ ${i.amount?.toFixed(2)}`));
  console.log(`  paid_date sem status pago: ${ic.paid_date_sem_status_pago?.count}`);
  ic.paid_date_sem_status_pago?.items?.forEach((i: any) => console.log(`    - ${i.desc}: R$ ${i.amount?.toFixed(2)} (${i.status})`));
  console.log(`  amount_paid ≠ amount: ${ic.amount_paid_diff?.count} (diff: R$ ${ic.amount_paid_diff?.total_diff?.toFixed(2)})`);
  ic.amount_paid_diff?.items?.forEach((i: any) => console.log(`    - ${i.desc}: amt=${i.amount?.toFixed(2)} paid=${i.paid?.toFixed(2)} diff=${i.diff?.toFixed(2)}`));

  const c = report.caixa;
  console.log("\n💰 VALOR DO CAIXA:");
  console.log(`  Recebidos (líquido): R$ ${c.recebidos_liquido?.toFixed(2)}`);
  console.log(`  Pagas (amount_paid): R$ ${c.pagas_amount_paid?.toFixed(2)}`);
  console.log(`  Pagas (amount): R$ ${c.pagas_amount?.toFixed(2)}`);
  console.log(`  CAIXA (com amount_paid): R$ ${c.caixa_com_amount_paid?.toFixed(2)}`);
  console.log(`  CAIXA (com amount): R$ ${c.caixa_com_amount?.toFixed(2)}`);
  console.log(`  Meta: R$ ${c.meta}`);
  console.log(`  Diff (amount_paid): R$ ${c.diff_com_amount_paid?.toFixed(2)}`);
  console.log(`  Diff (amount): R$ ${c.diff_com_amount?.toFixed(2)}`);
});
