import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Labels() {
  return (
    <MainLayout title="Etiquetas" subtitle="Impressão de etiquetas">
      <Card>
        <CardHeader>
          <CardTitle>Geração de Etiquetas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página de etiquetas em desenvolvimento.</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
