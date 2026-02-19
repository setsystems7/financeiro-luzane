import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FiadoPOS } from '@/components/fiado/FiadoPOS';
import { FiadoList } from '@/components/fiado/FiadoList';
import { ShoppingCart, ClipboardList, HelpCircle, DollarSign, Pencil, MessageCircle } from 'lucide-react';
import { type SupportSection } from '@/components/layout/SupportButton';

const fiadoSupportSections: SupportSection[] = [
  {
    title: 'O que é o módulo Fiado',
    icon: HelpCircle,
    tag: 'essencial',
    content: 'O módulo Fiado permite registrar vendas a prazo (fiado/promissória) para clientes que vão pagar depois. Aqui você controla quem deve, quanto deve, quando vence e registra pagamentos.',
  },
  {
    title: 'Como criar uma venda fiado',
    icon: ShoppingCart,
    tag: 'essencial',
    content: 'Siga os passos para registrar uma venda a prazo:',
    steps: [
      { text: 'Vá na aba "Nova Venda" (já é a aba padrão ao abrir o módulo).' },
      { text: 'Busque e adicione os produtos ao carrinho — funciona igual ao PDV.' },
      { text: 'Preencha os dados do cliente: Nome (obrigatório), Telefone e CPF (opcionais).', tip: 'O telefone é importante para cobrança por WhatsApp depois.' },
      { text: 'Defina a data de vencimento e o número de parcelas.' },
      { text: 'Adicione observações se necessário (ex: "combinado pagar dia 15").' },
      { text: 'Clique em "Finalizar Venda Fiado" para registrar.' },
    ],
    warning: 'A venda fiado desconta do estoque normalmente. O produto sai do estoque no momento do registro.',
  },
  {
    title: 'Como registrar pagamento',
    icon: DollarSign,
    tag: 'essencial',
    content: 'Quando o cliente pagar (parcial ou total):',
    steps: [
      { text: 'Vá na aba "Vendas Fiado" para ver a lista de vendas pendentes.' },
      { text: 'Encontre a venda do cliente e clique em "Registrar Pagamento".' },
      { text: 'Informe o valor que o cliente está pagando e o método de pagamento (dinheiro, PIX, etc.).' },
      { text: 'Confirme o pagamento. O saldo devedor será atualizado automaticamente.' },
    ],
    tips: [
      'Pagamentos parciais são permitidos — o saldo vai diminuindo a cada pagamento.',
      'Quando o valor total é quitado, o status muda automaticamente para "Pago".',
    ],
  },
  {
    title: 'Status das vendas fiado',
    icon: ClipboardList,
    content: 'Entenda cada status:',
    tips: [
      'Pendente: nenhum pagamento foi feito ainda.',
      'Parcial: o cliente já pagou parte, mas ainda deve.',
      'Atrasado: a data de vencimento passou e ainda há saldo devedor.',
      'Pago: o valor total foi quitado — tudo certo!',
      'Cancelado: venda cancelada — o estoque é devolvido automaticamente.',
    ],
  },
  {
    title: 'Como cobrar pelo WhatsApp',
    icon: MessageCircle,
    tag: 'dica',
    content: 'Use o recurso de cobrança rápida por WhatsApp:',
    steps: [
      { text: 'Na aba "Vendas Fiado", encontre a venda do cliente.' },
      { text: 'Clique no ícone do WhatsApp (💬) ao lado da venda.' },
      { text: 'Uma mensagem de cobrança será preparada automaticamente e o WhatsApp será aberto.' },
    ],
    tips: [
      'O sistema mostra alertas de fiados vencendo nos próximos 3 dias.',
      'Mantenha o telefone do cliente sempre atualizado para facilitar cobranças.',
    ],
  },
  {
    title: 'Como editar ou cancelar',
    icon: Pencil,
    content: 'Modifique ou cancele vendas fiado:',
    steps: [
      { text: 'Na lista de vendas, clique no ícone de lápis (✏️) para editar dados como nome, telefone ou observações.' },
      { text: 'Para cancelar, clique no X vermelho. O sistema pedirá confirmação.' },
    ],
    warning: 'Ao cancelar uma venda fiado, o estoque dos produtos é devolvido automaticamente.',
  },
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
