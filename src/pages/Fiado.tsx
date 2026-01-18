import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Fiado() {
  return (
    <MainLayout title="Fiado" subtitle="Vendas fiado">
      <Card>
        <CardHeader>
          <CardTitle>Controle de Fiado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página de fiado em desenvolvimento.</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
