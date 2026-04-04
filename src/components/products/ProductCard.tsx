import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  color: string;
  supplier: string;
  costPrice: number;
  salePrice: number;
  markup: number | null;
  minStock: number;
  photo?: string | null;
  createdAt: Date;
  sizes: { size: string; quantity: number; barcode: string }[];
}

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

export function ProductCard({ product, onEdit, onDelete }: ProductCardProps) {
  const totalStock = product.sizes.reduce((acc, size) => acc + size.quantity, 0);
  const isLowStock = totalStock <= product.minStock;
  const sizesWithStock = product.sizes.filter(s => s.quantity > 0);

  return (
    <Card variant="elevated" className="card-interactive group overflow-hidden">
      {/* Compact header with stock badge */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground truncate text-sm leading-tight">{product.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{product.category}{product.color ? ` • ${product.color}` : ''}</p>
        </div>
        <Badge variant={isLowStock ? 'destructive' : 'success'} className="shrink-0 text-xs">
          {totalStock} un.
        </Badge>
      </div>

      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        {/* Sizes */}
        <div className="flex flex-wrap gap-1.5">
          {product.sizes.map((size, index) => (
            <div
              key={size.size}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-all duration-200 hover:scale-105 ${
                size.quantity > 0
                  ? 'bg-muted border-border'
                  : 'bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-950 dark:border-orange-800'
              }`}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <span className="font-medium">{size.size}</span>
              <span className={`${size.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'} font-bold`}>
                ({size.quantity})
              </span>
            </div>
          ))}
        </div>

        {/* Price & Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Preço de venda</p>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(product.salePrice)}
            </p>
          </div>
          <div className="flex gap-1 opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
            <Button variant="ghost" size="icon" onClick={() => onEdit(product)} className="hover-pop">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(product.id)} className="hover-pop">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
