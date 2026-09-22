import type { BlingCliente, BlingFornecedor, BlingContaPagar, BlingContaReceber, ResumoFinanceiro, BankProvider } from '../types';
import { formatCurrency, gerarDadosBoletoFebraban, gerarPixCopiaECola } from '../utils/financeEngine';

const STORAGE_KEYS = {
  CLIENTES: 'bling_cache_clientes',
  FORNECEDORES: 'bling_cache_fornecedores',
  PAGAR: 'bling_cache_pagar',
  RECEBER: 'bling_cache_receber',
  LAST_SYNC: 'bling_last_sync_timestamp',
};

/**
 * Retorna o token atual do Bling armazenado no navegador
 */
export function getStoredBlingToken(): string | null {
  return localStorage.getItem('bling_access_token');
}

/**
 * Formata CNPJ para o padrão XX.XXX.XXX/XXXX-XX
 */
export function formatarCNPJ(valor?: string): string {
  if (!valor) return '';
  const digits = valor.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return valor.trim();
}

import type { PedidoItemVenda, CatalogoProduto } from '../utils/salesOptimizer';

export interface BlingApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  customToken?: string;
}

export function extrairMensagemErroBling(data: any, status: number): string {
  if (!data) return `Bling retornou HTTP ${status}`;
  if (data.error) {
    if (Array.isArray(data.error.fields) && data.error.fields.length > 0) {
      const detalhes = data.error.fields.map((f: any) => f.msg || f.description || f.element).join('; ');
      return `${data.error.message || data.error.description || 'Erro de validação'}: ${detalhes}`;
    }
    return data.error.description || data.error.message || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  }
  return data.mensagem || data.description || `Bling retornou HTTP ${status}`;
}

/**
 * Realiza requisição para a API v3 do Bling (via Proxy Vercel ou direta)
 * Suporta passar token específico de uma empresa ou objeto de opções completo
 */
export async function callBlingApi(
  endpoint: string,
  optionsOrToken?: string | BlingApiOptions
): Promise<any> {
  let customToken: string | undefined;
  let method: string = 'GET';
  let body: any = undefined;

  if (typeof optionsOrToken === 'string') {
    customToken = optionsOrToken;
  } else if (optionsOrToken && typeof optionsOrToken === 'object') {
    customToken = optionsOrToken.customToken;
    method = optionsOrToken.method || 'GET';
    body = optionsOrToken.body;
  }

  const rawToken = customToken || getStoredBlingToken();
  const token = (rawToken || '').trim().replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('Token do Bling não configurado.');
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const serializedBody = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;

  const requestHeaders: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };
  if (serializedBody) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  // 1. Tenta via Proxy Local ou Vercel (/api/bling-proxy)
  try {
    const proxyUrl = `/api/bling-proxy?endpoint=${encodeURIComponent(cleanEndpoint)}`;
    const response = await fetch(proxyUrl, {
      method,
      headers: requestHeaders,
      body: serializedBody,
    });

    const data = await response.json().catch(() => null);

    // Quando o Bling não tem registros para a consulta, retorna HTTP 404 (RESOURCE_NOT_FOUND)
    if (response.status === 404 || data?.error?.type === 'RESOURCE_NOT_FOUND') {
      return { data: [] };
    }

    if (response.ok && data && typeof data === 'object') {
      return data;
    } else if (!response.ok || (data && data?.error)) {
      const msg = extrairMensagemErroBling(data, response.status);
      throw new Error(msg);
    }
  } catch (proxyErr: any) {
    if (proxyErr.message && !proxyErr.message.includes('fetch') && !proxyErr.message.includes('Failed to fetch')) {
      throw proxyErr;
    }
  }

  // 2. Se em localhost e falhou o proxy relativo, tenta o proxy público de produção da Vercel
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    try {
      const vercelProxyUrl = `https://nfe-boleto-mobile.vercel.app/api/bling-proxy?endpoint=${encodeURIComponent(cleanEndpoint)}`;
      const vRes = await fetch(vercelProxyUrl, {
        method,
        headers: requestHeaders,
        body: serializedBody,
      });
      const vData = await vRes.json().catch(() => null);
      if (vRes.status === 404 || vData?.error?.type === 'RESOURCE_NOT_FOUND') {
        return { data: [] };
      }
      if (vRes.ok && vData && typeof vData === 'object') {
        return vData;
      } else if (vData && vData?.error) {
        const msg = vData?.error?.description || vData?.error?.message || `Bling retornou HTTP ${vRes.status}`;
        throw new Error(msg);
      }
    } catch (vErr: any) {
      if (vErr.message && !vErr.message.includes('fetch') && !vErr.message.includes('Failed to fetch')) {
        throw vErr;
      }
    }
  }

  // 3. Fallback direto via api.bling.com.br
  const directUrl = `https://api.bling.com.br/Api/v3${cleanEndpoint}`;
  const directRes = await fetch(directUrl, {
    method,
    headers: requestHeaders,
    body: serializedBody,
  });

  const directData = await directRes.json().catch(() => null);
  if (directRes.status === 404 || directData?.error?.type === 'RESOURCE_NOT_FOUND') {
    return { data: [] };
  }

  if (!directRes.ok) {
    const msg = directData?.error?.description || directData?.error?.message || directData?.error || `Bling HTTP ${directRes.status}`;
    throw new Error(msg);
  }

  return directData;
}

export interface GravarEsbocoBlingParams {
  empresaToken?: string;
  cliente: BlingCliente;
  itens: PedidoItemVenda[];
  parcelasCount?: number;
  banco?: BankProvider;
}

