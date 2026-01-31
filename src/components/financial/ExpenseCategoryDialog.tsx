import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Tag } from 'lucide-react';
import { useCreateExpenseCategory, useUpdateExpenseCategory } from '@/hooks/useExpenseCategories';

interface ExpenseCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (categoryId: string, categoryName: string) => void;
  editCategory?: { id: string; name: string } | null;
}

export function ExpenseCategoryDialog({ open, onOpenChange, onSuccess, editCategory }: ExpenseCategoryDialogProps) {
  const [name, setName] = useState('');
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();

  useEffect(() => {
    if (editCategory) {
      setName(editCategory.name);
    } else {
      setName('');
    }
  }, [editCategory, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editCategory) {
      updateCategory.mutate(
        { id: editCategory.id, name: name.trim() },
        {
          onSuccess: (category) => {
            setName('');
            onOpenChange(false);
            onSuccess?.(category.id, category.name);
          },
        }
      );
    } else {
      createCategory.mutate(name.trim(), {
        onSuccess: (category) => {
          setName('');
          onOpenChange(false);
          onSuccess?.(category.id, category.name);
        },
      });
    }
  };

  const isLoading = createCategory.isPending || updateCategory.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-pink-primary" />
            {editCategory ? 'Editar Categoria' : 'Nova Categoria de Despesa'}
          </DialogTitle>
          <DialogDescription>
            {editCategory ? 'Atualize o nome da categoria.' : 'Adicione uma nova categoria para organizar suas despesas.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expense-category-name">Nome da Categoria *</Label>
            <Input
              id="expense-category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Aluguel"
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="pink" disabled={isLoading || !name.trim()}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editCategory ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
