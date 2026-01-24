import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Tag } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUpdateCategory } from '@/hooks/useProducts';

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (categoryId: string) => void;
  editCategory?: { id: string; name: string } | null;
}

export function CategoryDialog({ open, onOpenChange, onSuccess, editCategory }: CategoryDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const updateCategory = useUpdateCategory();

  useEffect(() => {
    if (editCategory) {
      setName(editCategory.name);
    } else {
      setName('');
    }
  }, [editCategory, open]);

  const createCategory = useMutation({
    mutationFn: async (categoryName: string) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name: categoryName })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria criada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating category:', error);
      toast.error('Erro ao criar categoria');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editCategory) {
      updateCategory.mutate(
        { id: editCategory.id, name: name.trim() },
        {
          onSuccess: (category) => {
            setName('');
            onOpenChange(false);
            onSuccess?.(category.id);
          },
        }
      );
    } else {
      createCategory.mutate(name.trim(), {
        onSuccess: (category) => {
          setName('');
          onOpenChange(false);
          onSuccess?.(category.id);
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
            {editCategory ? 'Editar Categoria' : 'Nova Categoria'}
          </DialogTitle>
          <DialogDescription>
            {editCategory ? 'Atualize o nome da categoria.' : 'Adicione uma nova categoria para organizar seus produtos.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Nome da Categoria *</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Leggings"
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