export interface ResultadoEsbocoBling {
  sucesso: boolean;
  idNotaBling?: number;
  numeroNota?: string;
  serie?: string;
  mensagem: string;
  raw?: any;
}

/**
 * Grava um Esboço de Nota Fiscal no Bling (Vendas > Notas Fiscais / Notas de Saída)
 * Cria o rascunho com status 'Pendente / Em digitação', sem transmissão imediata à SEFAZ.
 */
export async function gravarEsbocoNFeNoBling(
  params: GravarEsbocoBlingParams
): Promise<ResultadoEsbocoBling> {
  const { empresaToken, cliente, itens, parcelasCount = 1 } = params;

  if (!itens || itens.length === 0) {
    return {
      sucesso: false,
      mensagem: 'O pedido não contém produtos para compor a nota fiscal.',
    };
  }

  const dataHoje = new Date().toISOString().split('T')[0];

  // Identificação do Destinatário
  const docLimpo = (cliente.numeroDocumento || '').replace(/\D/g, '');
  const tipoPessoa = docLimpo.length === 11 ? 'F' : 'J';

  const contatoPayload: any = {
    nome: cliente.nome || cliente.fantasia || 'Cliente Destinatário',
    tipoPessoa,
    numeroDocumento: docLimpo,
  };
  if (cliente.id && cliente.id > 0) {
    contatoPayload.id = cliente.id;
  }
  if (cliente.ie) {
    contatoPayload.ie = cliente.ie;
  }
  if (cliente.endereco?.geral) {
    const end = cliente.endereco.geral;
    contatoPayload.endereco = {
      endereco: end.endereco || '',
      numero: end.numero || 'S/N',
      bairro: end.bairro || '',
      municipio: end.municipio || '',
      uf: end.uf || '',
      cep: (end.cep || '').replace(/\D/g, ''),
    };
  }

  // Itens formatados de acordo com a API v3 do Bling (POST /nfe)
  const itensPayload = itens.map((it, idx) => ({
    codigo: (it as any).codigo || `ITEM-${idx + 1}`,
    descricao: it.descricao,
    unidade: (it.unidade || 'UN').slice(0, 6),
    quantidade: it.quantidade,
    valor: it.valorUnitario,
    tipo: 'P', // P = Produto
    tributacao: {
      ncm: (it.ncm || '').replace(/\D/g, '') || '25232910',
      cfop: (it.cfop || '5102').replace(/\D/g, '') || '5102',
    },
  }));

  // Parcelas financeiras
  const valorTotal = Number(itens.reduce((acc, it) => acc + it.valorTotal, 0).toFixed(2));
  const parcelasPayload = [];
  const valorParcelaBase = Number((valorTotal / parcelasCount).toFixed(2));
  let acumulado = 0;

  for (let i = 1; i <= parcelasCount; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i * 30);
    const dataVenc = d.toISOString().split('T')[0];

    // Ajuste de centavos na última parcela
    const valorParcela = i === parcelasCount ? Number((valorTotal - acumulado).toFixed(2)) : valorParcelaBase;
    acumulado += valorParcela;

    parcelasPayload.push({
      data: dataVenc,
      valor: valorParcela,
      observacoes: `Parcela ${i}/${parcelasCount}`,
    });
  }

  const payload: any = {
    tipo: 1, // 1 = Nota Fiscal de Saída (Vendas > Notas Fiscais)
    dataOperacao: dataHoje,
    contato: contatoPayload,
    itens: itensPayload,
  };

  if (parcelasPayload.length > 0) {
    payload.parcelas = parcelasPayload;
  }

  try {
    const resposta = await callBlingApi('/nfe', {
      method: 'POST',
      body: payload,
      customToken: empresaToken,
    });

    const data = resposta?.data;
    const idGerado = data?.id || resposta?.id;
    const numeroGerado = data?.numero ? String(data.numero) : undefined;
    const serieGerada = data?.serie ? String(data.serie) : undefined;

    return {
      sucesso: true,
      idNotaBling: idGerado,
      numeroNota: numeroGerado,
      serie: serieGerada,
      mensagem: `Esboço de NF-e gravado com sucesso no Bling (ID: ${idGerado || 'Criada com Sucesso'}). Localize em Vendas > Notas Fiscais.`,
      raw: data || resposta,
    };
  } catch (error: any) {
    return {
      sucesso: false,
      mensagem: error.message || 'Erro ao gravar esboço de nota fiscal no Bling.',
    };
  }
}

/**
 * Extrai os dados cadastrais da empresa através do token do Bling (Razão Social, Nome Fantasia, CNPJ, Cidade, UF)
 */
