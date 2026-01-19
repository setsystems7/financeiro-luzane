import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FiadoPOS } from '@/components/fiado/FiadoPOS';
import { FiadoList } from '@/components/fiado/FiadoList';
import { ShoppingCart, ClipboardList } from 'lucide-react';

export default function Fiado() {
  const [activeTab, setActiveTab] = useState('nova-venda');

  return (
    <MainLayout title="Venda Fiado" subtitle="Gerencie vendas a prazo com promissória">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="nova-venda" className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Nova Venda
          </TabsTrigger>
          <TabsTrigger value="vendas" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Vendas Fiado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nova-venda">
          <FiadoPOS onSaleComplete={() => setActiveTab('vendas')} />
        </TabsContent>

        <TabsContent value="vendas">
          <FiadoList />
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
