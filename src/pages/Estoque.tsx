import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Minus, Package, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Estoque() {
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustmentType, setAdjustmentType] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(1);
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: productSizes, isLoading } = useQuery({
    queryKey: ['stock', search],
    queryFn: async () => {
      let query = supabase
        .from('product_sizes')
        .select(`
          id,
          size,
          quantity,
          barcode,
          products!inner(id, name, min_stock, is_active, categories(name))
        `)
        .eq('products.is_active', true)
        .order('products(name)');

      if (search) {
        query = query.ilike('products.name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: movements } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products(name),
          product_sizes(size)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const currentQty = selectedProduct.quantity;
      let newQty = currentQty;

      if (adjustmentType === 'entrada') {
        newQty = currentQty + adjustmentQuantity;
      } else if (adjustmentType === 'saida') {
        newQty = Math.max(0, currentQty - adjustmentQuantity);
      } else {
        newQty = adjustmentQuantity;
      }

      const { error: updateError } = await supabase
        .from('product_sizes')
        .update({ quantity: newQty })
        .eq('id', selectedProduct.id);

      if (updateError) throw updateError;

      const { error: movementError } = await supabase.from('stock_movements').insert({
        product_id: selectedProduct.products.id,
        product_size_id: selectedProduct.id,
        type: adjustmentType,
        quantity: adjustmentType === 'ajuste' ? newQty - currentQty : adjustmentQuantity,
        notes: adjustmentNotes || null,
        user_id: user?.id,
      });

      if (movementError) throw movementError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast.success('Estoque ajustado com sucesso!');
      setIsAdjustOpen(false);
      setSelectedProduct(null);
      setAdjustmentQuantity(1);
      setAdjustmentNotes('');
    },
    onError: (error: any) => {
      toast.error('Erro ao ajustar estoque', { description: error.message });
    },
  });

  const lowStock = productSizes?.filter((ps: any) => ps.quantity <= ps.products.min_stock) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Estoque</h1>
        <p className="text-muted-foreground">Controle de estoque e movimentações</p>
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Estoque Atual</TabsTrigger>
          <TabsTrigger value="low-stock" className="flex items-center gap-2">
            Estoque Baixo
            {lowStock.length > 0 && (
              <Badge variant="destructive" className="ml-1">{lowStock.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Mín.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : productSizes?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-2 text-muted-foreground">Nenhum produto encontrado</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    productSizes?.map((ps: any) => {
                      const isLow = ps.quantity <= ps.products.min_stock;
                      return (
                        <TableRow key={ps.id}>
                          <TableCell className="font-medium">{ps.products.name}</TableCell>
                          <TableCell>{ps.products.categories?.name || '-'}</TableCell>
                          <TableCell>{ps.size}</TableCell>
                          <TableCell>
                            <span className={isLow ? 'text-destructive font-bold' : ''}>
                              {ps.quantity}
                            </span>
                          </TableCell>
                          <TableCell>{ps.products.min_stock}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProduct(ps);
                                setIsAdjustOpen(true);
                              }}
                            >
                              Ajustar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="low-stock">
          <Card className="border-warning/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-5 w-5" />
                Produtos com Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Mínimo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-2 text-muted-foreground">Nenhum produto com estoque baixo</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    lowStock.map((ps: any) => (
                      <TableRow key={ps.id}>
                        <TableCell className="font-medium">{ps.products.name}</TableCell>
                        <TableCell>{ps.size}</TableCell>
                        <TableCell className="text-destructive font-bold">{ps.quantity}</TableCell>
                        <TableCell>{ps.products.min_stock}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedProduct(ps);
                              setAdjustmentType('entrada');
                              setIsAdjustOpen(true);
                            }}
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Entrada
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>Últimas Movimentações</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements?.map((mov: any) => (
                    <TableRow key={mov.id}>
                      <TableCell>
                        {new Date(mov.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{mov.products?.name}</TableCell>
                      <TableCell>{mov.product_sizes?.size}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            mov.type === 'entrada'
                              ? 'default'
                              : mov.type === 'saida'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className={mov.type === 'entrada' ? 'bg-success' : ''}
                        >
                          {mov.type === 'entrada' && <ArrowUp className="mr-1 h-3 w-3" />}
                          {mov.type === 'saida' && <ArrowDown className="mr-1 h-3 w-3" />}
                          {mov.type.charAt(0).toUpperCase() + mov.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{mov.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">{mov.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjustment Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Estoque</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">{selectedProduct.products.name}</p>
                <p className="text-sm text-muted-foreground">
                  Tamanho: {selectedProduct.size} • Atual: {selectedProduct.quantity}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Ajuste</Label>
                <Select
                  value={adjustmentType}
                  onValueChange={(v) => setAdjustmentType(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada (adicionar)</SelectItem>
                    <SelectItem value="saida">Saída (remover)</SelectItem>
                    <SelectItem value="ajuste">Ajuste (definir valor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {adjustmentType === 'ajuste' ? 'Nova Quantidade' : 'Quantidade'}
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={adjustmentQuantity}
                  onChange={(e) => setAdjustmentQuantity(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Input
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  placeholder="Motivo do ajuste..."
                />
              </div>

              <Button
                className="w-full"
                onClick={() => adjustMutation.mutate()}
                disabled={adjustMutation.isPending}
              >
                {adjustMutation.isPending ? 'Salvando...' : 'Salvar Ajuste'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
