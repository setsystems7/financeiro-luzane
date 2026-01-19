import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export interface FinancialImportRow {
  data_pagamento: string;
  conta: string;
  descricao: string;
  pago_em: string;
  tipo: 'Credito' | 'Debito';
  valor: number;
}

export interface ParsedFinancialData {
  sales: FinancialImportRow[];
  expenses: FinancialImportRow[];
  periodStart: string;
  periodEnd: string;
  totalSalesValue: number;
  totalExpensesValue: number;
}

export interface ImportResult {
  salesImported: number;
  expensesImported: number;
  salesSkipped: number;
  expensesSkipped: number;
  errors: string[];
}

// Categorização automática de despesas
function detectCategory(description: string): string {
  const desc = description.toUpperCase();

  if (desc.includes('SIMPLES NACIONAL') || desc.includes('IPTU') || desc.includes('DAS') || desc.includes('IMPOSTO') || desc.includes('ICMS') || desc.includes('ISS')) {
    return 'Impostos';
  }
  if (desc.includes('COMPRA') || desc.includes('GLENY') || desc.includes('RIACHUELO') || desc.includes('FERJU') || desc.includes('ATACADO') || desc.includes('FORNECEDOR')) {
    return 'Compra de Mercadoria';
  }
  if (desc.includes('EMPRÉSTIMO') || desc.includes('EMPRESTIMO')) {
    return 'Empréstimos';
  }
  if (desc.includes('RETIRADA') || desc.includes('PRO-LABORE') || desc.includes('PROLABORE')) {
    return 'Pro-labore';
  }
  if (desc.includes('UBER') || desc.includes('99') || desc.includes('COMBUSTÍVEL') || desc.includes('COMBUSTIVEL') || desc.includes('GASOLINA') || desc.includes('ETANOL')) {
    return 'Transporte';
  }
  if (desc.includes('ÁGUA') || desc.includes('AGUA') || desc.includes('LUZ') || desc.includes('ENERGIA') || desc.includes('INTERNET') || desc.includes('CELULAR') || desc.includes('TELEFONE')) {
    return 'Infraestrutura';
  }
  if (desc.includes('ALUGUEL')) {
    return 'Aluguel';
  }
  if (desc.includes('BANCO') || desc.includes('TARIFA') || desc.includes('IOF') || desc.includes('ANUIDADE')) {
    return 'Taxas Bancárias';
  }
  if (desc.includes('MARKETING') || desc.includes('PUBLICIDADE') || desc.includes('ANÚNCIO') || desc.includes('ANUNCIO')) {
    return 'Marketing';
  }

  return 'Outros';
}

// Converter data DD/MM/YYYY para YYYY-MM-DD
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  // Se já está no formato ISO
  if (dateStr.includes('-') && dateStr.length === 10) {
    return dateStr;
  }

  // Formato DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Tentar parse como número (Excel serial date)
  const num = Number(dateStr);
  if (!isNaN(num) && num > 0) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

// Converter valor monetário
function parseValue(value: any): number {
  if (typeof value === 'number') {
    return Math.abs(value);
  }

  if (typeof value === 'string') {
    // Remover R$, espaços e converter vírgula para ponto
    const cleaned = value
      .replace(/R\$\s*/g, '')
      .replace(/\s/g, '')
      .replace(/\./g, '') // Remover pontos de milhar
      .replace(',', '.'); // Converter vírgula decimal

    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.abs(num);
  }

  return 0;
}

// Normalizar headers do Excel
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

