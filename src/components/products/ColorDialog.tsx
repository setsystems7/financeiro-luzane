import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Palette } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ColorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (colorId: string) => void;
}

export function ColorDialog({ open, onOpenChange, onSuccess }: ColorDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const createColor = useMutation({
    mutationFn: async (colorName: string) => {
      const { data, error } = await supabase
        .from('colors')
        .insert({ name: colorName })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colors'] });
      toast.success('Cor criada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating color:', error);
      toast.error('Erro ao criar cor');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createColor.mutate(name.trim(), {
      onSuccess: (color) => {
        setName('');
        onOpenChange(false);
        onSuccess?.(color.id);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-pink-primary" />
            Nova Cor
          </DialogTitle>
          <DialogDescription>Adicione uma nova cor para seus produtos.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="color-name">Nome da Cor *</Label>
            <Input
              id="color-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Rosa Pink"
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="pink" disabled={createColor.isPending || !name.trim()}>
              {createColor.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
