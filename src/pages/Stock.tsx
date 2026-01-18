import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Stock() {
  return (
    <MainLayout title="Estoque" subtitle="Controle de estoque">
      <Card>
        <CardHeader>
          <CardTitle>Movimentações de Estoque</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página de estoque em desenvolvimento.</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
