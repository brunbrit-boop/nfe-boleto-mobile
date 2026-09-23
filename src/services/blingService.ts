import type {
  BlingCliente,
  BlingFornecedor,
  BlingContaPagar,
  BlingContaReceber,
  ResumoFinanceiro,
  BankProvider,
  EmpresaTenant,
} from '../types';
import { formatCurrency, gerarDadosBoletoFebraban, gerarPixCopiaECola } from '../utils/financeEngine';
import { renovarTokenBling, isTokenExpirando } from '../utils/blingApi';
import {
  salvarContasReceberNoBanco,
  salvarContasPagarNoBanco,
  registrarEmpresaNoBanco,
} from './pocketbaseService';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const STORAGE_KEYS = {
  CLIENTES: 'bling_cache_clientes',
  FORNECEDORES: 'bling_cache_fornecedores',
  PAGAR: 'bling_cache_pagar',
  RECEBER: 'bling_cache_receber',
  PRODUTOS: 'bling_cache_produtos',
  LAST_SYNC: 'bling_last_sync_timestamp',
};

export function obterClientesCacheLocal(empresaId?: string): BlingCliente[] {
  try {
    const key = empresaId ? `${STORAGE_KEYS.CLIENTES}_${empresaId}` : STORAGE_KEYS.CLIENTES;
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

export function salvarClientesCacheLocal(empresaId: string | undefined, clientes: BlingCliente[]): void {
  try {
    const key = empresaId ? `${STORAGE_KEYS.CLIENTES}_${empresaId}` : STORAGE_KEYS.CLIENTES;
    localStorage.setItem(key, JSON.stringify(clientes));
  } catch {}
}

export function obterFornecedoresCacheLocal(empresaId?: string): BlingFornecedor[] {
  try {
    const key = empresaId ? `${STORAGE_KEYS.FORNECEDORES}_${empresaId}` : STORAGE_KEYS.FORNECEDORES;
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

export function salvarFornecedoresCacheLocal(empresaId: string | undefined, fornecedores: BlingFornecedor[]): void {
  try {
    const key = empresaId ? `${STORAGE_KEYS.FORNECEDORES}_${empresaId}` : STORAGE_KEYS.FORNECEDORES;
    localStorage.setItem(key, JSON.stringify(fornecedores));
  } catch {}
}

export function obterContasReceberCacheLocal(empresaId?: string): BlingContaReceber[] {
  try {
    const key = empresaId ? `${STORAGE_KEYS.RECEBER}_${empresaId}` : STORAGE_KEYS.RECEBER;
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

export function salvarContasReceberCacheLocal(empresaId: string | undefined, contas: BlingContaReceber[]): void {
  try {
    const key = empresaId ? `${STORAGE_KEYS.RECEBER}_${empresaId}` : STORAGE_KEYS.RECEBER;
    localStorage.setItem(key, JSON.stringify(contas));
  } catch {}
}

export function obterContasPagarCacheLocal(empresaId?: string): BlingContaPagar[] {
  try {
    const key = empresaId ? `${STORAGE_KEYS.PAGAR}_${empresaId}` : STORAGE_KEYS.PAGAR;
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

export function salvarContasPagarCacheLocal(empresaId: string | undefined, contas: BlingContaPagar[]): void {
  try {
    const key = empresaId ? `${STORAGE_KEYS.PAGAR}_${empresaId}` : STORAGE_KEYS.PAGAR;
    localStorage.setItem(key, JSON.stringify(contas));
  } catch {}
}

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
  empresaId?: string;
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

export function marcarEmpresaComoExpirada(token?: string, empresaId?: string | null): void {
  try {
    const rawList = localStorage.getItem('nfe_empresas_list');
    if (rawList) {
      const empresas: any[] = JSON.parse(rawList);
      let alterou = false;
      const cleanTok = (token || '').trim().replace(/^Bearer\s+/i, '');
      const atualizadas = empresas.map((e: any) => {
        const empToken = (e.blingAccessToken || '').trim().replace(/^Bearer\s+/i, '');
        const matches = (empresaId && e.id === empresaId) || (cleanTok && empToken && empToken === cleanTok);
        if (matches) {
          alterou = true;
          // Se possui refresh token, a empresa permanece conectada (com renovação necessária ao interagir)
          const mantemConectado = Boolean(e.blingRefreshToken || e.blingAccessToken);
          return {
            ...e,
            isBlingConectado: mantemConectado,
            isBlingExpirado: true,
          };
        }
        return e;
      });
      if (alterou) {
        localStorage.setItem('nfe_empresas_list', JSON.stringify(atualizadas));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nfe_empresas_updated'));
        }
      }
    }
  } catch {}
}

let promessaRenovacaoEmAndamento: Promise<string | null> | null = null;
let timestampUltimaTentativaRenovacao = 0;

/**
 * Tenta renovar o token de uma empresa ou do sistema caso esteja expirado
 * Possui trava anti-concorrência e cooldown para evitar HTTP 429 (Too Many Requests)
 */
export async function tentarAutoRenovarToken(tokenAtual?: string, empresaIdParam?: string): Promise<string | null> {
  if (promessaRenovacaoEmAndamento) {
    return promessaRenovacaoEmAndamento;
  }

  // Cooldown de 5 segundos se falhou recentemente
  if (Date.now() - timestampUltimaTentativaRenovacao < 5000) {
    return null;
  }

  timestampUltimaTentativaRenovacao = Date.now();

  promessaRenovacaoEmAndamento = (async () => {
    try {
      let refreshToken = '';
      let clientId = '';
      let clientSecret = '';
      let empresaIdAlvo: string | null = empresaIdParam || null;

      const cleanTokenAtual = (tokenAtual || '').trim().replace(/^Bearer\s+/i, '');
      const ativaAtual = localStorage.getItem('nfe_empresa_ativa_id');

      const rawList = localStorage.getItem('nfe_empresas_list');
      let empresasCadastradas: any[] = [];
      if (rawList) {
        try {
          empresasCadastradas = JSON.parse(rawList);
          const emp = empresasCadastradas.find((e: any) => {
            if (empresaIdParam && e.id === empresaIdParam) return true;
            const empToken = (e.blingAccessToken || '').trim().replace(/^Bearer\s+/i, '');
            return cleanTokenAtual && empToken === cleanTokenAtual;
          }) || (cleanTokenAtual ? null : empresasCadastradas.find((e: any) => e.id === ativaAtual));

          if (emp) {
            empresaIdAlvo = emp.id;
            if (emp.blingRefreshToken) {
              refreshToken = emp.blingRefreshToken;
            }
            clientId = emp.blingClientId || '';
            clientSecret = emp.blingClientSecret || '';
          }
        } catch {}
      }

      // Se a empresa ainda não tem clientId/clientSecret isolados, tenta buscar nos pending creds
      if ((!clientId || !clientSecret) && empresaIdAlvo) {
        const rawPending = localStorage.getItem(`bling_pending_${empresaIdAlvo}`);
        if (rawPending) {
          try {
            const p = JSON.parse(rawPending);
            clientId = clientId || p.clientId || '';
            clientSecret = clientSecret || p.clientSecret || '';
          } catch {}
        }
      }

      // Fallback global apenas para a empresa inicial ou quando há apenas 1 empresa cadastrada
      if ((!refreshToken || !clientId) && (empresaIdAlvo === 'emp_default_1' || empresasCadastradas.length <= 1)) {
        refreshToken = refreshToken || localStorage.getItem('bling_refresh_token') || '';
        clientId = clientId || localStorage.getItem('bling_client_id') || '';
        clientSecret = clientSecret || localStorage.getItem('bling_client_secret') || '';
      }

      if (!refreshToken) {
        return null;
      }

      const res = await renovarTokenBling(refreshToken, clientId, clientSecret, empresaIdAlvo || undefined);
      if (res.success && res.accessToken) {
        if (rawList) {
          try {
            const empresas: any[] = JSON.parse(rawList);
            const atualizadas = empresas.map((e: any) => {
              const isMatch = empresaIdAlvo
                ? e.id === empresaIdAlvo
                : (e.blingRefreshToken === refreshToken || (cleanTokenAtual && (e.blingAccessToken || '').includes(cleanTokenAtual)));

              if (isMatch) {
                return {
                  ...e,
                  blingAccessToken: res.accessToken,
                  blingRefreshToken: res.refreshToken || e.blingRefreshToken,
                  blingTokenExpiresAt: res.expiresAt,
                  isBlingConectado: true,
                  isBlingExpirado: false,
                };
              }
              return e;
            });
            localStorage.setItem('nfe_empresas_list', JSON.stringify(atualizadas));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nfe_empresas_updated'));
            }
          } catch {}
        }

        // Apenas atualiza storage global se a empresa renovada for a atualmente ativa
        if (!empresaIdAlvo || empresaIdAlvo === ativaAtual) {
          localStorage.setItem('bling_access_token', res.accessToken);
          if (res.refreshToken) {
            localStorage.setItem('bling_refresh_token', res.refreshToken);
          }
          if (res.expiresAt) {
            localStorage.setItem('bling_expires_at', String(res.expiresAt));
          }
        }

        console.log('✅ Token do Bling auto-renovado com sucesso para empresa:', empresaIdAlvo || 'ativa');
        return res.accessToken;
      } else {
        console.warn('Falha na renovação do token do Bling:', res.error);
        if (empresaIdAlvo) {
          marcarEmpresaComoExpirada(cleanTokenAtual, empresaIdAlvo);
        }
      }
    } catch (err) {
      console.warn('Falha na auto-renovação de token do Bling:', err);
    } finally {
      promessaRenovacaoEmAndamento = null;
    }
    return null;
  })();

  return promessaRenovacaoEmAndamento;
}

/**
 * Função utilitária para fetch com timeout controlado
 */
export async function fetchComTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 20000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Realiza requisição para a API v3 do Bling (via Proxy Vercel ou direta)
 * Suporta passar token específico de uma empresa ou objeto de opções completo
 * Possui auto-refresh preventivo e reativo (401) com rotação de refresh_token
 */
export async function callBlingApi(
  endpoint: string,
  optionsOrToken?: string | BlingApiOptions,
  isRetry: boolean = false
): Promise<any> {
  let customToken: string | undefined;
  let method: string = 'GET';
  let body: any = undefined;
  let empresaId: string | undefined = undefined;

  if (typeof optionsOrToken === 'string') {
    customToken = optionsOrToken;
  } else if (optionsOrToken && typeof optionsOrToken === 'object') {
    customToken = optionsOrToken.customToken;
    method = optionsOrToken.method || 'GET';
    body = optionsOrToken.body;
    empresaId = optionsOrToken.empresaId;
  }

  const rawToken = customToken !== undefined ? customToken : getStoredBlingToken();
  let token = (rawToken || '').trim().replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('Token do Bling não configurado para esta empresa.');
  }

  // Auto-refresh preventivo se o token estiver prestes a expirar nos próximos 15 minutos
  if (!isRetry) {
    const rawExpiresAt = localStorage.getItem('bling_expires_at');
    const expiresAtNum = rawExpiresAt ? Number(rawExpiresAt) : undefined;
    if (isTokenExpirando(expiresAtNum, 15)) {
      const renovado = await tentarAutoRenovarToken(token, empresaId);
      if (renovado) {
        token = renovado;
      }
    }
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
    const response = await fetchComTimeout(proxyUrl, {
      method,
      headers: requestHeaders,
      body: serializedBody,
    }, 20000);

    const data = await response.json().catch(() => null);

    // Se retornou 401 ou token expirado, tenta renovar e reexecutar a requisição
    if (!isRetry && (response.status === 401 || (data?.error && String(data.error.message || data.error.description || '').toLowerCase().includes('token')))) {
      const renovado = await tentarAutoRenovarToken(token, empresaId);
      if (renovado) {
        const nextOptions: BlingApiOptions = typeof optionsOrToken === 'object'
          ? { ...optionsOrToken, customToken: renovado, empresaId }
          : { customToken: renovado, method: method as any, body, empresaId };
        return callBlingApi(endpoint, nextOptions, true);
      } else {
        if (empresaId) {
          marcarEmpresaComoExpirada(token, empresaId);
        }
        throw new Error('Token do Bling expirado ou inválido (a validade do token é de 6 horas). Por favor, reconecte a empresa na tela inicial.');
      }
    }

    // Quando o Bling não tem registros para a consulta GET, retorna HTTP 404 (RESOURCE_NOT_FOUND)
    if ((method === 'GET' || !method) && (response.status === 404 || data?.error?.type === 'RESOURCE_NOT_FOUND')) {
      return { data: [] };
    }

    if (response.ok && data && typeof data === 'object') {
      return data;
    } else if (!response.ok || (data && data?.error)) {
      const msg = extrairMensagemErroBling(data, response.status);
      throw new Error(msg);
    }
  } catch (proxyErr: any) {
    if (proxyErr.message && !proxyErr.message.includes('fetch') && !proxyErr.message.includes('Failed to fetch') && !proxyErr.message.includes('aborted')) {
      throw proxyErr;
    }
  }

  // 2. Se em localhost e falhou o proxy relativo, tenta o proxy público de produção da Vercel
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    try {
      const vercelProxyUrl = `https://nfe-boleto-mobile.vercel.app/api/bling-proxy?endpoint=${encodeURIComponent(cleanEndpoint)}`;
      const vRes = await fetchComTimeout(vercelProxyUrl, {
        method,
        headers: requestHeaders,
        body: serializedBody,
      }, 20000);
      const vData = await vRes.json().catch(() => null);

      if (!isRetry && (vRes.status === 401 || (vData?.error && String(vData.error.message || vData.error.description || '').toLowerCase().includes('token')))) {
        const renovado = await tentarAutoRenovarToken(token, empresaId);
        if (renovado) {
          const nextOptions: BlingApiOptions = typeof optionsOrToken === 'object'
            ? { ...optionsOrToken, customToken: renovado, empresaId }
            : { customToken: renovado, method: method as any, body, empresaId };
          return callBlingApi(endpoint, nextOptions, true);
        } else {
          if (empresaId) {
            marcarEmpresaComoExpirada(token, empresaId);
          }
          throw new Error('Token do Bling expirado ou inválido (a validade do token é de 6 horas). Por favor, reconecte a empresa na tela inicial.');
        }
      }

      if ((method === 'GET' || !method) && (vRes.status === 404 || vData?.error?.type === 'RESOURCE_NOT_FOUND')) {
        return { data: [] };
      }
      if (vRes.ok && vData && typeof vData === 'object') {
        return vData;
      } else if (!vRes.ok || (vData && vData?.error)) {
        const msg = vData?.error?.description || vData?.error?.message || extrairMensagemErroBling(vData, vRes.status);
        throw new Error(msg);
      }
    } catch (vErr: any) {
      if (vErr.message && !vErr.message.includes('fetch') && !vErr.message.includes('Failed to fetch') && !vErr.message.includes('aborted')) {
        throw vErr;
      }
    }
  }

  // 3. Fallback direto via api.bling.com.br
  const directUrl = `https://api.bling.com.br/Api/v3${cleanEndpoint}`;
  const directRes = await fetchComTimeout(directUrl, {
    method,
    headers: requestHeaders,
    body: serializedBody,
  }, 15000);

  const directData = await directRes.json().catch(() => null);

  if (!isRetry && (directRes.status === 401 || (directData?.error && String(directData.error.message || directData.error.description || '').toLowerCase().includes('token')))) {
    const renovado = await tentarAutoRenovarToken(token, empresaId);
    if (renovado) {
      const nextOptions: BlingApiOptions = typeof optionsOrToken === 'object'
        ? { ...optionsOrToken, customToken: renovado, empresaId }
        : { customToken: renovado, method: method as any, body, empresaId };
      return callBlingApi(endpoint, nextOptions, true);
    } else {
      if (empresaId) {
        marcarEmpresaComoExpirada(token, empresaId);
      }
      throw new Error('Token do Bling expirado ou inválido (a validade do token é de 6 horas). Por favor, reconecte a empresa na tela inicial.');
    }
  }

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
  primeiroVencimento?: string;
  intervaloDias?: number;
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
  const {
    empresaToken,
    cliente,
    itens,
    parcelasCount = 1,
    primeiroVencimento,
    intervaloDias = 15,
  } = params;

  if (!empresaToken || !empresaToken.trim()) {
    return {
      sucesso: false,
      mensagem: 'Esta empresa não possui um Token de Acesso do Bling ativo configurado. Conecte as chaves da empresa nas configurações antes de gravar notas fiscais.',
    };
  }

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
  if (cliente.id && cliente.id > 100000) {
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

  // Itens formatados rigorosamente de acordo com a API v3 do Bling (POST /nfe)
  const itensPayload = itens.map((it, idx) => ({
    codigo: (it.codigo && it.codigo.trim()) || (it.id && it.id.trim()) || `ITEM-${idx + 1}`,
    descricao: it.descricao,
    unidade: (it.unidade || 'UN').slice(0, 6),
    quantidade: it.quantidade,
    valor: it.valorUnitario,
    tipo: 'P', // P = Produto
    classificacaoFiscal: (it.ncm || '').replace(/\D/g, '') || '25232910',
  }));

  // Parcelas financeiras e cálculo do vencimento
  const valorTotal = Number(itens.reduce((acc, it) => acc + it.valorTotal, 0).toFixed(2));
  const parcelasPayload = [];
  const valorParcelaBase = Number((valorTotal / parcelasCount).toFixed(2));
  let acumulado = 0;

  // Determina a data base da primeira parcela
  let dataBase = new Date();
  if (primeiroVencimento && /^\d{4}-\d{2}-\d{2}$/.test(primeiroVencimento)) {
    const [ano, mes, dia] = primeiroVencimento.split('-').map(Number);
    dataBase = new Date(ano, mes - 1, dia);
  } else {
    dataBase.setDate(dataBase.getDate() + (intervaloDias || 15));
  }

  const formatarDataBr = (d: Date): string => {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const formatarDataIso = (d: Date): string => {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${ano}-${mes}-${dia}`;
  };

  const parcelasDescricoes: string[] = [];

  for (let i = 1; i <= parcelasCount; i++) {
    const d = new Date(dataBase);
    if (i > 1) {
      d.setDate(d.getDate() + (i - 1) * (intervaloDias || 15));
    }
    const dataVenc = formatarDataIso(d);
    const dataVencBr = formatarDataBr(d);

    // Ajuste de centavos na última parcela
    const valorParcela = i === parcelasCount ? Number((valorTotal - acumulado).toFixed(2)) : valorParcelaBase;
    acumulado += valorParcela;

    parcelasPayload.push({
      data: dataVenc,
      valor: valorParcela,
      observacoes: `Parcela ${i}/${parcelasCount}`,
    });

    const valorFormatado = valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    parcelasDescricoes.push(`Parcela ${i}/${parcelasCount}: ${dataVencBr} (${valorFormatado})`);
  }

  // Monta as informações complementares da nota com as datas e valores das parcelas
  const textoInformacoesComplementares = `Condições de Pagamento: ${parcelasDescricoes.join(' | ')}`;

  const payload: any = {
    tipo: 1, // 1 = Nota Fiscal de Saída (Vendas > Notas Fiscais)
    dataOperacao: dataHoje,
    contato: contatoPayload,
    itens: itensPayload,
    observacoes: textoInformacoesComplementares,
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

    if (!idGerado) {
      return {
        sucesso: false,
        mensagem: resposta?.mensagem || resposta?.error?.description || 'O Bling não retornou o ID da nota fiscal criada.',
        raw: data || resposta,
      };
    }

    return {
      sucesso: true,
      idNotaBling: idGerado,
      numeroNota: numeroGerado,
      serie: serieGerada,
      mensagem: `Esboço de NF-e gravado com sucesso no Bling (ID: ${idGerado}). Localize em Vendas > Notas Fiscais.`,
      raw: data || resposta,
    };
  } catch (error: any) {
    // Se a chamada demorou ou a conexão foi interrompida, verifica se o Bling já gravou a nota recentemente
    try {
      const buscaRecente = await callBlingApi('/nfe?limite=5&criterio=1', {
        method: 'GET',
        customToken: empresaToken,
      });
      const notas = buscaRecente?.data || [];
      if (Array.isArray(notas) && notas.length > 0) {
        const encontrada = notas.find((n: any) => {
          const doc = (n.contato?.numeroDocumento || '').replace(/\D/g, '');
          const mesmoDoc = doc && doc === docLimpo;
          const mesmoNome = n.contato?.nome?.toLowerCase() === cliente.nome?.toLowerCase();
          const difValor = n.valorTotal ? Math.abs(Number(n.valorTotal) - valorTotal) : 999;
          return (mesmoDoc || mesmoNome) && difValor < 0.1;
        });

        if (encontrada && encontrada.id) {
          return {
            sucesso: true,
            idNotaBling: encontrada.id,
            numeroNota: encontrada.numero ? String(encontrada.numero) : undefined,
            serie: encontrada.serie ? String(encontrada.serie) : undefined,
            mensagem: `Esboço de NF-e confirmado com sucesso no Bling (ID: ${encontrada.id}). Localize em Vendas > Notas Fiscais.`,
            raw: encontrada,
          };
        }
      }
    } catch {}

    return {
      sucesso: false,
      mensagem: error.message || 'Erro ao gravar esboço de nota fiscal no Bling.',
    };
  }
}

/**
 * Extrai os dados cadastrais da empresa através do token do Bling (Razão Social, Nome Fantasia, CNPJ, Cidade, UF)
 */
export async function obterDadosEmpresaBling(token: string, empresaId?: string): Promise<{
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
      const res = await callBlingApi('/empresas/me/dados-basicos', { customToken: cleanToken, empresaId });
      if (res && res.data) {
        dataEmpresa = res.data;
      } else if (res && (res.nome || res.cnpj)) {
        dataEmpresa = res;
      }
    } catch (e: any) {
      console.warn('Tentativa /empresas/me/dados-basicos falhou:', e?.message);
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('token') || msg.includes('401') || msg.includes('429') || msg.includes('expir')) {
        return {
          success: false,
          razaoSocial: '',
          nomeFantasia: '',
          cnpj: '',
          mensagem: e?.message || 'Token inválido ou expirado.',
        };
      }
    }

    // 2. Se não encontrou, tenta rota alternativa /empresas
    if (!dataEmpresa) {
      try {
        const resEmp = await callBlingApi('/empresas', { customToken: cleanToken, empresaId });
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
  // Isolamento Multi-Tenant: se não há token para esta empresa, não consulta outra conta nem preenche dados cruzados
  if (!token || !token.trim()) {
    return { data: [], isLive: false };
  }

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
      await sleep(350);
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
  if (!token || !token.trim()) {
    return { data: [], isLive: false };
  }

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
  const resumoVazio: ResumoFinanceiro = { totalAberto: 0, totalLiquidado: 0, totalVencido: 0, qtdRegistros: 0 };
  if (!token || !token.trim()) {
    return { data: [], resumo: resumoVazio, isLive: false };
  }

  try {
    const todasContas: any[] = [];
    let pagina = 1;
    const limite = 100;
    const maxPaginas = 15;

    while (pagina <= maxPaginas) {
      let response: any;
      try {
        response = await callBlingApi(`/contas-pagar?limite=${limite}&pagina=${pagina}`, token);
      } catch (err: any) {
        response = await callBlingApi(`/contas/pagar?limite=${limite}&pagina=${pagina}`, token).catch(() => null);
      }

      let records = (response && response.data && Array.isArray(response.data)) ? response.data : [];
      if (records.length === 0 && pagina === 1) {
        const alt = await callBlingApi(`/contas/pagar?limite=${limite}&pagina=${pagina}`, token).catch(() => null);
        if (alt && alt.data && Array.isArray(alt.data) && alt.data.length > 0) {
          records = alt.data;
        }
      }

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
  const resumoVazio: ResumoFinanceiro = { totalAberto: 0, totalLiquidado: 0, totalVencido: 0, qtdRegistros: 0 };
  if (!token || !token.trim()) {
    return { data: [], resumo: resumoVazio, isLive: false };
  }

  try {
    const todasContas: any[] = [];
    let pagina = 1;
    const limite = 100;
    const maxPaginas = 15;

    while (pagina <= maxPaginas) {
      let response: any;
      try {
        response = await callBlingApi(`/contas-receber?limite=${limite}&pagina=${pagina}`, token);
      } catch (err: any) {
        response = await callBlingApi(`/contas/receber?limite=${limite}&pagina=${pagina}`, token).catch(() => null);
      }

      let records = (response && response.data && Array.isArray(response.data)) ? response.data : [];
      if (records.length === 0 && pagina === 1) {
        const alt = await callBlingApi(`/contas/receber?limite=${limite}&pagina=${pagina}`, token).catch(() => null);
        if (alt && alt.data && Array.isArray(alt.data) && alt.data.length > 0) {
          records = alt.data;
        }
      }

      if (records.length === 0) break;
      todasContas.push(...records);

      if (records.length < limite) break;
      pagina++;
    }

    const receber: BlingContaReceber[] = todasContas.map((r: any, idx: number) => {
      const val = Number(r.valor || r.saldo || 0);
      const venc = r.vencimento || r.dataVencimento || r.dataEmissao || new Date().toISOString().slice(0, 10);
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
      callBlingApi('/contas-pagar?limite=3', token).then(r => (r?.data?.length ? r : callBlingApi('/contas/pagar?limite=3', token).catch(() => r))),
      callBlingApi('/contas-receber?limite=3', token).then(r => (r?.data?.length ? r : callBlingApi('/contas/receber?limite=3', token).catch(() => r))),
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
/**
 * Obtém produtos salvos no cache local para a empresa selecionada
 */
export function obterProdutosCacheLocal(empresaId?: string): CatalogoProduto[] {
  try {
    const key = empresaId ? `${STORAGE_KEYS.PRODUTOS}_${empresaId}` : STORAGE_KEYS.PRODUTOS;
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return [];
}

/**
 * Salva produtos no cache local para a empresa
 */
export function salvarProdutosCacheLocal(
  empresaId: string | undefined,
  produtos: CatalogoProduto[],
  dataSync: string = new Date().toISOString()
): void {
  try {
    const key = empresaId ? `${STORAGE_KEYS.PRODUTOS}_${empresaId}` : STORAGE_KEYS.PRODUTOS;
    localStorage.setItem(key, JSON.stringify(produtos));
    localStorage.setItem(`${key}_timestamp`, dataSync);
  } catch {}
}

/**
 * Retorna data/hora da última sincronização de produtos da empresa
 */
export function obterDataUltimaSyncProdutos(empresaId?: string): string | null {
  try {
    const key = empresaId ? `${STORAGE_KEYS.PRODUTOS}_${empresaId}_timestamp` : `${STORAGE_KEYS.PRODUTOS}_timestamp`;
    return localStorage.getItem(key);
  } catch {}
  return null;
}

/**
 * Verifica se um produto do Bling pertence à categoria de Materiais de Construção
 * Analisa rigorosamente:
 * 1. NCM (Capítulos e posições fiscais de insumos da construção civil)
 * 2. Nome, descrição e categoria cadastrada no Bling
 */
export function isProdutoMaterialConstrucao(p: any): boolean {
  if (!p) return false;

  const texto = `${p.nome || ''} ${p.descricao || ''} ${p.categoria?.descricao || ''} ${p.codigo || ''}`.toLowerCase();
  const ncm = String(p.tributacao?.ncm || p.ncm || '').replace(/\D/g, '');

  // 1. NCMs prioritários da construção civil
  const ncmsConstrucaoPrefixos = [
    // Cimento, cal, gesso, areia, brita, pedrisco
    '2505', '2517', '2520', '2521', '2522', '2523',
    // Argamassas, aditivos, concreto, refratários
    '38245', '38244', '3816',
    // Obras de cimento, fibrocimento, gesso, drywall
    '6806', '6807', '6808', '6809', '6810', '6811',
    // Cerâmica, tijolo, bloco, telha cerâmica, pisos, azulejos, louças sanitárias
    '6901', '6902', '6904', '6905', '6906', '6907', '6908', '6910',
    // Vidros planos para construção
    '7003', '7004', '7005', '7007', '7016',
    // Aço, ferro, vergalhão, arame, tela, perfil
    '7213', '7214', '7215', '7216', '7217',
    // Treliças, telas soldadas, tubos de aço, conexões, pregos, parafusos, buchas
    '7303', '7304', '7305', '7306', '7307', '7308', '7312', '7314', '7317', '7318',
    // Tubos, conexões, calhas, caixas d'água de plástico (PVC, PPR, CPVC)
    '3917', '3922', '3925',
    // Tintas, vernizes, massas (corrida/acrílica), seladores, impermeabilizantes
    '3208', '3209', '3210', '3214', '2715', '3506',
    // Elétrica básica de construção (fios, cabos, conduítes, disjuntores, tomadas)
    '8544', '8536', '8537', '8538', '8547',
    // Madeiras para obra (vigas, tábuas, compensados, portas, batentes)
    '4407', '4409', '4410', '4411', '4412', '4418',
    // Esquadrias de alumínio
    '7610',
  ];

  if (ncm.length >= 4 && ncmsConstrucaoPrefixos.some((pref) => ncm.startsWith(pref))) {
    return true;
  }

  // 2. Palavras-chave no nome ou descrição do produto
  const termosConstrucao = [
    // Cimento / Aglomerantes / Agregados
    'cimento', 'votoran', 'caupe', 'tupi', 'nassau', 'montes claros', 'ciplan', 'intercement',
    'areia', 'brita', 'pedrisco', 'pedra britada', 'saibro', 'argamassa', 'rejunte', 'cal ', 'cal hidr', 'gesso', 'drywall',
    'tijolo', 'bloco', 'canaleta', 'telha', 'laje', 'mourao', 'mourão', 'meio fio', 'meio-fio', 'pingadeira', 'combogo', 'cobogo',
    // Acabamento / Cerâmica
    'piso', 'porcelanato', 'revestimento', 'azulejo', 'ceramica', 'cerâmica', 'rodape', 'rodapé', 'soleira', 'peitoril',
    // Aço / Ferro / Fixação
    'vergalhao', 'vergalhão', 'ca-50', 'ca-60', 'ca50', 'ca60', 'trelica', 'treliça', 'malha pop', 'malha ferro',
    'arame', 'recozido', 'galvanizado', 'prego', 'parafuso', 'bucha', 'chumbador', 'barra roscada', 'cantoneira',
    // Hidráulica / Tubos
    'tubo', 'cano', 'conexao', 'conexão', 'joelho', 'cotovelo', 'luva', 'adaptador', 'registro', 'ralo',
    'caixa dagua', "caixa d'água", 'caixa dágua', 'sifao', 'sifão', 'torneira', 'valvula', 'válvula', 'tigre', 'amanco', 'krona',
    'soldavel', 'soldável', 'esgoto', 'pluvial', 'pvc', 'calha', 'grelha',
    // Tintas / Pintura / Impermeabilização
    'tinta', 'esmalte', 'latex', 'látex', 'acrilica', 'acrílica', 'verniz', 'selador', 'massa corrida', 'massa acrilica', 'massa acrílica',
    'impermeabilizante', 'vedacit', 'vedapren', 'sika', 'viapol', 'neutrol', 'manta asfalt', 'silicone', 'selante', 'cola pva', 'thinner', 'aguarras', 'aguarrás',
    'rolo la', 'rolo lã', 'pincel', 'trincha', 'fita crepe', 'lixa',
    // Elétrica básica de obra
    'fio ', 'fio flex', 'cabo flex', 'conduite', 'conduíte', 'corrugado', 'disjuntor', 'interruptor', 'tomada', 'barramento',
    // Madeira / Esquadrias
    'tabua', 'tábua', 'viga', 'caibro', 'ripa', 'sarrafo', 'compensado', 'esquadria', 'fechadura', 'dobradica', 'dobradiça',
    // Geral construção
    'construcao', 'construção', 'obra', 'alvenaria', 'hidraulica', 'hidráulica', 'eletrica', 'elétrica', 'ferragem'
  ];

  return termosConstrucao.some((termo) => texto.includes(termo));
}

/**
 * Obtém se a empresa deve filtrar estritamente produtos de material de construção
 */
export function obterFiltroMaterialConstrucao(empresaId?: string, nomeEmpresa?: string): boolean {
  if (!empresaId) return false;
  try {
    const salvo = localStorage.getItem(`filtro_construcao_${empresaId}`);
    if (salvo !== null) {
      return salvo === 'true';
    }
  } catch {}

  // Se for a empresa Guias Comércio, ativa por padrão para proteger o armazenamento do navegador
  if (nomeEmpresa) {
    const nomeNorm = nomeEmpresa.toLowerCase();
    if (nomeNorm.includes('guias') || nomeNorm.includes('construcao') || nomeNorm.includes('construção')) {
      return true;
    }
  }
  return false;
}

/**
 * Salva a preferência de filtro de material de construção para a empresa
 */
export function salvarFiltroMaterialConstrucao(empresaId: string, ativo: boolean): void {
  try {
    localStorage.setItem(`filtro_construcao_${empresaId}`, ativo ? 'true' : 'false');
  } catch {}
}

/**
 * Busca a lista de produtos reais cadastrados na conta da empresa no Bling (API v3)
 * Realiza paginação profunda e permite o filtro inteligente de descarte para Material de Construção
 * Ao filtrar construção, descarta os itens desnecessários em tempo real a cada página de 100 itens,
 * permitindo varrer até 150 páginas (15.000 produtos) sem consumir a memória do navegador.
 */
export async function carregarProdutosBling(
  customToken?: string,
  empresaId?: string,
  apenasMaterialConstrucao?: boolean,
  onProgresso?: (info: { pagina: number; produtosEncontrados: number; totalDescartados: number }) => void
): Promise<{
  success: boolean;
  data: CatalogoProduto[];
  rawData?: any[];
  totalCount?: number;
  totalDescartados?: number;
  filtroConstrucaoAtivo?: boolean;
  error?: string;
}> {
  const token = (customToken !== undefined ? customToken : (getStoredBlingToken() || '')).trim();
  if (!token) {
    // Se não tiver token, retorna estritamente a base local desta empresa
    const locais = obterProdutosCacheLocal(empresaId);
    return { success: true, data: locais, totalCount: locais.length };
  }

  // Determina se o filtro de descarte inteligente deve ser aplicado
  const filtrarConstrucao =
    apenasMaterialConstrucao !== undefined
      ? apenasMaterialConstrucao
      : obterFiltroMaterialConstrucao(empresaId);

  try {
    let produtosSelecionados: any[] = [];
    let totalDescartados = 0;
    let pagina = 1;
    let temMais = true;

    // Se estiver filtrando construção, varre sem travas rígidas (até 150 páginas = 15.000 produtos analisados do Bling)
    // Se não estiver filtrando, limita a 15 páginas (1.500 produtos) para não estourar o localStorage
    const limitePaginas = filtrarConstrucao ? 150 : 15;

    while (temMais && pagina <= limitePaginas) {
      const resposta = await callBlingApi(`/produtos?criterio=5&limite=100&pagina=${pagina}`, {
        method: 'GET',
        customToken: token,
      });

      const lista = resposta?.data || [];
      if (Array.isArray(lista) && lista.length > 0) {
        if (filtrarConstrucao) {
          // Filtra em tempo real a cada página de 100 itens
          const construcaoDaPagina = lista.filter(
            (p: any) => p && (p.nome || p.descricao) && isProdutoMaterialConstrucao(p)
          );
          const descartadosDaPagina = lista.length - construcaoDaPagina.length;

          produtosSelecionados.push(...construcaoDaPagina);
          totalDescartados += descartadosDaPagina;
        } else {
          produtosSelecionados.push(...lista.filter((p: any) => p && (p.nome || p.descricao)));
        }

        onProgresso?.({
          pagina,
          produtosEncontrados: produtosSelecionados.length,
          totalDescartados,
        });

        if (lista.length < 100) {
          temMais = false;
        } else {
          pagina++;
          await sleep(350);
        }
      } else {
        temMais = false;
      }
    }

    // Se criterio=5 retornar vazio na primeira página, faz fallback sem o parâmetro de critério
    if (produtosSelecionados.length === 0 && totalDescartados === 0) {
      await sleep(350);
      const fallback = await callBlingApi(`/produtos?limite=100&pagina=1`, {
        method: 'GET',
        customToken: token,
      });
      const fallbackLista = fallback?.data || [];
      if (Array.isArray(fallbackLista)) {
        if (filtrarConstrucao) {
          const construcao = fallbackLista.filter(
            (p: any) => p && (p.nome || p.descricao) && isProdutoMaterialConstrucao(p)
          );
          produtosSelecionados.push(...construcao);
          totalDescartados += fallbackLista.length - construcao.length;
        } else {
          produtosSelecionados.push(...fallbackLista.filter((p: any) => p && (p.nome || p.descricao)));
        }
      }
    }

    if (produtosSelecionados.length === 0 && totalDescartados === 0) {
      const locais = obterProdutosCacheLocal(empresaId);
      if (locais.length > 0) {
        return { success: true, data: locais, rawData: [], totalCount: locais.length };
      }
      return { success: true, data: [], rawData: [], totalCount: 0 };
    }

    console.log(
      `🏗️ Varredura Bling Concluída: ${pagina} páginas analisadas. ${produtosSelecionados.length} mantidos, ${totalDescartados} descartados.`
    );

    const produtosConvertidos: CatalogoProduto[] = produtosSelecionados.map((p: any) => {
      const preco = Number(p.preco || p.precoCusto || 0);
      return {
        id: String(p.id || p.codigo || Math.random()),
        codigo: String(p.codigo || `PROD-${p.id || ''}`),
        descricao: String(p.nome || p.descricao || 'Produto Bling'),
        precoUnitario: preco > 0 ? preco : 10.0,
        unidade: String(p.unidade || 'UN').slice(0, 6),
        ncm: String(p.tributacao?.ncm || p.ncm || '25232910').replace(/\D/g, '') || '25232910',
        cfop: '5102',
        categoria: String(p.categoria?.descricao || (filtrarConstrucao ? 'Material de Construção' : 'Geral')),
      };
    });

    // Salva automaticamente na base de cache local da empresa
    salvarProdutosCacheLocal(empresaId, produtosConvertidos);

    console.log(
      `📦 Produtos Bling salvos no cache local: ${produtosConvertidos.length} itens. (Filtro Construção: ${filtrarConstrucao ? 'ATIVO' : 'DESLIGADO'})`
    );

    return {
      success: true,
      data: produtosConvertidos,
      rawData: produtosSelecionados,
      totalCount: produtosConvertidos.length,
      totalDescartados,
      filtroConstrucaoAtivo: filtrarConstrucao,
    };
  } catch (err: any) {
    console.error('Erro ao carregar produtos do Bling:', err);
    // Em caso de falha de conexão, retorna o cache local existente
    const locais = obterProdutosCacheLocal(empresaId);
    if (locais.length > 0) {
      return { success: true, data: locais, totalCount: locais.length };
    }
    return { success: false, data: [], error: err.message };
  }
}

export interface ProgressoSincronizacao {
  etapa: number;
  totalEtapas: number;
  nomeEtapa: string;
  porcentagem: number;
  mensagem: string;
  totalProdutos?: number;
  totalClientes?: number;
  totalFornecedores?: number;
  sucesso?: boolean;
  erro?: string;
}

/**
 * Motor de Sincronização Inteligente em Etapas com Throttling Seguro (respeita a taxa da API v3 do Bling)
 * Evita o erro 429 Too Many Requests ao executar cada etapa sequencialmente com intervalos programados.
 */
export async function sincronizarEmpresaBlingCompleto(
  empresa: EmpresaTenant,
  onProgress?: (p: ProgressoSincronizacao) => void
): Promise<{
  sucesso: boolean;
  clientes: BlingCliente[];
  fornecedores: BlingFornecedor[];
  produtos: CatalogoProduto[];
  mensagem: string;
}> {
  const token = (empresa.blingAccessToken || '').trim();
  if (!token) {
    const msg = 'Esta empresa não possui um Token de Acesso do Bling ativo configurado.';
    onProgress?.({
      etapa: 0,
      totalEtapas: 5,
      nomeEtapa: 'Erro',
      porcentagem: 0,
      mensagem: msg,
      sucesso: false,
      erro: msg,
    });
    return {
      sucesso: false,
      clientes: obterClientesCacheLocal(empresa.id),
      fornecedores: obterFornecedoresCacheLocal(empresa.id),
      produtos: obterProdutosCacheLocal(empresa.id),
      mensagem: msg,
    };
  }

  // Notifica início
  const notificarAtualizacaoStatus = (emAndamento: boolean, msg: string, prog: number, produtosCount?: number, clientesCount?: number) => {
    try {
      const rawList = localStorage.getItem('nfe_empresas_list');
      if (rawList) {
        const list: EmpresaTenant[] = JSON.parse(rawList);
        const idx = list.findIndex((e) => e.id === empresa.id);
        if (idx >= 0) {
          list[idx].statusSincronizacao = {
            emAndamento,
            progresso: prog,
            mensagem: msg,
            concluidoEm: !emAndamento ? new Date().toISOString() : list[idx].statusSincronizacao?.concluidoEm,
            totalProdutos: produtosCount !== undefined ? produtosCount : list[idx].statusSincronizacao?.totalProdutos,
            totalClientes: clientesCount !== undefined ? clientesCount : list[idx].statusSincronizacao?.totalClientes,
          };
          if (!emAndamento) {
            list[idx].ultimaSincronizacao = new Date().toISOString();
          }
          localStorage.setItem('nfe_empresas_list', JSON.stringify(list));
          window.dispatchEvent(new Event('storage'));
        }
      }
    } catch {}
  };

  try {
    // ----------------------------------------------------
    // Etapa 1 / 5: Dados Cadastrais da Empresa (20%)
    // ----------------------------------------------------
    onProgress?.({
      etapa: 1,
      totalEtapas: 5,
      nomeEtapa: 'Dados da Empresa',
      porcentagem: 20,
      mensagem: 'Verificando cadastro da empresa no Bling...',
    });
    notificarAtualizacaoStatus(true, 'Verificando cadastro da empresa no Bling...', 20);

    try {
      const dadosEmpresa = await obterDadosEmpresaBling(token);
      if (dadosEmpresa.success && dadosEmpresa.razaoSocial) {
        const rawList = localStorage.getItem('nfe_empresas_list');
        if (rawList) {
          const list: EmpresaTenant[] = JSON.parse(rawList);
          const idx = list.findIndex((e) => e.id === empresa.id);
          if (idx >= 0) {
            list[idx].razaoSocial = dadosEmpresa.razaoSocial || list[idx].razaoSocial;
            list[idx].nomeFantasia = dadosEmpresa.nomeFantasia || list[idx].nomeFantasia;
            list[idx].cnpj = dadosEmpresa.cnpj || list[idx].cnpj;
            list[idx].cidade = dadosEmpresa.cidade || list[idx].cidade;
            list[idx].uf = dadosEmpresa.uf || list[idx].uf;
            localStorage.setItem('nfe_empresas_list', JSON.stringify(list));
          }
        }
      }
    } catch {}

    await sleep(400);

    // ----------------------------------------------------
    // Etapa 2 / 5: Clientes (40%)
    // ----------------------------------------------------
    onProgress?.({
      etapa: 2,
      totalEtapas: 5,
      nomeEtapa: 'Clientes',
      porcentagem: 40,
      mensagem: 'Baixando clientes cadastrados...',
    });
    notificarAtualizacaoStatus(true, 'Baixando clientes cadastrados no Bling...', 40);

    const resClientes = await carregarClientesBling(token, empresa.id);
    const clientes = resClientes.data || [];
    salvarClientesCacheLocal(empresa.id, clientes);

    await sleep(400);

    // ----------------------------------------------------
    // Etapa 3 / 5: Fornecedores (60%)
    // ----------------------------------------------------
    onProgress?.({
      etapa: 3,
      totalEtapas: 5,
      nomeEtapa: 'Fornecedores',
      porcentagem: 60,
      mensagem: 'Baixando fornecedores...',
    });
    notificarAtualizacaoStatus(true, 'Baixando fornecedores no Bling...', 60, undefined, clientes.length);

    const resFornec = await carregarFornecedoresBling(token, empresa.id);
    const fornecedores = resFornec.data || [];
    salvarFornecedoresCacheLocal(empresa.id, fornecedores);

    await sleep(400);

    // ----------------------------------------------------
    // Etapa 4 / 5: Catálogo de Produtos e Preços (80%)
    // ----------------------------------------------------
    onProgress?.({
      etapa: 4,
      totalEtapas: 5,
      nomeEtapa: 'Produtos',
      porcentagem: 80,
      mensagem: 'Baixando catálogo de produtos reais do Bling...',
    });
    notificarAtualizacaoStatus(true, 'Baixando catálogo de produtos reais...', 80, undefined, clientes.length);

    const resProdutos = await carregarProdutosBling(token, empresa.id);
    const produtos = resProdutos.data || [];
    salvarProdutosCacheLocal(empresa.id, produtos);

    await sleep(400);

    // ----------------------------------------------------
    // Etapa 5 / 5: Contas a Receber e a Pagar (100%)
    // ----------------------------------------------------
    onProgress?.({
      etapa: 5,
      totalEtapas: 5,
      nomeEtapa: 'Financeiro',
      porcentagem: 95,
      mensagem: 'Sincronizando contas a receber e pagar...',
    });
    notificarAtualizacaoStatus(true, 'Sincronizando contas financeiras...', 95, produtos.length, clientes.length);

    try {
      const resReceber = await carregarContasReceberBling(token, empresa.id, empresa.bancoPadrao);
      if (resReceber?.data) {
        salvarContasReceberCacheLocal(empresa.id, resReceber.data);
        salvarContasReceberNoBanco(empresa.id, resReceber.data).catch(() => {});
      }
      await sleep(400);
      const resPagar = await carregarContasPagarBling(token, empresa.id);
      if (resPagar?.data) {
        salvarContasPagarCacheLocal(empresa.id, resPagar.data);
        salvarContasPagarNoBanco(empresa.id, resPagar.data).catch(() => {});
      }
      registrarEmpresaNoBanco(empresa).catch(() => {});
    } catch {}

    const concluidoMsg = `${produtos.length} produtos e ${clientes.length} clientes prontos para uso`;
    notificarAtualizacaoStatus(false, concluidoMsg, 100, produtos.length, clientes.length);

    onProgress?.({
      etapa: 5,
      totalEtapas: 5,
      nomeEtapa: 'Concluído',
      porcentagem: 100,
      mensagem: concluidoMsg,
      totalProdutos: produtos.length,
      totalClientes: clientes.length,
      totalFornecedores: fornecedores.length,
      sucesso: true,
    });

    return {
      sucesso: true,
      clientes,
      fornecedores,
      produtos,
      mensagem: concluidoMsg,
    };
  } catch (err: any) {
    const erroMsg = err.message || 'Erro durante a sincronização com o Bling.';
    notificarAtualizacaoStatus(false, `Falha: ${erroMsg}`, 0);
    onProgress?.({
      etapa: 0,
      totalEtapas: 5,
      nomeEtapa: 'Erro',
      porcentagem: 0,
      mensagem: erroMsg,
      sucesso: false,
      erro: erroMsg,
    });
    return {
      sucesso: false,
      clientes: obterClientesCacheLocal(empresa.id),
      fornecedores: obterFornecedoresCacheLocal(empresa.id),
      produtos: obterProdutosCacheLocal(empresa.id),
      mensagem: erroMsg,
    };
  }
}

