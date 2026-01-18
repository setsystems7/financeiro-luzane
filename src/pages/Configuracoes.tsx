import { Card, CardContent } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function Configuracoes() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold">Configurações</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Settings className="h-16 w-16 text-muted-foreground/50" />
          <p className="mt-4 text-lg text-muted-foreground">Configurações em desenvolvimento</p>
        </CardContent>
      </Card>
    </div>
  );
}