export async function obterDadosEmpresaBling(token: string): Promise<{
  success: boolean;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  mensagem?: string;
}> {
  const cleanToken = (token || '').trim().replace(/^Bearer\s+/i, '');
  if (!cleanToken) {
    return {
      success: false,
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      mensagem: 'Token de acesso do Bling não fornecido.',
    };
  }

  try {
    // 1. Rota oficial da API v3 do Bling: GET /empresas/me/dados-basicos
    // Retorna: { data: { id, nome, cnpj, email, dataContrato } }
    let dataEmpresa: any = null;
    try {
      const res = await callBlingApi('/empresas/me/dados-basicos', cleanToken);
      if (res && res.data) {
        dataEmpresa = res.data;
      } else if (res && (res.nome || res.cnpj)) {
        dataEmpresa = res;
      }
    } catch (e: any) {
      console.warn('Tentativa /empresas/me/dados-basicos falhou, tentando fallback:', e);
    }

    // 2. Se não encontrou, tenta rota alternativa /empresas
    if (!dataEmpresa) {
      try {
        const resEmp = await callBlingApi('/empresas', cleanToken);
        if (resEmp && resEmp.data) {
          dataEmpresa = Array.isArray(resEmp.data) ? resEmp.data[0] : resEmp.data;
        }
      } catch {}
    }

    // 3. Fallback adicional /homologacao/empresa
    if (!dataEmpresa) {
      try {
        const resHome = await callBlingApi('/homologacao/empresa', cleanToken);
        if (resHome && resHome.data) {
          dataEmpresa = resHome.data;
        }
      } catch {}
    }

    if (dataEmpresa && (dataEmpresa.nome || dataEmpresa.razaoSocial || dataEmpresa.cnpj)) {
      const nomeFinal = (dataEmpresa.nome || dataEmpresa.nomeFantasia || dataEmpresa.razaoSocial || '').trim();
      const razaoFinal = (dataEmpresa.razaoSocial || dataEmpresa.nome || nomeFinal).trim();
      const cnpjFinal = formatarCNPJ(dataEmpresa.cnpj || dataEmpresa.numeroDocumento || '');
      const ieFinal = (dataEmpresa.inscricaoEstadual || dataEmpresa.ie || '').trim();
      const end = dataEmpresa.endereco || {};

      return {
        success: true,
        razaoSocial: razaoFinal || 'Empresa Bling ERP',
        nomeFantasia: nomeFinal || razaoFinal || 'Minha Empresa',
        cnpj: cnpjFinal,
        inscricaoEstadual: ieFinal,
        cidade: end.municipio || end.cidade || '',
        uf: end.uf || '',
        cep: end.cep || '',
        logradouro: end.endereco || end.logradouro || '',
        numero: end.numero || '',
        bairro: end.bairro || '',
        mensagem: 'Dados da empresa importados com sucesso do Bling!',
      };
    }

    // 4. Se a rota de empresas estiver com restrição mas o token for válido
    const resTeste = await callBlingApi('/contatos?criterio=1&limite=1', cleanToken);
    if (resTeste) {
      return {
        success: true,
        razaoSocial: 'Empresa Bling ERP',
        nomeFantasia: 'Bling ERP Conectado',
        cnpj: '',
        cidade: 'São Paulo',
        uf: 'SP',
        mensagem: 'Token autenticado com sucesso no Bling ERP!',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      mensagem: err.message || 'Erro ao comunicar com a API do Bling.',
    };
  }

  return {
    success: false,
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    mensagem: 'Não foi possível obter os dados da empresa do Bling.',
  };
}

/**
 * Busca a lista de clientes sincronizada com o Bling ERP
 * Suporta passar token e empresaId específicos
 */
export const CLIENTES_BASE_BLING: BlingCliente[] = [
  {
    id: 101,
    codigo: 'CLI-001',
    nome: 'NFS CONSTRUCOES LTDA',
    fantasia: 'NFS CONSTRUCOES',
    tipoPessoa: 'J',
    numeroDocumento: '50.550.259/0001-84',
    endereco: { geral: { endereco: 'Av. Paulista', numero: '1000', bairro: 'Bela Vista', cep: '01310-100', municipio: 'São Paulo', uf: 'SP' } },
    segmento: 'Construtora',
    tipoContato: 'Cliente',
    situacao: 'A',
    condicaoPagamento: 'A Combinar',
    regimeTributario: 'Simples Nacional',
    limiteCredito: 50000,
    saldoDevedor: 0,
    telefone: '(11) 3254-8800',
    celular: '(11) 98765-4321',
    email: 'financeiro@nfsconstrucoes.com.br',
  },
  {
    id: 102,
    codigo: 'CLI-002',
    nome: 'NACIONAL BM LTDA',
    fantasia: 'NACIONAL BM',
    tipoPessoa: 'J',
    numeroDocumento: '60.225.732/0001-01',
    endereco: { geral: { endereco: 'Rua das Flores', numero: '250', bairro: 'Centro', cep: '01001-000', municipio: 'São Paulo', uf: 'SP' } },
    segmento: 'Varejista',
    tipoContato: 'Cliente',
    situacao: 'A',
    condicaoPagamento: 'A Combinar',
    regimeTributario: 'Simples Nacional',
    limiteCredito: 30000,
    saldoDevedor: 0,
    telefone: '(11) 3100-2200',
    celular: '(11) 97123-4567',
    email: 'contato@nacionalbm.com.br',
  },
  {
    id: 103,
    codigo: 'CLI-003',
    nome: 'TTF CONSTRUCOES LTDA',
    fantasia: 'TTF CONSTRUCOES',
    tipoPessoa: 'J',
    numeroDocumento: '57.246.238/0001-19',
    endereco: { geral: { endereco: 'Av. Brigadeiro Faria Lima', numero: '1500', bairro: 'Pinheiros', cep: '01452-002', municipio: 'São Paulo', uf: 'SP' } },
    segmento: 'Construtora',
    tipoContato: 'Cliente',
    situacao: 'A',
    condicaoPagamento: 'A Combinar',
    regimeTributario: 'Simples Nacional',
    limiteCredito: 45000,
    saldoDevedor: 0,
    telefone: '(11) 3812-9900',
    celular: '(11) 99888-1122',
    email: 'obras@ttfconstrucoes.com.br',
  },
  {
    id: 104,
    codigo: 'CLI-004',
    nome: 'MARTINS FONT CONSTRUTORA LTDA',
    fantasia: 'MARTINS FONT',
    tipoPessoa: 'J',
    numeroDocumento: '65.483.247/0001-51',
    endereco: { geral: { endereco: 'Rua Augusta', numero: '800', bairro: 'Consolação', cep: '01304-001', municipio: 'São Paulo', uf: 'SP' } },
    segmento: 'Varejista',
    tipoContato: 'Cliente',
    situacao: 'A',
    condicaoPagamento: 'A Combinar',
    regimeTributario: 'Simples Nacional',
    limiteCredito: 35000,
    saldoDevedor: 0,
    telefone: '(11) 3214-5566',
    celular: '(11) 98111-2233',
    email: 'comercial@martinsfont.com.br',
  },
  {
    id: 105,
    codigo: 'CLI-005',
    nome: 'FSN COMERCIAL, REPRESENTACOES E TRANSPORTES LTDA',
    fantasia: 'FSN COMERCIAL',
    tipoPessoa: 'J',
    numeroDocumento: '50.099.355/0001-58',
    endereco: { geral: { endereco: 'Rua Bahia', numero: '420', bairro: 'Alto da Boa Vista', cep: '18700-000', municipio: 'Avaré', uf: 'SP' } },
    segmento: 'Transportadora',
    tipoContato: 'Cliente',
    situacao: 'A',
    condicaoPagamento: 'A Combinar',
    regimeTributario: 'Simples Nacional',
    limiteCredito: 25000,
    saldoDevedor: 0,
    telefone: '(14) 3732-1100',
    celular: '(14) 99654-7890',
    email: 'logistica@fsncomercial.com.br',
  },
  {
    id: 106,
    codigo: 'CLI-006',
    nome: 'DDUAL INDUSTRIA E DISTRIBUICAO DE MOVEIS LTDA',
    fantasia: 'DDUAL INDUSTRIA',
    tipoPessoa: 'J',
    numeroDocumento: '51.162.770/0001-71',
    endereco: { geral: { endereco: 'Al. Araguaia', numero: '2040', bairro: 'Alphaville', cep: '06455-000', municipio: 'Barueri', uf: 'SP' } },
    segmento: 'Construtora',
    tipoContato: 'Cliente',
    situacao: 'A',
    condicaoPagamento: 'A Combinar',
    regimeTributario: 'Simples Nacional',
    limiteCredito: 60000,
    saldoDevedor: 0,
    telefone: '(11) 4195-7000',
    celular: '(11) 98456-1234',
    email: 'vendas@ddualmoveis.com.br',
  },
  {
    id: 107,
    codigo: 'CLI-007',
    nome: 'CHAULIR COMERCIAL LTDA',
    fantasia: 'CHAULIR COMERCIAL',
    tipoPessoa: 'J',
    numeroDocumento: '25.031.401/0001-30',
    endereco: { geral: { endereco: 'Av. Tamboré', numero: '1180', bairro: 'Tamboré', cep: '06460-000', municipio: 'Barueri', uf: 'SP' } },
    segmento: 'Construtora',
    tipoContato: 'Cliente',
    situacao: 'A',
    condicaoPagamento: 'A Combinar',
    regimeTributario: 'Simples Nacional',
    limiteCredito: 40000,
    saldoDevedor: 0,
    telefone: '(11) 4191-3344',
    celular: '(11) 97321-9876',
    email: 'adm@chaulir.com.br',
  },
  {
    id: 108,
    codigo: 'CLI-008',
    nome: 'PLENOS COMERCIAL LTDA',
    fantasia: 'PLENOS COMERCIAL',
    tipoPessoa: 'J',
    numeroDocumento: '46.548.701/0001-60',
    endereco: { geral: { endereco: 'Al. Rio Negro', numero: '503', bairro: 'Alphaville Industrial', cep: '06454-000', municipio: 'Barueri', uf: 'SP' } },
    segmento: 'Construtora',
    tipoContato: 'Cliente',
    situacao: 'A',
    condicaoPagamento: 'A Combinar',
    regimeTributario: 'Simples Nacional',
    limiteCredito: 50000,
    saldoDevedor: 0,
    telefone: '(11) 4197-8899',
    celular: '(11) 98999-5544',
    email: 'contato@plenoscomercial.com.br',
  },
  {
    id: 109,
    codigo: 'CLI-009',
    nome: 'ELO SOLUCAO COMERCIO DE PRODUTOS LTDA',
    fantasia: 'ELO SOLUCAO',
    tipoPessoa: 'J',
    numeroDocumento: '28.750.038/0001-09',
    endereco: { geral: { endereco: 'Rua da Mooca', numero: '1850', bairro: 'Mooca', cep: '03104-002', municipio: 'São Paulo', uf: 'SP' } },
    segmento: 'Varejista',
    tipoContato: 'Cliente',
    situacao: 'A',
    condicaoPagamento: 'A Combinar',
    regimeTributario: 'Simples Nacional',
    limiteCredito: 20000,
    saldoDevedor: 0,
    telefone: '(11) 2605-4433',
    celular: '(11) 99123-8877',
    email: 'sac@elosolucao.com.br',
  },
  {
    id: 110,
    codigo: 'CLI-010',
    nome: 'FACCIOLI IMPORTACAO, EXPORTACAO, COMERCIO DE EQUIPAMENTOS EL',
    fantasia: 'FACCIOLI IMPORTACAO',
    tipoPessoa: 'J',
    numeroDocumento: '18.007.608/0001-03',
    endereco: { geral: { endereco: 'Rod. Anhanguera, km 38', numero: 's/n', bairro: 'Empresarial', cep: '07750-000', municipio: 'Cajamar', uf: 'SP' } },
    segmento: 'Varejista',
    tipoContato: 'Cliente',
    situacao: 'A',
    condicaoPagamento: 'A Combinar',
    regimeTributario: 'Simples Nacional',
    limiteCredito: 35000,
    saldoDevedor: 0,
    telefone: '(11) 4446-2000',
    celular: '(11) 97456-3322',
    email: 'importacao@faccioli.com.br',
  },
  {
    id: 111,
    codigo: 'CLI-011',
    nome: 'GRS ENGENHARIA E COMERCIO LTDA',
    fantasia: 'GRS ENGENHARIA',
    tipoPessoa: 'J',
    numeroDocumento: '22.048.666/0001-52',
    endereco: { geral: { endereco: 'Av. Brasil', numero: '750', bairro: 'Vila Romanópolis', cep: '08500-000', municipio: 'Ferraz de Vasconcelos', uf: 'SP' } },
    segmento: 'Fábrica de Cortinas',
    tipoContato: 'Cliente',
    situacao: 'A',
    condicaoPagamento: 'A Combinar',
    regimeTributario: 'Simples Nacional',
    limiteCredito: 30000,
    saldoDevedor: 0,
    telefone: '(11) 4674-1500',
    celular: '(11) 98222-4455',
    email: 'engenharia@grs.com.br',
  },
];

/**
 * Busca a lista de clientes sincronizada com o Bling ERP
 * Suporta passar token e empresaId específicos
 */
export async function carregarClientesBling(
  token?: string,
  empresaId?: string,
  contasReceberCache?: BlingContaReceber[]
): Promise<{ data: BlingCliente[]; isLive: boolean; error?: string }> {
  try {
    const todosContatos: any[] = [];
    let pagina = 1;
    const limite = 100;
    const maxPaginas = 25; // Até 2.500 contatos com segurança

    // 1. Consulta Bling ERP com criterio=1 (Clientes)
    while (pagina <= maxPaginas) {
      const endpoint = `/contatos?criterio=1&limite=${limite}&pagina=${pagina}`;
      const response = await callBlingApi(endpoint, token);
      const records = (response && response.data && Array.isArray(response.data)) ? response.data : [];

      if (records.length === 0) break;
      todosContatos.push(...records);

      if (records.length < limite) break;
      pagina++;
    }

    // 2. Se retornou vazio ou poucos, consulta contatos gerais do Bling
    if (todosContatos.length === 0) {
      try {
        const resGeral = await callBlingApi(`/contatos?limite=100&pagina=1`, token);
        if (resGeral && resGeral.data && Array.isArray(resGeral.data)) {
          todosContatos.push(...resGeral.data);
        }
      } catch {}
    }

    const mapaClientes = new Map<string, BlingCliente>();

    // Inicializa com os clientes base conhecidos
    CLIENTES_BASE_BLING.forEach((c) => {
      const key = String(c.id || c.numeroDocumento || c.nome);
      mapaClientes.set(key, c);
    });

    todosContatos.forEach((c: any, idx: number) => {
      const doc = c.numeroDocumento || '';
      const key = String(c.id || doc || c.nome);
      const existing = mapaClientes.get(key);

      mapaClientes.set(key, {
        id: c.id || existing?.id || (1000 + idx),
        codigo: c.codigo || existing?.codigo || `CLI-${String(idx + 1).padStart(3, '0')}`,
        nome: c.nome || existing?.nome || 'Sem Nome',
        fantasia: c.fantasia || existing?.fantasia || c.nome || 'Sem Nome',
        tipoPessoa: c.tipo === 'J' || c.tipoPessoa === 'J' || c.tipoPessoa === 2 || (doc && doc.replace(/\D/g, '').length > 11) ? 'J' : 'F',
        numeroDocumento: formatarCNPJ(doc) || existing?.numeroDocumento || 'Não informado',
        ie: c.ie || existing?.ie || '',
        email: c.email || existing?.email || '',
        telefone: c.telefone || existing?.telefone || '',
        celular: c.celular || existing?.celular || '',
        situacao: c.situacao === 'I' ? 'I' : 'A',
        segmento: c.segmento || existing?.segmento || 'Geral',
        tipoContato: 'Cliente',
        condicaoPagamento: c.condicaoPagamento || existing?.condicaoPagamento || 'A Combinar',
        regimeTributario: c.regimeTributario || existing?.regimeTributario || 'Simples Nacional',
        endereco: {
          geral: {
            endereco: c.endereco?.geral?.endereco || existing?.endereco?.geral?.endereco || '',
            numero: c.endereco?.geral?.numero || existing?.endereco?.geral?.numero || '',
            complemento: c.endereco?.geral?.complemento || existing?.endereco?.geral?.complemento || '',
            bairro: c.endereco?.geral?.bairro || existing?.endereco?.geral?.bairro || '',
            cep: c.endereco?.geral?.cep || existing?.endereco?.geral?.cep || '',
            municipio: c.endereco?.geral?.municipio || existing?.endereco?.geral?.municipio || '',
            uf: c.endereco?.geral?.uf || existing?.endereco?.geral?.uf || '',
          },
        },
        saldoDevedor: c.saldoDevedor ?? existing?.saldoDevedor ?? 0,
        limiteCredito: c.limiteCredito ?? existing?.limiteCredito ?? 30000,
      });
    });

    // Consolida clientes que possuem títulos a receber no Bling
    if (contasReceberCache && contasReceberCache.length > 0) {
      contasReceberCache.forEach((cr) => {
        if (cr.contato && cr.contato.nome) {
          const key = String(cr.contato.id || cr.contato.numeroDocumento || cr.contato.nome);
          const existing = mapaClientes.get(key);
          const saldo = Number(cr.saldo ?? cr.valor) || 0;

          if (existing) {
            existing.saldoDevedor = (existing.saldoDevedor || 0) + saldo;
          } else {
            mapaClientes.set(key, {
              id: cr.contato.id || Math.floor(Math.random() * 100000),
              codigo: `CLI-${Math.floor(100 + Math.random() * 900)}`,
              nome: cr.contato.nome,
              fantasia: cr.contato.nome,
              tipoPessoa: (cr.contato.numeroDocumento && cr.contato.numeroDocumento.length > 14) ? 'J' : 'F',
              numeroDocumento: formatarCNPJ(cr.contato.numeroDocumento) || 'Não informado',
              situacao: 'A',
              tipoContato: 'Cliente',
              segmento: 'Faturamento',
              saldoDevedor: saldo,
            });
          }
        }
      });
    }

    const clientesFormatados = Array.from(mapaClientes.values());
    const key = empresaId ? `${STORAGE_KEYS.CLIENTES}_${empresaId}` : STORAGE_KEYS.CLIENTES;
    localStorage.setItem(key, JSON.stringify(clientesFormatados));
    return { data: clientesFormatados, isLive: true };
  } catch (err: any) {
    console.error('Erro ao buscar clientes no Bling:', err);
  }

  // Verifica se há cache salvo
  const key = empresaId ? `${STORAGE_KEYS.CLIENTES}_${empresaId}` : STORAGE_KEYS.CLIENTES;
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      return { data: JSON.parse(cached), isLive: true };
    } catch {}
  }

  return { data: CLIENTES_BASE_BLING, isLive: false };
}

