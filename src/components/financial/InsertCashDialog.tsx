import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Landmark } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useExpenseCategories } from '@/hooks/useExpenseCategories';
import { useSuppliersList } from '@/hooks/useSuppliers';
import { toast } from 'sonner';

interface InsertCashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InsertCashDialog({ open, onOpenChange }: InsertCashDialogProps) {
  const queryClient = useQueryClient();
  const { data: expenseCategories = [] } = useExpenseCategories();
  const { data: suppliers = [] } = useSuppliersList();

  // Fetch ALL expenses (including paid) to group by parent and show total
  const { data: allExpenses = [] } = useQuery({
    queryKey: ['all-expenses-for-link'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, description, amount, due_date, status, parent_expense_id, recurrence_months, recurrence_index, is_recurring')
        .order('due_date', { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Group expenses: show parent/standalone with total amount across all installments
  const groupedExpenses = useMemo(() => {
    // Find root expenses (no parent) that have pending/overdue installments
    const parentMap = new Map<string, { total: number; count: number; pendingCount: number; description: string; rootId: string }>();

    // Group by parent_expense_id or self
    allExpenses.forEach((exp: any) => {
      const rootId = exp.parent_expense_id || exp.id;
      if (!parentMap.has(rootId)) {
        parentMap.set(rootId, { total: 0, count: 0, pendingCount: 0, description: '', rootId });
      }
      const group = parentMap.get(rootId)!;
      group.total += Number(exp.amount);
      group.count += 1;
      if (exp.status === 'pendente' || exp.status === 'vencido') {
        group.pendingCount += 1;
      }
      // Use the base description (without index suffix) from the first item
      if (!group.description || (exp.recurrence_index === 1 || !exp.parent_expense_id)) {
        // Clean description: remove (1/N) suffix
        group.description = exp.description.replace(/\s*\(\d+\/\d+\)$/, '');
      }
    });

    // Only show groups that have at least one pending/overdue installment
    return Array.from(parentMap.values())
      .filter(g => g.pendingCount > 0)
      .map(g => ({
        id: g.rootId,
        description: g.description,
        totalAmount: g.total,
        installments: g.count,
        pendingCount: g.pendingCount,
      }));
  }, [allExpenses]);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoan, setIsLoan] = useState(false);
  const [wantsExpense, setWantsExpense] = useState<'none' | 'create'>('none');
  const [loading, setLoading] = useState(false);

  // Expense fields (when creating new)
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDueDate, setExpenseDueDate] = useState('');
  const [expenseSupplierId, setExpenseSupplierId] = useState('');
  const [expenseInstallments, setExpenseInstallments] = useState('1');
  const [expenseInstallmentValue, setExpenseInstallmentValue] = useState('');

  // Link existing expense
  const [linkedExpenseId, setLinkedExpenseId] = useState('');

  const handleSelectExistingExpense = (expId: string) => {
    setLinkedExpenseId(expId);
    const selected = groupedExpenses.find(e => e.id === expId);
    if (selected) {
      setAmount(selected.totalAmount.toFixed(2));
      setDescription(selected.description);
    }
  };

  // Auto-calculate installment value when amount or installments change
  const computedInstallmentValue = useMemo(() => {
    const numAmount = parseFloat(amount);
    const numInstallments = parseInt(expenseInstallments) || 1;
    if (!numAmount || numAmount <= 0 || numInstallments <= 0) return '';
    return (numAmount / numInstallments).toFixed(2);
  }, [amount, expenseInstallments]);

  // Use custom value if set, otherwise computed
  const effectiveInstallmentValue = expenseInstallmentValue || computedInstallmentValue;

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setNotes('');
    setIsLoan(false);
    setWantsExpense('none');
    setExpenseDescription('');
    setExpenseCategory('');
    setExpenseDueDate('');
    setExpenseSupplierId('');
    setExpenseInstallments('1');
    setExpenseInstallmentValue('');
    setLinkedExpenseId('');
  };

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!description.trim()) {
      toast.error('Informe uma descrição');
      return;
    }

    if (isLoan && wantsExpense === 'create' && !expenseDueDate) {
      toast.error('Informe a data de vencimento da conta a pagar');
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Insert receivable (cash entry)
      const loanNote = isLoan ? '[Empréstimo]' : '[Entrada Manual]';
      const { error: recError } = await supabase.from('receivables').insert({
        description: `${loanNote} ${description}`,
        amount: numAmount,
        fee: 0,
        net_amount: numAmount,
        due_date: today,
        is_received: true,
        received_date: today,
        notes: notes || null,
        sale_id: null,
      });

      if (recError) throw recError;

      // 2. If loan + create expense (with installments)
      if (isLoan && wantsExpense === 'create') {
        const numInstallments = parseInt(expenseInstallments) || 1;
        const installmentAmount = parseFloat(effectiveInstallmentValue) || numAmount;
        const baseDate = new Date(expenseDueDate);
        const baseDescription = expenseDescription || `Pagamento: ${description}`;

        if (numInstallments === 1) {
          // Single expense
          const { error: expError } = await supabase.from('expenses').insert({
            description: baseDescription,
            amount: installmentAmount,
            category: expenseCategory || null,
            due_date: expenseDueDate,
            supplier_id: expenseSupplierId || null,
            notes: `Ref. empréstimo: ${description}`,
            status: 'pendente',
          });
          if (expError) throw expError;
        } else {
          // Create first installment
          const { data: firstExp, error: firstError } = await supabase
            .from('expenses')
            .insert({
              description: `${baseDescription} (1/${numInstallments})`,
              amount: installmentAmount,
              category: expenseCategory || null,
              due_date: expenseDueDate,
              supplier_id: expenseSupplierId || null,
              notes: `Ref. empréstimo: ${description}`,
              status: 'pendente',
              is_recurring: true,
              recurrence_months: numInstallments,
              recurrence_index: 1,
            })
            .select()
            .single();

          if (firstError) throw firstError;

          // Create remaining installments
          const originalDay = baseDate.getDate();
          const remaining = [];
          for (let i = 1; i < numInstallments; i++) {
            const futureDate = new Date(baseDate);
            futureDate.setMonth(futureDate.getMonth() + i);
            const targetMonth = futureDate.getMonth();
            futureDate.setDate(originalDay);
            if (futureDate.getMonth() !== targetMonth) {
              futureDate.setDate(0);
            }

            remaining.push({
              description: `${baseDescription} (${i + 1}/${numInstallments})`,
              amount: installmentAmount,
              category: expenseCategory || null,
              due_date: futureDate.toISOString().split('T')[0],
              supplier_id: expenseSupplierId || null,
              notes: `Ref. empréstimo: ${description}`,
              status: 'pendente' as const,
              is_recurring: true,
              recurrence_months: numInstallments,
              parent_expense_id: firstExp.id,
              recurrence_index: i + 1,
            });
          }

          if (remaining.length > 0) {
            const { error: remError } = await supabase.from('expenses').insert(remaining);
            if (remError) throw remError;
          }
        }

        toast.success(
          numInstallments > 1
            ? `Valor inserido no caixa e ${numInstallments} parcelas registradas!`
            : 'Valor inserido no caixa e conta a pagar registrada!'
        );
      } else if (isLoan && wantsExpense === 'existing') {
        if (linkedExpenseId) {
          const { data: existingExp } = await supabase
            .from('expenses')
            .select('notes')
            .eq('id', linkedExpenseId)
            .single();

          const currentNotes = existingExp?.notes || '';
          const updatedNotes = currentNotes
            ? `${currentNotes}\n[Vinculado] Entrada no caixa: R$ ${numAmount.toFixed(2)} em ${today}`
            : `[Vinculado] Entrada no caixa: R$ ${numAmount.toFixed(2)} em ${today}`;

          await supabase
            .from('expenses')
            .update({ notes: updatedNotes })
            .eq('id', linkedExpenseId);

          toast.success('Valor inserido no caixa e vinculado à despesa existente!');
        } else {
          toast.success('Valor inserido no caixa!');
        }
      } else {
        toast.success('Valor inserido no caixa com sucesso!');
      }

      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-count'] });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Error inserting cash:', error);
      toast.error('Erro ao inserir valor no caixa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-green-500" />
            Inserir no Caixa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount */}
          <div>
            <Label htmlFor="cash-amount">Valor *</Label>
            <CurrencyInput
              id="cash-amount"
              value={amount}
              onChange={setAmount}
              placeholder="0,00"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="cash-description">Descrição *</Label>
            <Input
              id="cash-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Empréstimo bancário, Aporte de capital..."
              required
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="cash-notes">Observações</Label>
            <Textarea
              id="cash-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={2}
            />
          </div>

          {/* Is Loan checkbox */}
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
            <Checkbox
              id="is-loan"
              checked={isLoan}
              onCheckedChange={(checked) => {
                setIsLoan(!!checked);
                if (!checked) setWantsExpense('none');
              }}
            />
            <Label htmlFor="is-loan" className="text-sm cursor-pointer">
              Este valor é um empréstimo (precisa ser devolvido/pago)
            </Label>
          </div>

          {/* Loan options */}
          {isLoan && (
            <div className="space-y-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Registrar como Conta a Pagar?
              </p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="expense-option"
                    checked={wantsExpense === 'create'}
                    onChange={() => setWantsExpense('create')}
                    className="accent-primary"
                  />
                  <span className="text-sm">Criar nova conta a pagar</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="expense-option"
                    checked={wantsExpense === 'existing'}
                    onChange={() => setWantsExpense('existing')}
                    className="accent-primary"
                  />
                  <span className="text-sm">Já está registrada (vincular)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="expense-option"
                    checked={wantsExpense === 'none'}
                    onChange={() => setWantsExpense('none')}
                    className="accent-primary"
                  />
                  <span className="text-sm">Não registrar (apenas auditoria)</span>
                </label>
              </div>

              {/* Create new expense form */}
              {wantsExpense === 'create' && (
                <div className="space-y-3 pt-2 border-t border-amber-200 dark:border-amber-800">
                  <div>
                    <Label className="text-xs">Descrição da conta</Label>
                    <Input
                      value={expenseDescription}
                      onChange={(e) => setExpenseDescription(e.target.value)}
                      placeholder={`Pagamento: ${description || '...'}`}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Data de vencimento *</Label>
                    <Input
                      type="date"
                      value={expenseDueDate}
                      onChange={(e) => setExpenseDueDate(e.target.value)}
                      className="h-8 text-sm"
                      required
                    />
                  </div>

                  {/* Installments */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Parcelas</Label>
                      <Input
                        type="number"
                        min="1"
                        max="48"
                        value={expenseInstallments}
                        onChange={(e) => {
                          setExpenseInstallments(e.target.value);
                          setExpenseInstallmentValue(''); // reset custom value
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Valor por parcela</Label>
                      <CurrencyInput
                        value={effectiveInstallmentValue}
                        onChange={setExpenseInstallmentValue}
                        placeholder="Auto"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  {parseInt(expenseInstallments) > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {expenseInstallments}x de R$ {Number(effectiveInstallmentValue || 0).toFixed(2).replace('.', ',')} = R$ {(Number(effectiveInstallmentValue || 0) * (parseInt(expenseInstallments) || 1)).toFixed(2).replace('.', ',')} total
                    </p>
                  )}

                  <div>
                    <Label className="text-xs">Categoria</Label>
                    <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Fornecedor</Label>
                    <Select value={expenseSupplierId} onValueChange={setExpenseSupplierId}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Opcional..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Link existing expense */}
              {wantsExpense === 'existing' && (
                <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                  <Label className="text-xs">Selecione a despesa existente</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    O vínculo será registrado nas observações da despesa (sem alterar valores).
                  </p>
                  <Select value={linkedExpenseId} onValueChange={handleSelectExistingExpense}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Selecione a despesa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {groupedExpenses.map((exp) => (
                        <SelectItem key={exp.id} value={exp.id}>
                          {exp.description} - R$ {exp.totalAmount.toFixed(2).replace('.', ',')}
                          {exp.installments > 1 && ` (${exp.installments}x)`}
                          {` - ${exp.pendingCount} pendente${exp.pendingCount > 1 ? 's' : ''}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Inserir no Caixa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
