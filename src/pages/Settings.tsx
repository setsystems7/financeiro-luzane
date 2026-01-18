import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Settings() {
  return (
    <MainLayout title="Configurações" subtitle="Configurações do sistema">
      <Card>
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Página de configurações em desenvolvimento.</p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
