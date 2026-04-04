import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface LowStockProduct {
  id: string;
  name: string;
  totalStock: number;
  minStock: number;
}

interface DashboardDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'low-stock' | null;
  lowStockProducts?: LowStockProduct[];
}

export function DashboardDrilldownDialog({ open, onOpenChange, type, lowStockProducts = [] }: DashboardDrilldownDialogProps) {
  const navigate = useNavigate();
  
  if (!type) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Produtos com Estoque Baixo</span>
            <Button variant="ghost" size="sm" onClick={() => { onOpenChange(false); navigate('/estoque'); }}>
              <ExternalLink className="w-4 h-4 mr-1" />
              Ver Estoque
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 overflow-y-auto max-h-[60vh]">
          {lowStockProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Todos os produtos estão com estoque adequado!</p>
          ) : (
            lowStockProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
                <div>
                  <p className="text-sm font-medium text-foreground">{product.name}</p>
                  <p className="text-xs text-muted-foreground">Mínimo: {product.minStock} un.</p>
                </div>
                <Badge variant="destructive">{product.totalStock} un.</Badge>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