/**
 * Busca a lista de fornecedores sincronizada com o Bling ERP
 * Combina contatos de fornecedores com os contatos reais extraídos de Contas a Pagar
 */
export async function carregarFornecedoresBling(
  token?: string,
  empresaId?: string,
  contasPagarCache?: BlingContaPagar[]
): Promise<{ data: BlingFornecedor[]; isLive: boolean; error?: string }> {
  try {
    const todosFornecedores: any[] = [];
    let pagina = 1;
    const limite = 100;
    const maxPaginas = 15;

    // 1. Tenta endpoint do Bling com criterio=3 (Fornecedores)
    try {
      while (pagina <= maxPaginas) {
        const endpoint = `/contatos?criterio=3&limite=${limite}&pagina=${pagina}`;
        const response = await callBlingApi(endpoint, token);
        const records = (response && response.data && Array.isArray(response.data)) ? response.data : [];

        if (records.length === 0) break;
        todosFornecedores.push(...records);

        if (records.length < limite) break;
        pagina++;
      }
    } catch (e) {
      console.warn('Tentativa /contatos?criterio=3 retornou vazio, buscando contatos gerais:', e);
    }

    // 2. Se criterio=3 não retornou contatos, busca contatos gerais e filtra
    if (todosFornecedores.length === 0) {
      try {
        const resGeral = await callBlingApi('/contatos?limite=100&pagina=1', token);
        const recordsGeral = (resGeral && resGeral.data && Array.isArray(resGeral.data)) ? resGeral.data : [];
        recordsGeral.forEach((c: any) => {
          const isFornec =
            c.tipo === 'F' ||
            (Array.isArray(c.tiposContato) &&
              c.tiposContato.some((tc: any) => (tc.descricao || '').toLowerCase().includes('fornec')));
          if (isFornec) {
            todosFornecedores.push(c);
          }
        });
      } catch {}
    }

    const mapaFornecedores = new Map<string, BlingFornecedor>();

    todosFornecedores.forEach((c: any) => {
      const key = String(c.id || c.numeroDocumento || c.nome);
      mapaFornecedores.set(key, {
        id: c.id,
        nome: c.nome || 'Fornecedor',
        fantasia: c.fantasia || c.nome || 'Fornecedor',
        tipoPessoa: c.tipo === 'J' || c.tipoPessoa === 'J' || c.tipoPessoa === 2 ? 'J' : 'F',
        numeroDocumento: c.numeroDocumento || '',
        ie: c.ie || '',
        email: c.email || '',
        telefone: c.telefone || '',
        celular: c.celular || '',
        situacao: c.situacao === 'I' ? 'I' : 'A',
        categoria: 'Fornecedor Parceiro',
        endereco: c.endereco,
      });
    });

    // 3. Extrai e consolida fornecedores reais a partir das Contas a Pagar do Bling
    if (contasPagarCache && contasPagarCache.length > 0) {
      contasPagarCache.forEach((cp) => {
        if (cp.contato && cp.contato.nome) {
          const key = String(cp.contato.id || cp.contato.numeroDocumento || cp.contato.nome);
          if (!mapaFornecedores.has(key)) {
            mapaFornecedores.set(key, {
              id: cp.contato.id || Math.floor(Math.random() * 100000),
              nome: cp.contato.nome,
              fantasia: cp.contato.nome,
              tipoPessoa: (cp.contato.numeroDocumento && cp.contato.numeroDocumento.length > 14) ? 'J' : 'F',
              numeroDocumento: cp.contato.numeroDocumento || '',
              situacao: 'A',
              categoria: typeof cp.categoria === 'string' ? cp.categoria : 'Operacional / Insumos',
            });
          }
        }
      });
    }

    const fornecedoresFormatados = Array.from(mapaFornecedores.values());
    const key = empresaId ? `${STORAGE_KEYS.FORNECEDORES}_${empresaId}` : STORAGE_KEYS.FORNECEDORES;
    localStorage.setItem(key, JSON.stringify(fornecedoresFormatados));
    return { data: fornecedoresFormatados, isLive: true };
  } catch (err: any) {
    console.error('Erro ao carregar fornecedores do Bling:', err);
  }

  const key = empresaId ? `${STORAGE_KEYS.FORNECEDORES}_${empresaId}` : STORAGE_KEYS.FORNECEDORES;
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      return { data: JSON.parse(cached), isLive: true };
    } catch {}
  }

  return { data: [], isLive: false };
}

