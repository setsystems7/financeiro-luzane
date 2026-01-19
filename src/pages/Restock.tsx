import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  RefreshCw, Search, Package, AlertTriangle, TrendingDown, 
  DollarSign, Check, X, PackagePlus, Clock, AlertCircle
} from 'lucide-react';
import { 
  usePurchaseSuggestions, 
  useRestockSummary, 
  useGenerateSuggestions,
  useUpdateSuggestionStatus,
  useCreateStockEntry,
  PurchaseSuggestion
} from '@/hooks/useRestock';
import { useLowStockProducts } from '@/hooks/useStock';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Restock() {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const { data: suggestions = [], isLoading } = usePurchaseSuggestions(statusFilter);
  const { data: summary } = useRestockSummary();
  const { data: lowStockProducts = [] } = useLowStockProducts();
  const generateSuggestions = useGenerateSuggestions();
  const updateStatus = useUpdateSuggestionStatus();
  const createEntry = useCreateStockEntry();

  const [searchTerm, setSearchTerm] = useState('');
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PurchaseSuggestion | null>(null);
  const [entryQuantity, setEntryQuantity] = useState('');

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredSuggestions = useMemo(() => {
    if (!searchTerm) return suggestions;
    const term = searchTerm.toLowerCase();
    return suggestions.filter(s =>
      s.products?.name?.toLowerCase().includes(term) ||
      s.suppliers?.name?.toLowerCase().includes(term)
    );
  }, [suggestions, searchTerm]);

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Crítico</Badge>;
      case 'high':
        return <Badge className="bg-amber-500 gap-1"><AlertTriangle className="w-3 h-3" /> Alto</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500 gap-1"><Clock className="w-3 h-3" /> Médio</Badge>;
      default:
        return <Badge variant="secondary">Baixo</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ordered':
        return <Badge className="bg-blue-500">Pedido</Badge>;
      case 'ignored':
        return <Badge variant="secondary">Ignorado</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const handleOpenEntry = (suggestion: PurchaseSuggestion) => {
    setSelectedSuggestion(suggestion);
    setEntryQuantity(suggestion.suggested_quantity.toString());
    setIsEntryDialogOpen(true);
  };

  const handleConfirmEntry = async () => {
    if (!selectedSuggestion) return;

    const qty = parseInt(entryQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }

    await createEntry.mutateAsync({
      suggestion: selectedSuggestion,
      quantity: qty,
    });

    setIsEntryDialogOpen(false);
    setSelectedSuggestion(null);
  };

  return (
    <MainLayout title="Reposição" subtitle="Gestão inteligente de reposição de estoque">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="opacity-0 animate-fade-in-up stagger-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Produtos com Estoque Baixo</p>
                  <p className="text-2xl font-bold text-destructive">{lowStockProducts.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sugestões Críticas</p>
                  <p className="text-2xl font-bold text-amber-500">{summary?.criticalCount || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sugestões Pendentes</p>
                  <p className="text-2xl font-bold">{summary?.pendingCount || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="opacity-0 animate-fade-in-up stagger-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Custo Estimado</p>
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(summary?.totalEstimatedCost || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between opacity-0 animate-fade-in-up stagger-5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por produto ou fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="ordered">Pedido</SelectItem>
                <SelectItem value="ignored">Ignorado</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => generateSuggestions.mutate()}
              disabled={generateSuggestions.isPending}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${generateSuggestions.isPending ? 'animate-spin' : ''}`} />
              Gerar Sugestões
            </Button>
          </div>
        </div>

        {/* Low Stock Quick View */}
        {lowStockProducts.length > 0 && (
          <Card className="border-amber-500/50 opacity-0 animate-fade-in-up stagger-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Produtos com Estoque Crítico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {lowStockProducts.slice(0, 10).map((product: any) => (
                  <Badge key={product.id} variant="outline" className="py-1.5">
                    {product.name} ({product.totalStock}/{product.minStock})
                  </Badge>
                ))}
                {lowStockProducts.length > 10 && (
                  <Badge variant="secondary">+{lowStockProducts.length - 10} mais</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Suggestions Table */}
        <Card className="opacity-0 animate-fade-in-up stagger-7">
          <CardHeader>
            <CardTitle className="text-lg">Sugestões de Reposição</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Nenhuma sugestão encontrada</p>
                <p className="text-sm mt-2">Clique em "Gerar Sugestões" para analisar o estoque</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-center">Estoque Atual</TableHead>
                    <TableHead className="text-center">Sugerido</TableHead>
                    <TableHead className="text-center">Dias p/ Esgotar</TableHead>
                    <TableHead>Urgência</TableHead>
                    <TableHead className="text-right">Custo Est.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuggestions.map((suggestion) => (
                    <TableRow key={suggestion.id}>
                      <TableCell className="font-medium">
                        {suggestion.products?.name || 'Produto'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {suggestion.suppliers?.name || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={suggestion.current_stock <= 0 ? 'text-destructive font-bold' : ''}>
                          {suggestion.current_stock}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {suggestion.suggested_quantity}
                      </TableCell>
                      <TableCell className="text-center">
                        {suggestion.days_until_stockout !== null ? (
                          <span className={suggestion.days_until_stockout <= 7 ? 'text-destructive font-bold' : ''}>
                            {suggestion.days_until_stockout > 30 ? '30+' : suggestion.days_until_stockout}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{getUrgencyBadge(suggestion.urgency)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(suggestion.estimated_cost)}
                      </TableCell>
                      <TableCell>{getStatusBadge(suggestion.status)}</TableCell>
                      <TableCell className="text-right">
                        {suggestion.status === 'pending' && (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatus.mutate({ id: suggestion.id, status: 'ordered' })}
                              title="Marcar como Pedido"
                            >
                              <Check className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatus.mutate({ id: suggestion.id, status: 'ignored' })}
                              title="Ignorar"
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                        {suggestion.status === 'ordered' && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenEntry(suggestion)}
                            className="gap-1"
                          >
                            <PackagePlus className="w-3 h-3" />
                            Entrada
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Entry Dialog */}
        <Dialog open={isEntryDialogOpen} onOpenChange={setIsEntryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Entrada de Estoque</DialogTitle>
            </DialogHeader>

            {selectedSuggestion && (
              <div className="space-y-6 py-4">
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="font-medium">{selectedSuggestion.products?.name}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Estoque atual:</span>
                      <span className="ml-2 font-medium">{selectedSuggestion.current_stock}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sugerido:</span>
                      <span className="ml-2 font-medium">{selectedSuggestion.suggested_quantity}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Quantidade Recebida</Label>
                  <Input
                    type="number"
                    min={1}
                    value={entryQuantity}
                    onChange={(e) => setEntryQuantity(e.target.value)}
                    placeholder="Quantidade"
                  />
                </div>

                <Button
                  onClick={handleConfirmEntry}
                  disabled={createEntry.isPending}
                  className="w-full"
                >
                  {createEntry.isPending ? 'Registrando...' : 'Confirmar Entrada'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
