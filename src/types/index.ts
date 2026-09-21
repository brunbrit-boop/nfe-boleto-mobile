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
  isBlingConectado: boolean;
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
  
  // Customização Visual
  corAvatar?: string;
  criadoEm: string;
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
      endereco: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cep: string;
      municipio: string;
      uf: string;
    };
  };
  saldoDevedor?: number;
  limiteCredito?: number;
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
}

export interface ResumoFinanceiro {
  totalAberto: number;
  totalLiquidado: number;
  totalVencido: number;
  qtdRegistros: number;
}
