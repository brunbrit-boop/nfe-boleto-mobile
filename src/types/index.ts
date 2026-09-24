export type BankProvider = 'inter' | 'asaas' | 'cora' | 'itau' | 'bradesco' | 'sicoob';

export type ActiveTab = 'robo' | 'clientes' | 'pagar' | 'receber';

export interface BankConfig {
  id: BankProvider;
  name: string;
  code: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  logoIcon: string;
  agencyDefault: string;
  accountDefault: string;
  convenioDefault: string;
}

export interface CompanyProfile {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  regimeTributario: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';
  certificadoA1Valido: boolean;
}

export interface EmpresaTenant {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  regimeTributario?: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';
  certificadoA1Valido?: boolean;
  
  // Integração Bling
  blingClientId?: string;
  blingClientSecret?: string;
  blingAccessToken: string;
  blingRefreshToken?: string;
  blingTokenExpiresAt?: number;
  isBlingConectado: boolean;
  isBlingExpirado?: boolean;
  ultimaSincronizacao?: string;

  // Universo Bancário
  bancoPadrao: BankProvider;
  
  // Análise Cadastral & Crédito (Pronto para API)
  situacaoCadastral?: string; // Ex: 'Ativa / Regular na Receita Federal'
  dataConsultaCadastral?: string;
  apontamentosCredito?: {
    total: number;
    protestos: number;
    pendencias: number;
    score?: number;
    status: 'limpo' | 'atencao' | 'pendente_consulta';
    mensagem?: string;
  };
  
  // Sincronização em Lote
  statusSincronizacao?: StatusSincronizacao;
  
  // Customização Visual
  corAvatar?: string;
  criadoEm: string;
}

export interface StatusSincronizacao {
  emAndamento: boolean;
  etapaAtual?: string;
  progresso?: number; // 0 a 100
  mensagem?: string;
  concluidoEm?: string;
  totalProdutos?: number;
  totalClientes?: number;
  erro?: string;
}

export interface ClientProfile {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual?: string;
  cidade: string;
  uf: string;
  email?: string;
  telefone?: string;
}

export interface ProductItem {
  id: string;
  codigo?: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  ncm: string;
  cfop: string;
}

export interface Installment {
  numero: number;
  totalParcelas: number;
  dataVencimento: string; // YYYY-MM-DD
  dataVencimentoFormatada: string; // DD/MM/YYYY
  valor: number;
  valorFormatado: string;
  nossoNumero: string;
  linhaDigitavel: string;
  codigoBarras: string;
  pixCopiaECola: string;
  status: 'pendente' | 'emitido' | 'pago';
}

export interface NFeData {
  numeroNFe: string;
  serie: string;
  dataEmissao: string;
  naturezaOperacao: string;
  chaveAcesso: string;
  protocoloAutorizacao?: string;
  status: 'rascunho' | 'autorizada' | 'rejeitada';
  emitente: CompanyProfile;
  destinatario: ClientProfile;
  itens: ProductItem[];
  valorProdutos: number;
  valorTotal: number;
  valorTotalFormatado: string;
  quantidadeParcelas: number;
  parcelas: Installment[];
  banco: BankProvider;
  linkDanfe?: string;
  informacoesComplementares?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: string;
  isAudio?: boolean;
  nfeData?: NFeData;
  quickActions?: {
    label: string;
    action: string;
  }[];
}

/* =========================================================
   Estruturas Oficiais de Dados da API v3 do Bling ERP
========================================================= */

export interface BlingCliente {
  id: number;
  codigo?: string;
  nome: string;
  fantasia?: string;
  tipoPessoa: 'F' | 'J';
  numeroDocumento: string; // CPF ou CNPJ formatado
  ie?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  situacao: 'A' | 'I'; // A = Ativo, I = Inativo
  segmento?: string;
  tipoContato?: string;
  condicaoPagamento?: string;
  regimeTributario?: string;
  endereco?: {
    geral?: {
      endereco?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cep?: string;
      municipio?: string;
      uf?: string;
    };
  };
  saldoDevedor?: number;
  limiteCredito?: number;
  // Dados estendidos do Cartão CNPJ e Sintegra (Receita Federal)
  cnaePrincipal?: { codigo: string | number; descricao: string };
  cnaesSecundarios?: Array<{ codigo: string | number; descricao: string }>;
  situacaoCadastral?: string;
  dataSituacaoCadastral?: string;
  motivoSituacaoCadastral?: string;
  naturezaJuridica?: string;
  dataAbertura?: string;
  capitalSocial?: number;
  porte?: string;
  qsa?: Array<{ nome: string; qual?: string; faixaEtaria?: string }>;
  consultadoEm?: string;
}

