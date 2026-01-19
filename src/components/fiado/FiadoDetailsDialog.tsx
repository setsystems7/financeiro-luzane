import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign,
  User,
  Phone,
  CreditCard,
  Calendar,
  Package,
  Plus
} from 'lucide-react';
import { useFiadoSale, useRegisterFiadoPayment } from '@/hooks/useFiado';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FiadoDetailsDialogProps {
  saleId: string;
  open: boolean;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500' },
  aprovado: { label: 'Aprovado', color: 'bg-blue-500' },
  pago: { label: 'Pago', color: 'bg-green-500' },
  cancelado: { label: 'Cancelado', color: 'bg-red-500' },
};

export function FiadoDetailsDialog({ saleId, open, onClose }: FiadoDetailsDialogProps) {
  const { data: sale, isLoading } = useFiadoSale(saleId);
  const registerPayment = useRegisterFiadoPayment();

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');

  if (isLoading || !sale) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <div className="text-center py-8">Carregando...</div>
        </DialogContent>
      </Dialog>
    );
  }

  const status = statusConfig[sale.status] || statusConfig.pendente;
  const canReceivePayment = (sale.status === 'aprovado' || sale.status === 'pendente') && Number(sale.amount_pending) > 0;

  const handlePayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    await registerPayment.mutateAsync({
      fiado_sale_id: sale.id,
      amount,
      payment_method: paymentMethod,
    });

    setPaymentAmount('');
    setShowPaymentForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Venda Fiado
            <Badge className={`${status.color} text-white`}>
              {status.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-sm md:text-base">
                <User className="w-4 h-4 flex-shrink-0" />
                Cliente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <p className="font-medium">{sale.customer_name}</p>
                </div>
                {sale.customer_phone && (
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Telefone:
                    </span>
                    <p className="font-medium">{sale.customer_phone}</p>
                  </div>
                )}
                {sale.customer_cpf && (
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> CPF:
                    </span>
                    <p className="font-medium">{sale.customer_cpf}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Data:
                  </span>
                  <p className="font-medium">
                    {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="w-4 h-4" />
                Itens ({sale.fiado_sale_items?.length || 0})
              </h3>
              <div className="space-y-2">
                {sale.fiado_sale_items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-2 bg-muted/50 rounded"
                  >
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Tam: {item.size} | Qtd: {item.quantity} x R$ {Number(item.unit_price).toFixed(2)}
                      </p>
                    </div>
                    <span className="font-medium">
                      R$ {Number(item.total).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Financial Summary */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Valores
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total da Venda:</span>
                  <span className="font-bold">R$ {Number(sale.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Parcelas:</span>
                  <span>{sale.installments}x de R$ {(Number(sale.total) / sale.installments).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Total Pago:</span>
                  <span className="font-medium">R$ {Number(sale.amount_paid).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-orange-600">
                  <span>Pendente:</span>
                  <span className="font-medium">R$ {Number(sale.amount_pending).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment History */}
            {sale.fiado_payments && sale.fiado_payments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold">Histórico de Pagamentos</h3>
                  <div className="space-y-2">
                    {sale.fiado_payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {payment.payment_method}
                          </p>
                        </div>
                        <span className="font-bold text-green-600">
                          + R$ {Number(payment.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Payment Form */}
            {canReceivePayment && (
              <>
                <Separator />
                <div className="space-y-3">
                  {!showPaymentForm ? (
                    <Button
                      onClick={() => setShowPaymentForm(true)}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Registrar Pagamento
                    </Button>
                  ) : (
                    <div className="space-y-4 p-3 md:p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-semibold text-sm md:text-base">Novo Pagamento</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                        <div>
                          <Label className="text-xs md:text-sm">Valor</Label>
                          <Input
                            type="number"
                            placeholder={`Máx: R$ ${Number(sale.amount_pending).toFixed(2)}`}
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            max={Number(sale.amount_pending)}
                            step="0.01"
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs md:text-sm">Forma de Pagamento</Label>
                          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                              <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          onClick={handlePayment}
                          disabled={registerPayment.isPending}
                          className="flex-1 text-sm"
                        >
                          {registerPayment.isPending ? 'Registrando...' : 'Confirmar Pagamento'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowPaymentForm(false);
                            setPaymentAmount('');
                          }}
                          className="text-sm"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Notes */}
            {sale.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold">Observações</h3>
                  <p className="text-sm text-muted-foreground">{sale.notes}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