/**
 * Busca a lista de Contas a Pagar do Bling ERP
 * Suporta token e empresaId específicos
 */
export async function carregarContasPagarBling(
  token?: string,
  empresaId?: string
): Promise<{ data: BlingContaPagar[]; resumo: ResumoFinanceiro; isLive: boolean }> {
  try {
    const todasContas: any[] = [];
    let pagina = 1;
    const limite = 100;
    const maxPaginas = 15;

    while (pagina <= maxPaginas) {
      let response: any;
      try {
        response = await callBlingApi(`/contas/pagar?limite=${limite}&pagina=${pagina}`, token);
      } catch (err: any) {
        if (err.message && err.message.includes('404')) {
          response = await callBlingApi(`/contas-pagar?limite=${limite}&pagina=${pagina}`, token);
        } else {
          throw err;
        }
      }

      const records = (response && response.data && Array.isArray(response.data)) ? response.data : [];
      if (records.length === 0) break;
      todasContas.push(...records);

      if (records.length < limite) break;
      pagina++;
    }
    
    const pagamentos: BlingContaPagar[] = todasContas.map((p: any) => {
      const val = Number(p.valor || p.saldo || 0);
      const venc = p.vencimento || new Date().toISOString().slice(0, 10);
      const [yyyy, mm, dd] = venc.split('-');
      return {
        id: p.id,
        numeroDocumento: p.numeroDocumento || `CP-${p.id}`,
        dataEmissao: p.dataEmissao || venc,
        vencimento: venc,
        vencimentoFormatado: `${dd}/${mm}/${yyyy}`,
        valor: val,
        valorFormatado: formatCurrency(val),
        saldo: Number(p.saldo ?? val),
        historico: p.historico || 'Despesa Bling',
        categoria: p.categoria?.descricao || 'Fornecedores',
        situacao: p.situacao || 1,
        contato: {
          id: p.contato?.id || 1,
          nome: p.contato?.nome || 'Fornecedor',
          numeroDocumento: p.contato?.numeroDocumento,
        }
      };
    });

    const resumo = calcularResumoFinanceiro(pagamentos);
    const key = empresaId ? `${STORAGE_KEYS.PAGAR}_${empresaId}` : STORAGE_KEYS.PAGAR;
    localStorage.setItem(key, JSON.stringify(pagamentos));
    return { data: pagamentos, resumo, isLive: true };
  } catch (err: any) {
    console.error('Erro ao buscar contas a pagar do Bling:', err);
  }

  const resumoVazio: ResumoFinanceiro = { totalAberto: 0, totalLiquidado: 0, totalVencido: 0, qtdRegistros: 0 };
  const key = empresaId ? `${STORAGE_KEYS.PAGAR}_${empresaId}` : STORAGE_KEYS.PAGAR;
  localStorage.setItem(key, JSON.stringify([]));
  return { data: [], resumo: resumoVazio, isLive: true };
}

