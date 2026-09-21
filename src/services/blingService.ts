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

/**
 * Realiza requisição para a API v3 do Bling (via Proxy Vercel ou direta)
 * Suporta passar token específico de uma empresa ou usa o armazenado
 */
export async function callBlingApi(endpoint: string, customToken?: string): Promise<any> {
  const rawToken = customToken || getStoredBlingToken();
  const token = (rawToken || '').trim().replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('Token do Bling não configurado.');
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;

  // 1. Tenta via Proxy Local ou Vercel (/api/bling-proxy)
  try {
    const proxyUrl = `/api/bling-proxy?endpoint=${encodeURIComponent(cleanEndpoint)}`;
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

    if (response.ok && data && typeof data === 'object') {
      return data;
    } else if (data && data?.error) {
      const msg = data?.error?.message || data?.error || data?.mensagem || `Bling retornou HTTP ${response.status}`;
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
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const vData = await vRes.json().catch(() => null);
      if (vRes.status === 404 || vData?.error?.type === 'RESOURCE_NOT_FOUND') {
        return { data: [] };
      }
      if (vRes.ok && vData && typeof vData === 'object') {
        return vData;
      }
    } catch {}
  }

  // 3. Fallback direto via api.bling.com.br
  const directUrl = `https://api.bling.com.br/Api/v3${cleanEndpoint}`;
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

    while (pagina <= maxPaginas) {
      const endpoint = `/contatos?criterio=1&limite=${limite}&pagina=${pagina}`;
      const response = await callBlingApi(endpoint, token);
      const records = (response && response.data && Array.isArray(response.data)) ? response.data : [];

      if (records.length === 0) break;
      todosContatos.push(...records);

      if (records.length < limite) break;
      pagina++;
    }

    const mapaClientes = new Map<string, BlingCliente>();

    todosContatos.forEach((c: any) => {
      const key = String(c.id || c.numeroDocumento || c.nome);
      mapaClientes.set(key, {
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
          },
        },
        saldoDevedor: c.saldoDevedor || 0,
        limiteCredito: c.limiteCredito || 10000,
      });
    });

    // Consolida clientes que possuem títulos a receber no Bling
    if (contasReceberCache && contasReceberCache.length > 0) {
      contasReceberCache.forEach((cr) => {
        if (cr.contato && cr.contato.nome) {
          const key = String(cr.contato.id || cr.contato.numeroDocumento || cr.contato.nome);
          if (!mapaClientes.has(key)) {
            mapaClientes.set(key, {
              id: cr.contato.id || Math.floor(Math.random() * 100000),
              nome: cr.contato.nome,
              fantasia: cr.contato.nome,
              tipoPessoa: (cr.contato.numeroDocumento && cr.contato.numeroDocumento.length > 14) ? 'J' : 'F',
              numeroDocumento: cr.contato.numeroDocumento || 'Não informado',
              situacao: 'A',
              saldoDevedor: cr.valor,
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

  return { data: [], isLive: false };
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
