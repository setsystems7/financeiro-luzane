

# Plano de Melhorias do Sistema Luzane

Todas as melhorias serao implementadas em portugues (labels, textos, mensagens, conteudo de suporte).

---

## Etapa 1 - Infraestrutura Base

### 1.1 Integrar Header no MainLayout
- Modificar `MainLayout.tsx` para usar o componente `Header.tsx` existente
- Todas as paginas passam a exibir: usuario logado, sino de notificacoes, toggle de tema e logout

### 1.2 Criar componente ConfirmDialog
- Novo arquivo `src/components/ui/confirm-dialog.tsx`
- Baseado no AlertDialog do Radix ja instalado
- Props: `open`, `onConfirm`, `onCancel`, `title`, `description`, `confirmText`, `variant`
- Todos os textos padrao em portugues ("Confirmar", "Cancelar", "Tem certeza?")
- Substituira todos os `window.confirm()` do sistema:
  - `Financial.tsx`: estornar venda e excluir despesa
  - `FiadoList.tsx`: cancelar e excluir venda fiado

### 1.3 Criar componente SupportButton
- Novo arquivo `src/components/layout/SupportButton.tsx`
- Botao fixo no canto inferior direito com icone de interrogacao e texto "Suporte"
- Abre Sheet lateral com o nome do modulo, secoes em Accordion expansivel
- Cada secao tem titulo, icone e texto explicativo detalhado em portugues
- `MainLayout` recebe prop opcional `supportContent` para exibir o botao

---

## Etapa 2 - Financeiro e Produtos

### 2.1 Financeiro (Item 2)
- Paginacao nas tabelas de recebiveis e despesas (20 itens por pagina)
- Totalizadores no rodape das tabelas (soma dos valores filtrados)
- Substituir `confirm()` por ConfirmDialog
- Conteudo de suporte:
  - "O que e o modulo Financeiro"
  - "Como lancar uma despesa"
  - "Como registrar pagamento com juros"
  - "Como usar os filtros"
  - "Como importar planilha"
  - "Despesas recorrentes"
  - "Perguntas frequentes"

### 2.2 Produtos (Item 3)
- Adicionar filtro por cor e por fornecedor (Selects ao lado do filtro de categoria)
- Substituir `confirm()` de exclusao por ConfirmDialog
- Conteudo de suporte:
  - "O que e o modulo Produtos"
  - "Como cadastrar um produto"
  - "Como editar ou excluir"
  - "Como gerenciar tamanhos e codigos de barras"
  - "Como importar produtos por planilha"
  - "Como usar os filtros"

---

## Etapa 3 - Estoque, Fiado e Trocas

### 3.1 Estoque (Item 4)
- Filtro por produto e periodo no historico de movimentacoes
- Paginacao no historico
- Expandir linha do produto para ver estoque por tamanho
- Adicionar opcao de saida/ajuste manual de estoque
- Conteudo de suporte:
  - "O que e o modulo Estoque"
  - "Como dar entrada de estoque"
  - "Como registrar saida manual"
  - "Como usar o leitor de codigo de barras"
  - "Como exportar estoque para Excel"
  - "Historico de movimentacoes"

### 3.2 Fiado (Item 5)
- Busca por telefone e CPF alem do nome na lista
- Card de alerta para fiados vencendo nos proximos 3 dias
- Botao de WhatsApp para contato direto com cliente
- Substituir todos os `confirm()` por ConfirmDialog
- Conteudo de suporte:
  - "O que e o modulo Fiado"
  - "Como criar uma venda fiado"
  - "Como registrar pagamento"
  - "Status das vendas (pendente, parcial, atrasado, pago)"
  - "Como editar ou cancelar uma venda"
  - "Dicas de cobranca"

### 3.3 Trocas (Item 6)
- Conteudo de suporte:
  - "O que e o modulo Trocas"
  - "Como fazer uma troca"
  - "Como funciona a diferenca de valor"
  - "Historico de trocas"
  - "Perguntas frequentes"

---

## Etapa 4 - Dashboard, Relatorios, Configuracoes e demais modulos

### 4.1 Relatorios (Item 7)
- Grafico de barras de vendas por dia usando Recharts (ja instalado)
- Grafico de pizza de metodos de pagamento
- Filtro de periodo customizado com datas inicio e fim
- Incluir dados de juros no export financeiro
- Conteudo de suporte:
  - "O que e o modulo Relatorios"
  - "Relatorio de Vendas"
  - "Relatorio de Estoque"
  - "Relatorio Financeiro"
  - "Relatorio de Aging (vencimentos)"
  - "Como exportar para Excel"

### 4.2 Dashboard (Item 10)
- Seletor de periodo no topo (Hoje, 7 dias, 30 dias, 90 dias)
- Indicadores de tendencia nos StatsCards (ex: seta verde "+12% vs periodo anterior")
- Conteudo de suporte:
  - "O que e o Dashboard"
  - "Como interpretar os indicadores"
  - "Alertas de estoque baixo"
  - "Alertas de despesas vencidas"
  - "Resumo de vendas e trocas"

### 4.3 Configuracoes (Item 12)
- Botao de export/backup de dados (gera Excel com produtos, vendas, despesas)
- Campo de mensagem padrao para cobranca via WhatsApp
- Conteudo de suporte:
  - "O que e o modulo Configuracoes"
  - "Como alterar dados da loja"
  - "Como gerenciar usuarios"
  - "Como alterar senha"
  - "Como fazer backup dos dados"
  - "Notificacoes"

### 4.4 PDV - Suporte
- Conteudo de suporte:
  - "O que e o PDV"
  - "Como adicionar produtos ao carrinho"
  - "Como usar o leitor de codigo de barras"
  - "Metodos de pagamento"
  - "Como aplicar desconto"
  - "Taxas de cartao"

### 4.5 Etiquetas - Suporte
- Conteudo de suporte:
  - "O que e o modulo Etiquetas"
  - "Como selecionar produtos"
  - "Como imprimir etiquetas"
  - "Calibracao da impressora"
  - "Impressao USB direta"

### 4.6 Reposicao - Suporte
- Conteudo de suporte:
  - "O que e o modulo Reposicao"
  - "Como interpretar os niveis de urgencia"
  - "Estoque minimo"

---

## Detalhes Tecnicos

### Arquivos novos
- `src/components/ui/confirm-dialog.tsx`
- `src/components/layout/SupportButton.tsx`

### Arquivos modificados
- `src/components/layout/MainLayout.tsx`
- `src/pages/Financial.tsx`
- `src/pages/Products.tsx`
- `src/pages/Stock.tsx`
- `src/pages/Reports.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Exchanges.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Fiado.tsx`
- `src/pages/POS.tsx`
- `src/pages/Labels.tsx`
- `src/pages/Restock.tsx`
- `src/components/fiado/FiadoList.tsx`

### Garantias
- Nenhuma funcionalidade existente sera removida
- Nenhum dado sera perdido ou alterado
- Estrutura de navegacao e paginas mantida
- Todos os hooks, queries e mutations preservados
- Melhorias sao aditivas: novos filtros, botoes, graficos e textos de ajuda
- Todo texto visivel ao usuario estara em portugues

