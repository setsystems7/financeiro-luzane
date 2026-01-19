import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, TrendingUp, TrendingDown, Calendar, X } from 'lucide-react';
import { parseFinancialExcel, useImportFinancial, ParsedFinancialData } from '@/hooks/useImportFinancial';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ImportFinancialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export function ImportFinancialDialog({ open, onOpenChange }: ImportFinancialDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [parsedData, setParsedData] = useState<ParsedFinancialData | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ salesImported: number; expensesImported: number; salesSkipped: number; expensesSkipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportFinancial();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      const data = await parseFinancialExcel(file);
      setParsedData(data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setStep('importing');
    setImportProgress(10);

    try {
      // Simular progresso
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await importMutation.mutateAsync(parsedData);

      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na importação');
      setStep('preview');
    }
  };

  const handleClose = () => {
    setStep('upload');
    setParsedData(null);
    setImportProgress(0);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Movimentação Financeira
          </DialogTitle>
          <DialogDescription>
            Importe seu histórico financeiro a partir de uma planilha Excel.
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer w-full max-w-md"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Clique para selecionar</p>
              <p className="text-sm text-muted-foreground mb-4">
                ou arraste o arquivo Excel aqui
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: .xls, .xlsx
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />

            {error && (
              <div className="mt-4 flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="mt-8 text-sm text-muted-foreground max-w-md">
              <p className="font-medium mb-2">Formato esperado da planilha:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Data de Pagamento, Conta, Descrição, Pago em, Tipo, Valor</li>
                <li>Registros com "PEDIDO DE VENDA" vão para Contas a Receber</li>
                <li>Demais registros vão para Contas a Pagar</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && parsedData && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">Vendas</span>
                </div>
                <p className="text-lg font-bold">{parsedData.sales.length}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(parsedData.totalSalesValue)}</p>
              </div>

              <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-xs font-medium">Despesas</span>
                </div>
                <p className="text-lg font-bold">{parsedData.expenses.length}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(parsedData.totalExpensesValue)}</p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 col-span-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs font-medium">Período</span>
                </div>
                <p className="text-sm font-medium">
                  {formatDate(parsedData.periodStart)} até {formatDate(parsedData.periodEnd)}
                </p>
              </div>
            </div>

            {/* Data Preview Tabs */}
            <Tabs defaultValue="sales" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sales" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Vendas ({parsedData.sales.length})
                </TabsTrigger>
                <TabsTrigger value="expenses" className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Despesas ({parsedData.expenses.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sales" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-[300px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.sales.slice(0, 100).map((sale, index) => (
                        <TableRow key={index}>
                          <TableCell className="whitespace-nowrap">{formatDate(sale.data_pagamento)}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{sale.descricao}</TableCell>
                          <TableCell>{sale.pago_em}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(sale.valor)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedData.sales.length > 100 && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      Mostrando 100 de {parsedData.sales.length} registros
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="expenses" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-[300px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.expenses.slice(0, 100).map((expense, index) => (
                        <TableRow key={index}>
                          <TableCell className="whitespace-nowrap">{formatDate(expense.data_pagamento)}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{expense.descricao}</TableCell>
                          <TableCell>{expense.pago_em}</TableCell>
                          <TableCell className="text-right font-medium text-rose-600 dark:text-rose-400">
                            {formatCurrency(expense.valor)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedData.expenses.length > 100 && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      Mostrando 100 de {parsedData.expenses.length} registros
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="mt-4 flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="h-16 w-16 text-primary mb-6 animate-pulse" />
            <p className="text-lg font-medium mb-4">Importando dados...</p>
            <div className="w-full max-w-md">
              <Progress value={importProgress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground mt-2">{importProgress}%</p>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Aguarde, isso pode levar alguns segundos...
            </p>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && importResult && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-16 w-16 text-emerald-500 mb-6" />
            <p className="text-lg font-medium mb-4">Importação Concluída!</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-emerald-500/10 rounded-lg">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{importResult.salesImported}</p>
                <p className="text-sm text-muted-foreground">vendas importadas</p>
                {importResult.salesSkipped > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {importResult.salesSkipped} duplicatas ignoradas
                  </p>
                )}
              </div>
              <div className="text-center p-4 bg-rose-500/10 rounded-lg">
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{importResult.expensesImported}</p>
                <p className="text-sm text-muted-foreground">despesas importadas</p>
                {importResult.expensesSkipped > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {importResult.expensesSkipped} duplicatas ignoradas
                  </p>
                )}
              </div>
            </div>

            {(importResult.salesSkipped > 0 || importResult.expensesSkipped > 0) && (
              <p className="text-sm text-muted-foreground mb-4">
                Registros com mesma data, descrição e valor foram ignorados para evitar duplicatas.
              </p>
            )}

            {importResult.errors.length > 0 && (
              <div className="w-full max-w-md">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                  {importResult.errors.length} erro(s) durante a importação:
                </p>
                <ScrollArea className="h-24 rounded-md border p-2">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{err}</p>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => {
                setStep('upload');
                setParsedData(null);
                setError(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={!parsedData || (parsedData.sales.length === 0 && parsedData.expenses.length === 0)}>
                Importar {(parsedData?.sales.length || 0) + (parsedData?.expenses.length || 0)} registros
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
