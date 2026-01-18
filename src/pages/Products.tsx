import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Products() {
  return (
    <MainLayout title="Produtos" subtitle="Gerencie seus produtos">
      <Card>
        <CardHeader>
          <CardTitle>Lista de Produtos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página de produtos em desenvolvimento.</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
