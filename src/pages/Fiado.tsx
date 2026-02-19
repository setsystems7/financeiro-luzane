import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FiadoPOS } from '@/components/fiado/FiadoPOS';
import { FiadoList } from '@/components/fiado/FiadoList';
import { ShoppingCart, ClipboardList, HelpCircle, DollarSign, Pencil, MessageCircle } from 'lucide-react';
import { type SupportSection } from '@/components/layout/SupportButton';

const fiadoSupportSections: SupportSection[] = [
  { title: 'O que é o módulo Fiado', icon: HelpCircle, content: 'O módulo Fiado permite registrar vendas a prazo (fiado/promissória) para clientes que pagarão depois. Você controla quem deve, quanto deve e quando vence.' },
  { title: 'Como criar uma venda fiado', icon: ShoppingCart, content: 'Na aba "Nova Venda", busque e adicione os produtos ao carrinho. Informe o nome do cliente, telefone, CPF (opcional), data de vencimento e número de parcelas. Finalize a venda para registrar.' },
  { title: 'Como registrar pagamento', icon: DollarSign, content: 'Na aba "Vendas Fiado", clique em "Registrar Pagamento" ao lado da venda. Informe o valor pago e o método de pagamento. Pagamentos parciais são permitidos.' },
  { title: 'Status das vendas', icon: ClipboardList, content: '• Pendente: nenhum pagamento realizado.\n• Parcial: pagamento parcial feito, ainda há saldo devedor.\n• Atrasado: a data de vencimento passou sem pagamento total.\n• Pago: valor total quitado.\n• Cancelado: venda cancelada (estoque devolvido).' },
  { title: 'Como editar ou cancelar uma venda', icon: Pencil, content: 'Use o botão de editar (lápis) para alterar dados da venda. Para cancelar, clique no X vermelho - o sistema pedirá confirmação e devolverá o estoque automaticamente.' },
  { title: 'Dicas de cobrança', icon: MessageCircle, content: 'O sistema mostra alertas de fiados vencendo nos próximos 3 dias. Use o botão de WhatsApp ao lado de cada venda para enviar uma mensagem de cobrança diretamente ao cliente.' },
];

export default function Fiado() {
  const [activeTab, setActiveTab] = useState('nova-venda');

  return (
    <MainLayout title="Venda Fiado" subtitle="Gerencie vendas a prazo com promissória" supportContent={{ moduleName: 'Fiado', sections: fiadoSupportSections }}>
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
