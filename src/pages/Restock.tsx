import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Restock() {
  return (
    <MainLayout title="Reposição" subtitle="Controle de reposição">
      <Card>
        <CardHeader>
          <CardTitle>Sugestões de Reposição</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página de reposição em desenvolvimento.</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