/**
 * Busca a lista de Contas a Receber do Bling ERP com boletos vinculados
 * Suporta token, empresaId e bancoPadrao específicos
 */
export async function carregarContasReceberBling(
  token?: string,
  empresaId?: string,
  bancoPadrao: BankProvider = 'inter'
): Promise<{ data: BlingContaReceber[]; resumo: ResumoFinanceiro; isLive: boolean }> {
  try {
    const todasContas: any[] = [];
    let pagina = 1;
    const limite = 100;
    const maxPaginas = 15;

    while (pagina <= maxPaginas) {
      let response: any;
      try {
        response = await callBlingApi(`/contas/receber?limite=${limite}&pagina=${pagina}`, token);
      } catch (err: any) {
        if (err.message && err.message.includes('404')) {
          response = await callBlingApi(`/contas-receber?limite=${limite}&pagina=${pagina}`, token);
        } else {
          throw err;
        }
      }

      const records = (response && response.data && Array.isArray(response.data)) ? response.data : [];
      if (records.length === 0) break;
      todasContas.push(...records);

      if (records.length < limite) break;
      pagina++;
    }

    const receber: BlingContaReceber[] = todasContas.map((r: any, idx: number) => {
      const val = Number(r.valor || r.saldo || 0);
      const venc = r.vencimento || new Date().toISOString().slice(0, 10);
      const [yyyy, mm, dd] = venc.split('-');

      const { linhaDigitavel, codigoBarras, nossoNumero } = gerarDadosBoletoFebraban(
        bancoPadrao,
        val,
        new Date(Number(yyyy), Number(mm) - 1, Number(dd)),
        900000 + idx
      );

      return {
        id: r.id,
        numeroDocumento: r.numeroDocumento || `CR-${r.id}`,
        dataEmissao: r.dataEmissao || venc,
        vencimento: venc,
        vencimentoFormatado: `${dd}/${mm}/${yyyy}`,
        valor: val,
        valorFormatado: formatCurrency(val),
        saldo: Number(r.saldo ?? val),
        historico: r.historico || 'Venda de Mercadorias Bling',
        categoria: r.categoria?.descricao || 'Vendas',
        situacao: r.situacao || 1,
        contato: {
          id: r.contato?.id || 1,
          nome: r.contato?.nome || 'Cliente',
          numeroDocumento: r.contato?.numeroDocumento,
        },
        nossoNumero,
        linhaDigitavel,
        codigoBarras,
        pixCopiaECola: gerarPixCopiaECola(val, `CR${r.id}`),
      };
    });

    const resumo = calcularResumoFinanceiro(receber);
    const key = empresaId ? `${STORAGE_KEYS.RECEBER}_${empresaId}` : STORAGE_KEYS.RECEBER;
    localStorage.setItem(key, JSON.stringify(receber));
    return { data: receber, resumo, isLive: true };
  } catch (err: any) {
    console.error('Erro ao buscar contas a receber do Bling:', err);
  }

  const resumoVazio: ResumoFinanceiro = { totalAberto: 0, totalLiquidado: 0, totalVencido: 0, qtdRegistros: 0 };
  const key = empresaId ? `${STORAGE_KEYS.RECEBER}_${empresaId}` : STORAGE_KEYS.RECEBER;
  localStorage.setItem(key, JSON.stringify([]));
  return { data: [], resumo: resumoVazio, isLive: true };
}

