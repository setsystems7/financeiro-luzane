import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { useFiadoSale, useUpdateFiadoSale } from '@/hooks/useFiado';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface FiadoEditDialogProps {
  saleId: string;
  open: boolean;
  onClose: () => void;
}

export function FiadoEditDialog({ saleId, open, onClose }: FiadoEditDialogProps) {
  const { data: sale, isLoading } = useFiadoSale(saleId);
  const updateFiadoSale = useUpdateFiadoSale();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [installments, setInstallments] = useState('1');

  useEffect(() => {
    if (sale) {
      setCustomerName(sale.customer_name);
      setCustomerPhone(sale.customer_phone || '');
      setCustomerCpf(sale.customer_cpf || '');
      setNotes(sale.notes || '');
      setInstallments(String(sale.installments));
      if (sale.due_date) {
        setDueDate(new Date(sale.due_date + 'T12:00:00'));
      }
    }
  }, [sale]);

  const handleSave = async () => {
    if (!customerName.trim()) return;

    await updateFiadoSale.mutateAsync({
      id: saleId,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_cpf: customerCpf.trim(),
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
      notes: notes.trim(),
      installments: parseInt(installments) || 1,
    });

    onClose();
  };

  if (isLoading || !sale) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <div className="text-center py-8">Carregando...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Editar Venda Fiado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome do Cliente *</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Telefone</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div>
              <Label>CPF</Label>
              <Input
                value={customerCpf}
                onChange={(e) => setCustomerCpf(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Data de Vencimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Parcelas</Label>
            <Select value={installments} onValueChange={setInstallments}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                  <SelectItem key={n} value={String(n)}>
                    {n}x de R$ {(Number(sale.total) / n).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={updateFiadoSale.isPending || !customerName.trim()}
              className="flex-1"
            >
              {updateFiadoSale.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
