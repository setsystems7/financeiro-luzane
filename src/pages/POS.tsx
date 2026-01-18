import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function POS() {
  return (
    <MainLayout title="PDV" subtitle="Ponto de Venda">
      <Card>
        <CardHeader>
          <CardTitle>Ponto de Venda</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Sistema PDV em desenvolvimento.</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
