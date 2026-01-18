import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Exchanges() {
  return (
    <MainLayout title="Trocas" subtitle="Gestão de trocas">
      <Card>
        <CardHeader>
          <CardTitle>Trocas e Devoluções</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página de trocas em desenvolvimento.</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
