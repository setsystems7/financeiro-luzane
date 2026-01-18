import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Reports() {
  return (
    <MainLayout title="Relatórios" subtitle="Relatórios e análises">
      <Card>
        <CardHeader>
          <CardTitle>Relatórios do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página de relatórios em desenvolvimento.</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
