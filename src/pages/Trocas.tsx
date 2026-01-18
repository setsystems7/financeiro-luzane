import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Trocas() {
  const [search, setSearch] = useState('');

  const { data: exchanges, isLoading } = useQuery({
    queryKey: ['exchanges', search],
    queryFn: async () => {
      let query = supabase
        .from('exchanges')
        .select(`
          *,
          exchange_items(*)
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('customer_name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Trocas</h1>
        <p className="text-muted-foreground">Histórico de trocas e devoluções</p>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead>Usado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : exchanges?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <ArrowLeftRight className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-2 text-muted-foreground">Nenhuma troca registrada</p>
                  </TableCell>
                </TableRow>
              ) : (
                exchanges?.map((exchange) => (
                  <TableRow key={exchange.id}>
                    <TableCell>
                      {format(new Date(exchange.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{exchange.customer_name || 'Não informado'}</p>
                        {exchange.customer_phone && (
                          <p className="text-xs text-muted-foreground">{exchange.customer_phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{exchange.exchange_items?.length || 0} itens</TableCell>
                    <TableCell className="font-medium">{formatCurrency(exchange.credit_amount)}</TableCell>
                    <TableCell>{formatCurrency(exchange.credit_used || 0)}</TableCell>
                    <TableCell>
                      {exchange.is_active ? (
                        <Badge className="bg-success">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Usado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {exchange.reason || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