export function parseFinancialExcel(file: File): Promise<ParsedFinancialData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          reject(new Error('Planilha vazia ou sem dados'));
          return;
        }

        // Mapear headers
        const headers = (jsonData[0] as string[]).map(h => normalizeHeader(String(h || '')));

        const headerMap: Record<string, number> = {};
        headers.forEach((h, i) => {
          if (h.includes('data') && h.includes('pagamento')) headerMap.data_pagamento = i;
          else if (h === 'conta') headerMap.conta = i;
          else if (h.includes('descricao')) headerMap.descricao = i;
          else if (h.includes('pago') && h.includes('em')) headerMap.pago_em = i;
          else if (h === 'tipo') headerMap.tipo = i;
          else if (h === 'valor') headerMap.valor = i;
        });

        const sales: FinancialImportRow[] = [];
        const expenses: FinancialImportRow[] = [];
        const allDates: string[] = [];

        // Processar linhas
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const descricao = String(row[headerMap.descricao] || '').trim();
          if (!descricao) continue;

          const dataPagamento = parseDate(String(row[headerMap.data_pagamento] || ''));
          const valor = parseValue(row[headerMap.valor]);

          if (valor === 0) continue;

          allDates.push(dataPagamento);

          const record: FinancialImportRow = {
            data_pagamento: dataPagamento,
            conta: String(row[headerMap.conta] || ''),
            descricao,
            pago_em: String(row[headerMap.pago_em] || ''),
            tipo: String(row[headerMap.tipo] || '').toLowerCase().includes('credito') ? 'Credito' : 'Debito',
            valor,
          };

          // Separar por tipo de registro
          if (descricao.toUpperCase().includes('PEDIDO DE VENDA')) {
            sales.push(record);
          } else {
            expenses.push(record);
          }
        }

        // Calcular período
        const sortedDates = allDates.sort();
        const periodStart = sortedDates[0] || '';
        const periodEnd = sortedDates[sortedDates.length - 1] || '';

        // Calcular totais
        const totalSalesValue = sales.reduce((sum, s) => sum + s.valor, 0);
        const totalExpensesValue = expenses.reduce((sum, e) => sum + e.valor, 0);

        resolve({
          sales,
          expenses,
          periodStart,
          periodEnd,
          totalSalesValue,
          totalExpensesValue,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

export function useImportFinancial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ParsedFinancialData): Promise<ImportResult> => {
      const errors: string[] = [];
      let salesImported = 0;
      let expensesImported = 0;
      let salesSkipped = 0;
      let expensesSkipped = 0;

      // Buscar receivables existentes para validação de duplicatas
      const { data: existingReceivables } = await supabase
        .from('receivables')
        .select('description, amount, due_date');

      // Criar set de chaves únicas para receivables existentes
      const existingReceivablesKeys = new Set(
        (existingReceivables || []).map(r =>
          `${r.description}|${Number(r.amount).toFixed(2)}|${r.due_date}`
        )
      );

      // Buscar expenses existentes para validação de duplicatas
      const { data: existingExpenses } = await supabase
        .from('expenses')
        .select('description, amount, due_date');

      // Criar set de chaves únicas para expenses existentes
      const existingExpensesKeys = new Set(
        (existingExpenses || []).map(e =>
          `${e.description}|${Number(e.amount).toFixed(2)}|${e.due_date}`
        )
      );

      // Filtrar vendas que não são duplicatas
      const newSales = data.sales.filter(sale => {
        const key = `${sale.descricao}|${sale.valor.toFixed(2)}|${sale.data_pagamento}`;
        if (existingReceivablesKeys.has(key)) {
          salesSkipped++;
          return false;
        }
        return true;
      });

      // Importar vendas (receivables)
      if (newSales.length > 0) {
        const receivablesData = newSales.map(sale => ({
          description: sale.descricao,
          amount: sale.valor,
          fee: 0,
          net_amount: sale.valor,
          due_date: sale.data_pagamento,
          is_received: true,
          received_date: sale.data_pagamento,
          notes: sale.pago_em ? `Importado - Pago em: ${sale.pago_em}` : 'Importado do histórico',
        }));

        // Inserir em lotes de 100
        const batchSize = 100;
        for (let i = 0; i < receivablesData.length; i += batchSize) {
          const batch = receivablesData.slice(i, i + batchSize);
          const { data: insertedData, error } = await supabase
            .from('receivables')
            .insert(batch)
            .select();

          if (error) {
            errors.push(`Erro ao importar vendas (lote ${Math.floor(i / batchSize) + 1}): ${error.message}`);
          } else {
            salesImported += insertedData?.length || 0;
          }
        }
      }

      // Filtrar despesas que não são duplicatas
      const newExpenses = data.expenses.filter(expense => {
        const key = `${expense.descricao}|${expense.valor.toFixed(2)}|${expense.data_pagamento}`;
        if (existingExpensesKeys.has(key)) {
          expensesSkipped++;
          return false;
        }
        return true;
      });

      // Importar despesas (expenses)
      if (newExpenses.length > 0) {
        console.log(`Importando ${newExpenses.length} despesas (${expensesSkipped} duplicatas ignoradas)...`);

        const batchSize = 50;
        for (let i = 0; i < newExpenses.length; i += batchSize) {
          const batch = newExpenses.slice(i, i + batchSize);

          const expensesData = batch.map(expense => ({
            description: expense.descricao,
            amount: expense.valor,
            category: detectCategory(expense.descricao),
            due_date: expense.data_pagamento,
            status: 'pago' as const,
            paid_date: expense.data_pagamento,
            notes: expense.pago_em ? `Importado - Pago em: ${expense.pago_em}` : 'Importado do histórico',
          }));

          const { data: insertedData, error } = await supabase
            .from('expenses')
            .insert(expensesData)
            .select();

          if (error) {
            console.error(`Erro no lote ${Math.floor(i / batchSize) + 1}:`, error);
            errors.push(`Erro ao importar despesas (lote ${Math.floor(i / batchSize) + 1}): ${error.message}`);
          } else {
            expensesImported += insertedData?.length || 0;
          }
        }
      }

      return { salesImported, expensesImported, salesSkipped, expensesSkipped, errors };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });

      const skippedTotal = result.salesSkipped + result.expensesSkipped;

      if (result.errors.length === 0) {
        let message = `Importação concluída! ${result.salesImported} vendas e ${result.expensesImported} despesas importadas.`;
        if (skippedTotal > 0) {
          message += ` ${skippedTotal} duplicatas ignoradas.`;
        }
        toast.success(message);
      } else {
        toast.warning(`Importação parcial: ${result.salesImported} vendas, ${result.expensesImported} despesas. ${result.errors.length} erros.`);
      }
    },
    onError: (error) => {
      toast.error(`Erro na importação: ${error.message}`);
    },
  });
}
