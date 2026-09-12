export type PerfilOperacao = "prestadora_servico" | "obra_propria" | "manutencao";

export const PERFIS: {
  valor: PerfilOperacao;
  titulo: string;
  descricao: string;
}[] = [
  {
    valor: "prestadora_servico",
    titulo: "Prestadora de serviço",
    descricao:
      "Executo obra ou manutenção para um contratante: medição, nota com retenção e prazo de pagamento longo.",
  },
  {
    valor: "obra_propria",
    titulo: "Construtora de obra própria",
    descricao:
      "Eu construo o meu empreendimento: orçamento com composições, compras, estoque e cronograma.",
  },
  {
    valor: "manutencao",
    titulo: "Manutenção e facilities",
    descricao: "Muitos chamados pequenos e recorrentes, com faturamento simples.",
  },
];

/** Chaves de módulo do produto (não confundir com os módulos de permissão). */
export type ModuloChave =
  | "obras"
  | "etapas"
  | "diario"
  | "vistorias"
  | "orcamentos"
  | "servicos"
  | "execucoes"
  | "contratos"
  | "medicoes"
  | "faturamento"
  | "recebimentos"
  | "contas_pagar"
  | "bancos"
  | "cartoes"
  | "compras"
  | "estoque"
  | "portal"
  | "equipes"
  | "orcamento_composicoes"
  | "cronograma"
  | "ia";

export const MODULOS: { chave: ModuloChave; nome: string; descricao: string }[] = [
  { chave: "obras", nome: "Obras / chamados", descricao: "Cadastro e acompanhamento do trabalho em campo." },
  { chave: "etapas", nome: "Etapas e cronograma", descricao: "Divide a obra em etapas e acompanha o avanço." },
  { chave: "diario", nome: "Diário de obra", descricao: "Relatório diário com efetivo, clima e fotos." },
  { chave: "vistorias", nome: "Vistorias", descricao: "Visita técnica antes de orçar." },
  { chave: "orcamentos", nome: "Orçamentos", descricao: "Monta a proposta com itens, BDI e PDF." },
  { chave: "servicos", nome: "Tabela de serviços", descricao: "Preços de referência usados nos orçamentos." },
  { chave: "execucoes", nome: "Execuções", descricao: "Equipe própria ou terceirizada executando cada serviço." },
  { chave: "contratos", nome: "Contratos", descricao: "Contrato com o contratante, valor global e retenção." },
  { chave: "medicoes", nome: "Medições", descricao: "Medição por período, acumulado e aprovação." },
  { chave: "faturamento", nome: "Faturamento (notas)", descricao: "Notas emitidas, com ou sem retenção." },
  { chave: "recebimentos", nome: "Recebimentos", descricao: "O que já entrou e o que falta receber." },
  { chave: "contas_pagar", nome: "Contas a pagar", descricao: "Fornecedores, parcelas e vencimentos." },
  { chave: "bancos", nome: "Bancos e conciliação", descricao: "Contas bancárias, extrato e conciliação." },
  { chave: "cartoes", nome: "Cartões de crédito", descricao: "Despesas de cartão e fechamento de fatura." },
  { chave: "compras", nome: "Compras e materiais", descricao: "Compradores, pedidos e materiais aplicados na obra." },
  { chave: "estoque", nome: "Estoque", descricao: "Depósitos, entradas pelo recebimento, saídas para a obra e saldo com custo médio." },
  { chave: "portal", nome: "Portal do cliente", descricao: "Link para o contratante acompanhar a obra." },
  { chave: "equipes", nome: "Equipes", descricao: "Pessoas, permissões e vínculo com obras." },
  { chave: "orcamento_composicoes", nome: "Insumos e composições", descricao: "Base de custos própria ou importada (SINAPI e similares), com composições e atualização de preço por data." },
  { chave: "cronograma", nome: "Cronograma de Gantt", descricao: "Barras por etapa, dependências, caminho crítico e previsto financeiro do mês." },
  { chave: "ia", nome: "Inteligência artificial", descricao: "Assistente de orçamento, leitura de cotação e relatório do diário. Cada uso é ligado separadamente." },
];

export const PRESETS: Record<PerfilOperacao, ModuloChave[]> = {
  prestadora_servico: [
    "obras", "etapas", "diario", "vistorias", "orcamentos", "servicos", "execucoes",
    "contratos", "medicoes", "faturamento", "recebimentos", "contas_pagar", "bancos",
    "cartoes", "portal", "equipes",
  ],
  obra_propria: [
    "obras", "etapas", "diario", "orcamentos", "servicos", "execucoes", "compras", "estoque",
    "recebimentos", "contas_pagar", "bancos", "cartoes", "portal", "equipes",
    "orcamento_composicoes", "cronograma",
  ],
  manutencao: ["obras", "diario", "orcamentos", "servicos", "execucoes", "faturamento", "recebimentos", "equipes"],
};

/** Módulos que nunca somem do menu. */
export const SEMPRE_ATIVOS: ModuloChave[] = ["obras"];
