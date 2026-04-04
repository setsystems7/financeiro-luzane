import { useState } from 'react';
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
  const { data: pendingExpenses = [] } = useQuery({
    queryKey: ['pending-expenses-for-link'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, description, amount, due_date, status')
        .in('status', ['pendente', 'vencido'])
        .order('due_date', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoan, setIsLoan] = useState(false);
  const [wantsExpense, setWantsExpense] = useState<'none' | 'create' | 'existing'>('none');
  const [loading, setLoading] = useState(false);

  // Expense fields (when creating new)
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDueDate, setExpenseDueDate] = useState('');
  const [expenseSupplierId, setExpenseSupplierId] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Link existing expense
  const [linkedExpenseId, setLinkedExpenseId] = useState('');

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
    setExpenseNotes('');
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

      // 2. If loan + create expense
      if (isLoan && wantsExpense === 'create') {
        const { error: expError } = await supabase.from('expenses').insert({
          description: expenseDescription || `Pagamento: ${description}`,
          amount: numAmount,
          category: expenseCategory || null,
          due_date: expenseDueDate,
          supplier_id: expenseSupplierId || null,
          notes: expenseNotes || `Ref. empréstimo: ${description}`,
          status: 'pendente',
        });
        if (expError) throw expError;
        toast.success('Valor inserido no caixa e conta a pagar registrada!');
      } else if (isLoan && wantsExpense === 'existing') {
        // Just link via notes for audit - don't change expense values
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
                  <Select value={linkedExpenseId} onValueChange={setLinkedExpenseId}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Buscar despesa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Will show pending/overdue expenses */}
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
