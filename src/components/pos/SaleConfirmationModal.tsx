import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SaleConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  saleData: {
    items: { product_name: string; size: string | null; quantity: number; total: number }[];
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: string;
    cardBrand?: string;
    installments?: number;
    feeAmount?: number;
    customerTotal?: number;
    // optional historical fields
    saleNumber?: number | null;
    createdAt?: string | null;
  } | null;
}

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_debito: 'Débito',
  cartao_credito: 'Crédito',
  crediario: 'Crediário',
};

export function SaleConfirmationModal({ open, onClose, saleData }: SaleConfirmationModalProps) {
  if (!saleData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            {saleData.createdAt ? (
              <Receipt className="w-6 h-6" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
            {saleData.createdAt ? (
              <span>
                Comprovante {saleData.saleNumber ? `#${saleData.saleNumber}` : ''}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {format(new Date(saleData.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </span>
            ) : (
              'Venda Finalizada!'
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Items */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Itens vendidos</p>
            {saleData.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="truncate">{item.product_name}</span>
                  {item.size && <Badge variant="outline" className="text-[10px] shrink-0">{item.size}</Badge>}
                  <span className="text-muted-foreground shrink-0">x{item.quantity}</span>
                </div>
                <span className="font-medium shrink-0 ml-2">R$ {formatCurrency(item.total)}</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-1.5">
            {saleData.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>R$ {formatCurrency(saleData.subtotal)}</span>
              </div>
            )}
            {saleData.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto</span>
                <span>-R$ {formatCurrency(saleData.discount)}</span>
              </div>
            )}
            {saleData.feeAmount && saleData.feeAmount > 0 && (
              <div className="flex justify-between text-sm text-amber-500">
                <span>Taxa do cartão</span>
                <span>+R$ {formatCurrency(saleData.feeAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1">
              <span>Total</span>
              <span className="text-primary">R$ {formatCurrency(saleData.customerTotal || saleData.total)}</span>
            </div>
          </div>

          <Separator />

          {/* Payment */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Pagamento</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {paymentLabels[saleData.paymentMethod] || saleData.paymentMethod}
              </Badge>
              {saleData.cardBrand && (
                <Badge variant="outline">{saleData.cardBrand}</Badge>
              )}
              {saleData.installments && saleData.installments > 1 && (
                <Badge variant="outline">{saleData.installments}x</Badge>
              )}
            </div>
          </div>

          <Button onClick={onClose} className="w-full" variant="pink">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
