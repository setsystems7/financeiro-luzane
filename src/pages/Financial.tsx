import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Financial() {
  return (
    <MainLayout title="Financeiro" subtitle="Gestão financeira">
      <Card>
        <CardHeader>
          <CardTitle>Controle Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página financeira em desenvolvimento.</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
