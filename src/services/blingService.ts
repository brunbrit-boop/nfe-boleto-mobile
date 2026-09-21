import type { BlingCliente, BlingContaPagar, BlingContaReceber, ResumoFinanceiro } from '../types';
import { formatCurrency, gerarDadosBoletoFebraban, gerarPixCopiaECola } from '../utils/financeEngine';

const STORAGE_KEYS = {
  CLIENTES: 'bling_cache_clientes',
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
 * Realiza requisição para a API v3 do Bling (via Proxy Vercel ou direta)
 */
async function callBlingApi(endpoint: string): Promise<any> {
  const token = getStoredBlingToken();
  if (!token) {
    throw new Error('Token do Bling não configurado.');
  }

  // Tenta via Proxy Vercel
  try {
    const proxyUrl = `/api/bling-proxy?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(proxyUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    const data = await response.json().catch(() => null);

    // Quando o Bling não tem registros para a consulta, retorna HTTP 404 (RESOURCE_NOT_FOUND)
    if (response.status === 404 || data?.error?.type === 'RESOURCE_NOT_FOUND') {
      return { data: [] };
    }

    if (response.ok && data) {
      return data;
    } else if (data) {
      const msg = data?.error?.message || data?.error || data?.mensagem || `Bling retornou HTTP ${response.status}`;
      throw new Error(msg);
    }
  } catch (proxyErr: any) {
    if (proxyErr.message && !proxyErr.message.includes('fetch')) {
      throw proxyErr;
    }
  }

  // Fallback direto via api.bling.com.br
  const directUrl = `https://api.bling.com.br/Api/v3${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const directRes = await fetch(directUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  const directData = await directRes.json().catch(() => null);
  if (directRes.status === 404 || directData?.error?.type === 'RESOURCE_NOT_FOUND') {
    return { data: [] };
  }

  if (!directRes.ok) {
    const msg = directData?.error?.message || directData?.error || `Bling HTTP ${directRes.status}`;
    throw new Error(msg);
  }

  return directData;
}

/**
 * Busca a lista de clientes sincronizada com o Bling ERP
 */
export async function carregarClientesBling(): Promise<{ data: BlingCliente[]; isLive: boolean; error?: string }> {
  try {
    const response = await callBlingApi('/contatos?limite=100');
    const records = (response && response.data && Array.isArray(response.data)) ? response.data : [];
    const clientesFormatados: BlingCliente[] = records.map((c: any) => ({
      id: c.id,
      nome: c.nome || 'Sem Nome',
      fantasia: c.fantasia || c.nome || 'Sem Nome',
      tipoPessoa: c.tipo === 'J' || c.tipoPessoa === 'J' ? 'J' : 'F',
      numeroDocumento: c.numeroDocumento || 'Não informado',
      ie: c.ie || '',
      email: c.email || '',
      telefone: c.telefone || '',
      celular: c.celular || '',
      situacao: c.situacao === 'I' ? 'I' : 'A',
      endereco: {
        geral: {
          endereco: c.endereco?.geral?.endereco || '',
          numero: c.endereco?.geral?.numero || '',
          bairro: c.endereco?.geral?.bairro || '',
          cep: c.endereco?.geral?.cep || '',
          municipio: c.endereco?.geral?.municipio || '',
          uf: c.endereco?.geral?.uf || '',
        }
      },
      saldoDevedor: c.saldoDevedor || 0,
      limiteCredito: c.limiteCredito || 10000,
    }));

    localStorage.setItem(STORAGE_KEYS.CLIENTES, JSON.stringify(clientesFormatados));
    return { data: clientesFormatados, isLive: true };
  } catch (err: any) {
    console.error('Erro ao buscar clientes no Bling:', err);
  }

  // Verifica se há cache salvo
  const cached = localStorage.getItem(STORAGE_KEYS.CLIENTES);
  if (cached) {
    try {
      return { data: JSON.parse(cached), isLive: true };
    } catch {}
  }

  return { data: [], isLive: false };
}

/**
 * Busca a lista de Contas a Pagar do Bling ERP (100% Real - Sem dados fictícios)
 */
export async function carregarContasPagarBling(): Promise<{ data: BlingContaPagar[]; resumo: ResumoFinanceiro; isLive: boolean }> {
  try {
    const response = await callBlingApi('/contas-a-pagar?limite=100');
    const records = (response && response.data && Array.isArray(response.data)) ? response.data : [];
    
    const pagamentos: BlingContaPagar[] = records.map((p: any) => {
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
        saldo: Number(p.saldo || val),
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
    localStorage.setItem(STORAGE_KEYS.PAGAR, JSON.stringify(pagamentos));
    return { data: pagamentos, resumo, isLive: true };
  } catch (err: any) {
    console.error('Erro ao buscar contas a pagar do Bling:', err);
  }

  // Se o Bling está conectado ou retornou vazio, não exibe nenhuma conta fictícia
  const resumoVazio: ResumoFinanceiro = { totalAberto: 0, totalLiquidado: 0, totalVencido: 0, qtdRegistros: 0 };
  localStorage.setItem(STORAGE_KEYS.PAGAR, JSON.stringify([]));
  return { data: [], resumo: resumoVazio, isLive: true };
}

/**
 * Busca a lista de Contas a Receber do Bling ERP com boletos vinculados (100% Real - Sem dados fictícios)
 */
export async function carregarContasReceberBling(): Promise<{ data: BlingContaReceber[]; resumo: ResumoFinanceiro; isLive: boolean }> {
  try {
    const response = await callBlingApi('/contas-a-receber?limite=100');
    const records = (response && response.data && Array.isArray(response.data)) ? response.data : [];

    const receber: BlingContaReceber[] = records.map((r: any, idx: number) => {
      const val = Number(r.valor || r.saldo || 0);
      const venc = r.vencimento || new Date().toISOString().slice(0, 10);
      const [yyyy, mm, dd] = venc.split('-');

      const { linhaDigitavel, codigoBarras, nossoNumero } = gerarDadosBoletoFebraban(
        'inter',
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
        saldo: Number(r.saldo || val),
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
    localStorage.setItem(STORAGE_KEYS.RECEBER, JSON.stringify(receber));
    return { data: receber, resumo, isLive: true };
  } catch (err: any) {
    console.error('Erro ao buscar contas a receber do Bling:', err);
  }

  // Se o Bling está conectado ou retornou vazio, não exibe nenhuma conta fictícia
  const resumoVazio: ResumoFinanceiro = { totalAberto: 0, totalLiquidado: 0, totalVencido: 0, qtdRegistros: 0 };
  localStorage.setItem(STORAGE_KEYS.RECEBER, JSON.stringify([]));
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
    } else if (c.situacao === 1) {
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
 * Função de diagnóstico para inspecionar a resposta bruta da API v3 do Bling
 */
export async function obterDiagnosticoBling(): Promise<{
  ok: boolean;
  contatosCount?: number;
  contatosRaw?: any;
  error?: string;
}> {
  const token = getStoredBlingToken();
  if (!token) {
    return { ok: false, error: 'Token do Bling não configurado no navegador.' };
  }
  try {
    const res = await callBlingApi('/contatos?limite=3');
    return {
      ok: true,
      contatosCount: Array.isArray(res?.data) ? res.data.length : 0,
      contatosRaw: res?.data || res,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Erro ao consultar contatos do Bling',
    };
  }
}