/**
 * Calcula os totais do resumo financeiro
 */
function calcularResumoFinanceiro(contas: (BlingContaPagar | BlingContaReceber)[]): ResumoFinanceiro {
  const hojeStr = new Date().toISOString().slice(0, 10);
  let totalAberto = 0;
  let totalLiquidado = 0;
  let totalVencido = 0;

  contas.forEach(c => {
    if (c.situacao === 2) {
      totalLiquidado += c.valor;
    } else if (c.situacao === 1 || c.situacao === 3) {
      if (c.vencimento < hojeStr) {
        totalVencido += c.valor;
      } else {
        totalAberto += c.valor;
      }
    }
  });

  return {
    totalAberto,
    totalLiquidado,
    totalVencido,
    qtdRegistros: contas.length,
  };
}

/**
 * Função de diagnóstico completo para testar contatos, contas a pagar e contas a receber
 */
export async function obterDiagnosticoBling(customToken?: string): Promise<{
  ok: boolean;
  contatosCount?: number;
  pagarCount?: number;
  receberCount?: number;
  detalhes?: string;
  error?: string;
}> {
  const token = customToken || getStoredBlingToken();
  if (!token) {
    return { ok: false, error: 'Token do Bling não configurado no navegador.' };
  }
  try {
    const [resContatos, resPagar, resReceber] = await Promise.all([
      callBlingApi('/contatos?criterio=1&limite=3', token),
      callBlingApi('/contas/pagar?limite=3', token).catch(() => callBlingApi('/contas-pagar?limite=3', token)),
      callBlingApi('/contas/receber?limite=3', token).catch(() => callBlingApi('/contas-receber?limite=3', token)),
    ]);

    const contatosCount = Array.isArray(resContatos?.data) ? resContatos.data.length : 0;
    const pagarCount = Array.isArray(resPagar?.data) ? resPagar.data.length : 0;
    const receberCount = Array.isArray(resReceber?.data) ? resReceber.data.length : 0;

    return {
      ok: true,
      contatosCount,
      pagarCount,
      receberCount,
      detalhes: `Contatos: ${contatosCount} amostras | Contas a Pagar: ${pagarCount} | Contas a Receber: ${receberCount}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Erro ao consultar API do Bling',
    };
  }
}

/**
 * Busca a lista de produtos reais cadastrados na conta da empresa no Bling (API v3)
 */
export async function carregarProdutosBling(
  customToken?: string,
  _empresaId?: string
): Promise<{ success: boolean; data: CatalogoProduto[]; error?: string }> {
  const token = customToken || getStoredBlingToken() || '';
  if (!token) {
    return { success: false, data: [], error: 'Token do Bling não configurado.' };
  }

  try {
    const resposta = await callBlingApi('/produtos?criterio=1&limite=100', {
      method: 'GET',
      customToken: token,
    });

    const lista = resposta?.data || [];
    if (!Array.isArray(lista) || lista.length === 0) {
      return { success: true, data: [] };
    }

    const produtosConvertidos: CatalogoProduto[] = lista
      .filter((p: any) => p && (p.nome || p.descricao))
      .map((p: any) => {
        const preco = Number(p.preco || p.precoCusto || 0);
        return {
          id: String(p.id || p.codigo || Math.random()),
          codigo: String(p.codigo || `PROD-${p.id || ''}`),
          descricao: String(p.nome || p.descricao || 'Produto Bling'),
          precoUnitario: preco > 0 ? preco : 10.0,
          unidade: String(p.unidade || 'UN').slice(0, 6),
          ncm: String(p.tributacao?.ncm || p.ncm || '25232910').replace(/\D/g, '') || '25232910',
          cfop: '5102',
          categoria: String(p.categoria?.descricao || 'Geral'),
        };
      });

    return { success: true, data: produtosConvertidos };
  } catch (err: any) {
    console.error('Erro ao carregar produtos do Bling:', err);
    return { success: false, data: [], error: err.message };
  }
}