export interface BlingFornecedor {
  id: number;
  nome: string;
  fantasia?: string;
  tipoPessoa?: 'F' | 'J';
  numeroDocumento?: string; // CNPJ ou CPF formatado
  ie?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  situacao?: 'A' | 'I'; // A = Ativo, I = Inativo
  categoria?: string;
  endereco?: {
    geral?: {
      endereco: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cep: string;
      municipio: string;
      uf: string;
    };
  };
}

export interface BlingContaPagar {
  id: number;
  empresaId?: string;
  empresaNome?: string;
  numeroDocumento: string;
  dataEmissao: string; // YYYY-MM-DD
  vencimento: string; // YYYY-MM-DD
  vencimentoFormatado: string;
  valor: number;
  valorFormatado: string;
  saldo: number;
  historico?: string;
  categoria?: string;
  situacao: 1 | 2 | 3; // 1 = Em aberto, 2 = Paga, 3 = Cancelada
  contato: {
    id: number;
    nome: string;
    numeroDocumento?: string;
  };
  formaPagamento?: {
    id: number;
    descricao: string;
  };
}

export interface BlingContaReceber {
  id: number;
  empresaId?: string;
  empresaNome?: string;
  numeroDocumento: string;
  dataEmissao: string; // YYYY-MM-DD
  vencimento: string; // YYYY-MM-DD
  vencimentoFormatado: string;
  valor: number;
  valorFormatado: string;
  saldo: number;
  historico?: string;
  categoria?: string;
  situacao: 1 | 2 | 3; // 1 = Em aberto, 2 = Recebida/Liquidada, 3 = Cancelada
  contato: {
    id: number;
    nome: string;
    numeroDocumento?: string;
  };
  nossoNumero?: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  pixCopiaECola?: string;
  linkBoleto?: string;
  formaPagamento?: {
    id?: number;
    descricao?: string;
  };
}

export interface ResumoFinanceiro {
  totalAberto: number;
  totalLiquidado: number;
  totalVencido: number;
  qtdRegistros: number;
}

/* =========================================================
   Grupos de Clientes & Orçamentos em Lote com IA
========================================================= */

export interface GrupoProdutos {
  id: string;
  empresaId: string;
  nome: string;
  descricao?: string;
  produtosCodigos: string[]; // Códigos ou IDs dos produtos pertencentes a este grupo
  criadoEm: string;
  atualizadoEm: string;
}

export interface GrupoClienteItem {
  clienteId: number;
  nome: string;
  fantasia?: string;
  numeroDocumento: string;
  cidade?: string;
  uf?: string;
  telefone?: string;
  email?: string;
  valorAlvo: number;
  filtroFoco?: string;
  grupoProdutoId?: string; // Vinculo opcional com um grupo de produtos especifico
  parcelasCount?: number;
  primeiroVencimento?: string; // YYYY-MM-DD
  intervaloDias?: number;
  diasSemana?: number[]; // [1, 3, 5] por exemplo (0=Dom, 1=Seg, ..., 6=Sáb)
  tipoCronograma?: 'data_fixa' | 'semanal';
  modoEscalaSemanal?: 'continuo' | 'mesma_semana';
  itensMin?: number;
  itensMax?: number;
  banco?: BankProvider;
  idFormaPagamentoBling?: number;
  status: 'pendente' | 'gerando' | 'gerado' | 'erro';
  ofertaGerada?: any; // OfertaGeradaResult
  nfeEmitida?: NFeData;
  idNotaBling?: number | string; // ID oficial da NF-e no Bling para permitir edições via PUT
  erro?: string;
}

export interface GrupoClientes {
  id: string;
  empresaId: string;
  nome: string;
  descricao?: string;
  valorPadrao: number;
  filtroPadrao?: string;
  metaTotal?: number;
  fatorDispersao?: number;
  parcelasPadrao?: number;
  primeiroVencimentoPadrao?: string;
  intervaloDiasPadrao?: number;
  tipoCronogramaPadrao?: 'data_fixa' | 'semanal';
  diasSemanaPadrao?: number[];
  modoEscalaSemanal?: 'continuo' | 'mesma_semana';
  itensMinPadrao?: number;
  itensMaxPadrao?: number;
  margemToleranciaPadrao?: number; // Tolerância simétrica percentual (ex: 0.05 para ±5%)
  grupoProdutoPadraoId?: string; // Vinculo padrao para todos do grupo
  diretrizesGrupo?: string; // Diretrizes especificas comerciais deste grupo para a IA
  bancoPadrao?: BankProvider; // Banco emissor vinculado a este grupo
  idFormaPagamentoBling?: number; // ID oficial da forma de pagamento no Bling para previsão de entrada
  nomeFormaPagamentoBling?: string; // Nome da forma de pagamento no Bling
  clientes: GrupoClienteItem[];
  criadoEm: string;
  atualizadoEm: string;
}


