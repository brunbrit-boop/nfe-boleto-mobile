import type { BlingCliente, BlingContaPagar, BlingContaReceber, ResumoFinanceiro, BankProvider } from '../types';
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
 * Suporta passar token específico de uma empresa ou usa o armazenado
 */
export async function callBlingApi(endpoint: string, customToken?: string): Promise<any> {
  const token = customToken || getStoredBlingToken();
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
  try {
    // 1. Tenta rota oficial de dados cadastrais /empresas
    let dataEmpresa: any = null;
    try {
      const res = await callBlingApi('/empresas', token);
      if (res && res.data) {
        dataEmpresa = Array.isArray(res.data) ? res.data[0] : res.data;
      }
    } catch (e: any) {
      console.warn('Endpoint /empresas não retornou dados diretos:', e);
    }

    // 2. Se não encontrou em /empresas, tenta rota alternativa /homologacao/empresa
    if (!dataEmpresa) {
      try {
        const resHome = await callBlingApi('/homologacao/empresa', token);
        if (resHome && resHome.data) {
          dataEmpresa = resHome.data;
        }
      } catch {}
    }

    if (dataEmpresa && (dataEmpresa.razaoSocial || dataEmpresa.nome || dataEmpresa.cnpj)) {
      const razao = dataEmpresa.razaoSocial || dataEmpresa.nome || 'Empresa Bling ERP';
      const fantasia = dataEmpresa.nomeFantasia || dataEmpresa.fantasia || razao;
      const cnpj = dataEmpresa.cnpj || dataEmpresa.numeroDocumento || '';
      const ie = dataEmpresa.inscricaoEstadual || dataEmpresa.ie || '';
      const end = dataEmpresa.endereco || {};

      return {
        success: true,
        razaoSocial: razao,
        nomeFantasia: fantasia,
        cnpj: cnpj,
        inscricaoEstadual: ie,
        cidade: end.municipio || end.cidade || '',
        uf: end.uf || '',
        cep: end.cep || '',
        logradouro: end.endereco || end.logradouro || '',
        numero: end.numero || '',
        bairro: end.bairro || '',
        mensagem: 'Dados da empresa obtidos com sucesso do Bling!',
      };
    }

    // 3. Se a rota de empresas estiver restrita mas o token for válido (testando com /contatos?limite=1)
    const resTeste = await callBlingApi('/contatos?criterio=1&limite=1', token);
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
    mensagem: 'Não foi possível extrair dados cadastrais com o token informado.',
  };
}

/**
 * Busca a lista de clientes sincronizada com o Bling ERP
 * Suporta passar token e empresaId específicos
 */
export async function carregarClientesBling(
  token?: string,
  empresaId?: string
): Promise<{ data: BlingCliente[]; isLive: boolean; error?: string }> {
  try {
    const todosContatos: any[] = [];
    let pagina = 1;
    const limite = 100;
    const maxPaginas = 25; // Até 2.500 contatos com segurança

    while (pagina <= maxPaginas) {
      const endpoint = `/contatos?criterio=1&limite=${limite}&pagina=${pagina}`;
      const response = await callBlingApi(endpoint, token);
      const records = (response && response.data && Array.isArray(response.data)) ? response.data : [];

      if (records.length === 0) break;
      todosContatos.push(...records);

      if (records.length < limite) break;
      pagina++;
    }

    const clientesFormatados: BlingCliente[] = todosContatos.map((c: any) => ({
      id: c.id,
      nome: c.nome || 'Sem Nome',
      fantasia: c.fantasia || c.nome || 'Sem Nome',
      tipoPessoa: c.tipo === 'J' || c.tipoPessoa === 'J' || c.tipoPessoa === 2 ? 'J' : 'F',
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
