export type BankProvider = 'inter' | 'asaas' | 'cora' | 'itau' | 'bradesco' | 'sicoob';

export interface BankConfig {
  id: BankProvider;
  name: string;
  code: string; // ex: '077', '260', '403', '341', '237', '756'
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
  numero: number; // 1, 2, 3
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
