import type { BlingContaPagar, BlingContaReceber, EmpresaTenant } from '../types';

const DEFAULT_PB_URL = 'https://juice-titled-lying-enterprises.trycloudflare.com';

let isPocketBaseOfflineCache = false;
let lastHealthCheckTime = 0;

export function getPocketBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('nfe_pocketbase_url') || DEFAULT_PB_URL;
  }
  return DEFAULT_PB_URL;
}

export function setPocketBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nfe_pocketbase_url', url.trim().replace(/\/+$/, ''));
    isPocketBaseOfflineCache = false;
    lastHealthCheckTime = 0;
  }
}

/**
 * Verifica rapidamente se o PocketBase está acessível sem travar a aplicação
 */
export async function isPocketBaseOnline(): Promise<boolean> {
  const now = Date.now();
  // Se falhou há menos de 20 segundos, não tenta de novo para não floodar de requisições
  if (isPocketBaseOfflineCache && now - lastHealthCheckTime < 20000) {
    return false;
  }

  const baseUrl = getPocketBaseUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${baseUrl}/api/health`, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    isPocketBaseOfflineCache = !res.ok;
    lastHealthCheckTime = now;
    return res.ok;
  } catch {
    isPocketBaseOfflineCache = true;
    lastHealthCheckTime = now;
    return false;
  }
}

/**
 * Salva as contas a receber de uma empresa no banco de dados do RDP (Upsert)
 */
export async function salvarContasReceberNoBanco(
  empresaId: string,
  contas: BlingContaReceber[],
  reconciliarExclusoes: boolean = true
): Promise<{ sucesso: boolean; totalSalvas: number; totalExcluidas: number }> {
  if (!(await isPocketBaseOnline())) {
    return { sucesso: false, totalSalvas: 0, totalExcluidas: 0 };
  }

  const baseUrl = getPocketBaseUrl();
  let totalSalvas = 0;
  let totalExcluidas = 0;


  for (const cr of contas) {
    const chaveUnica = `${empresaId}_${cr.id}`;
    const payload = {
      empresa_id: empresaId,
      id_bling: String(cr.id),
      chave_unica: chaveUnica,
      numero_documento: cr.numeroDocumento || `CR-${cr.id}`,
      vencimento: cr.vencimento || new Date().toISOString().slice(0, 10),
      data_emissao: cr.dataEmissao || cr.vencimento || '',
      valor: Number(cr.valor) || 0,
      saldo: Number(cr.saldo ?? cr.valor) || 0,
      situacao: Number(cr.situacao) || 1,
      cliente_nome: cr.contato?.nome || 'Cliente',
      cliente_doc: cr.contato?.numeroDocumento || '',
      categoria:
        typeof cr.categoria === 'object' && cr.categoria !== null
          ? (cr.categoria as any).descricao
          : cr.categoria || 'Vendas',
      historico: cr.historico || '',
      forma_pagamento: (cr as any).formaPagamento?.descricao || '',
      nosso_numero: cr.nossoNumero || '',
      linha_digitavel: cr.linhaDigitavel || '',
      codigo_barras: cr.codigoBarras || '',
      pix_copia_e_cola: cr.pixCopiaECola || '',
    };

    try {
      const createRes = await fetch(`${baseUrl}/api/collections/contas_receber/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (createRes.ok) {
        totalSalvas++;
      } else {
        const findRes = await fetch(
          `${baseUrl}/api/collections/contas_receber/records?filter=(chave_unica='${encodeURIComponent(chaveUnica)}')`
        );
        const findData = await findRes.json();
        if (findData.items && findData.items.length > 0) {
          const recordId = findData.items[0].id;
          await fetch(`${baseUrl}/api/collections/contas_receber/records/${recordId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          totalSalvas++;
        }
      }
    } catch (err) {
      isPocketBaseOfflineCache = true;
      lastHealthCheckTime = Date.now();
      console.warn(`PocketBase inacessível durante salvamento de contas a receber. Interrompendo sincronização no banco.`);
      break;
    }
  }

  // Reconciliação: remove do banco do RDP as contas que foram excluídas no Bling
  if (reconciliarExclusoes) {
    try {
      const idsBlingAtivos = new Set(contas.map((c) => String(c.id)));
      const listRes = await fetch(
        `${baseUrl}/api/collections/contas_receber/records?filter=(empresa_id='${encodeURIComponent(empresaId)}')&perPage=500`
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const recordsNoBanco = listData.items || [];
        for (const rec of recordsNoBanco) {
          if (rec.id_bling && !idsBlingAtivos.has(String(rec.id_bling))) {
            const delRes = await fetch(`${baseUrl}/api/collections/contas_receber/records/${rec.id}`, {
              method: 'DELETE',
            });
            if (delRes.ok || delRes.status === 204) {
              totalExcluidas++;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao reconciliar contas a receber excluídas no PocketBase:', err);
    }
  }

  return { sucesso: true, totalSalvas, totalExcluidas };
}

/**
 * Salva as contas a pagar de uma empresa no banco de dados do RDP (Upsert + Remoção de Excluídas)
 */
export async function salvarContasPagarNoBanco(
  empresaId: string,
  contas: BlingContaPagar[],
  reconciliarExclusoes: boolean = true
): Promise<{ sucesso: boolean; totalSalvas: number; totalExcluidas: number }> {
  if (!(await isPocketBaseOnline())) {
    return { sucesso: false, totalSalvas: 0, totalExcluidas: 0 };
  }

  const baseUrl = getPocketBaseUrl();
  let totalSalvas = 0;
  let totalExcluidas = 0;


  for (const cp of contas) {
    const chaveUnica = `${empresaId}_${cp.id}`;
    const payload = {
      empresa_id: empresaId,
      id_bling: String(cp.id),
      chave_unica: chaveUnica,
      numero_documento: cp.numeroDocumento || `CP-${cp.id}`,
      vencimento: cp.vencimento || new Date().toISOString().slice(0, 10),
      data_emissao: cp.dataEmissao || cp.vencimento || '',
      valor: Number(cp.valor) || 0,
      saldo: Number(cp.saldo ?? cp.valor) || 0,
      situacao: Number(cp.situacao) || 1,
      fornecedor_nome: cp.contato?.nome || 'Fornecedor',
      fornecedor_doc: cp.contato?.numeroDocumento || '',
      categoria:
        typeof cp.categoria === 'object' && cp.categoria !== null
          ? (cp.categoria as any).descricao
          : cp.categoria || 'Despesas',
      historico: cp.historico || '',
      forma_pagamento: cp.formaPagamento?.descricao || '',
    };

    try {
      const createRes = await fetch(`${baseUrl}/api/collections/contas_pagar/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (createRes.ok) {
        totalSalvas++;
      } else {
        const findRes = await fetch(
          `${baseUrl}/api/collections/contas_pagar/records?filter=(chave_unica='${encodeURIComponent(chaveUnica)}')`
        );
        const findData = await findRes.json();
        if (findData.items && findData.items.length > 0) {
          const recordId = findData.items[0].id;
          await fetch(`${baseUrl}/api/collections/contas_pagar/records/${recordId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          totalSalvas++;
        }
      }
    } catch (err) {
      isPocketBaseOfflineCache = true;
      lastHealthCheckTime = Date.now();
      console.warn(`PocketBase inacessível durante salvamento de contas a pagar. Interrompendo sincronização no banco.`);
      break;
    }
  }

  // Reconciliação: remove do banco do RDP as contas que foram excluídas no Bling
  if (reconciliarExclusoes) {
    try {
      const idsBlingAtivos = new Set(contas.map((c) => String(c.id)));
      const listRes = await fetch(
        `${baseUrl}/api/collections/contas_pagar/records?filter=(empresa_id='${encodeURIComponent(empresaId)}')&perPage=500`
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const recordsNoBanco = listData.items || [];
        for (const rec of recordsNoBanco) {
          if (rec.id_bling && !idsBlingAtivos.has(String(rec.id_bling))) {
            const delRes = await fetch(`${baseUrl}/api/collections/contas_pagar/records/${rec.id}`, {
              method: 'DELETE',
            });
            if (delRes.ok || delRes.status === 204) {
              totalExcluidas++;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao reconciliar contas a pagar excluídas no PocketBase:', err);
    }
  }

  return { sucesso: true, totalSalvas, totalExcluidas };
}

/**
 * Consulta contas a receber do banco de dados do RDP
 */
export async function obterContasReceberDoBanco(empresaId?: string): Promise<BlingContaReceber[]> {
  if (!(await isPocketBaseOnline())) return [];

  const baseUrl = getPocketBaseUrl();
  const filter = empresaId ? `filter=(empresa_id='${encodeURIComponent(empresaId)}')&` : '';
  const url = `${baseUrl}/api/collections/contas_receber/records?${filter}perPage=500&sort=-vencimento`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.items || [];

    return items.map((item: any) => {
      const [yyyy, mm, dd] = (item.vencimento || '').split('-');
      const vencFormatado = dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : item.vencimento;

      return {
        id: item.id_bling || item.id,
        empresaId: item.empresa_id,
        numeroDocumento: item.numero_documento,
        dataEmissao: item.data_emissao,
        vencimento: item.vencimento,
        vencimentoFormatado: vencFormatado,
        valor: item.valor,
        valorFormatado: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor),
        saldo: item.saldo,
        historico: item.historico,
        categoria: item.categoria,
        situacao: item.situacao,
        contato: {
          id: 1,
          nome: item.cliente_nome,
          numeroDocumento: item.cliente_doc,
        },
        formaPagamento: item.forma_pagamento ? { descricao: item.forma_pagamento } : undefined,
        nossoNumero: item.nosso_numero,
        linhaDigitavel: item.linha_digitavel,
        codigoBarras: item.codigo_barras,
        pixCopiaECola: item.pix_copia_e_cola,
      };
    });
  } catch (err) {
    console.warn('PocketBase offline ou inacessível ao obter contas a receber:', err);
    return [];
  }
}

/**
 * Consulta contas a pagar do banco de dados do RDP
 */
export async function obterContasPagarDoBanco(empresaId?: string): Promise<BlingContaPagar[]> {
  if (!(await isPocketBaseOnline())) return [];

  const baseUrl = getPocketBaseUrl();
  const filter = empresaId ? `filter=(empresa_id='${encodeURIComponent(empresaId)}')&` : '';
  const url = `${baseUrl}/api/collections/contas_pagar/records?${filter}perPage=500&sort=-vencimento`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.items || [];

    return items.map((item: any) => {
      const [yyyy, mm, dd] = (item.vencimento || '').split('-');
      const vencFormatado = dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : item.vencimento;

      return {
        id: item.id_bling || item.id,
        empresaId: item.empresa_id,
        numeroDocumento: item.numero_documento,
        dataEmissao: item.data_emissao,
        vencimento: item.vencimento,
        vencimentoFormatado: vencFormatado,
        valor: item.valor,
        valorFormatado: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor),
        saldo: item.saldo,
        historico: item.historico,
        categoria: item.categoria,
        situacao: item.situacao,
        contato: {
          id: 1,
          nome: item.fornecedor_nome,
          numeroDocumento: item.fornecedor_doc,
        },
        formaPagamento: item.forma_pagamento ? { descricao: item.forma_pagamento } : undefined,
      };
    });
  } catch (err) {
    console.warn('PocketBase offline ou inacessível ao obter contas a pagar:', err);
    return [];
  }
}

/**
 * Testa conectividade com o PocketBase no RDP
 */
export async function testarConexaoPocketBase(): Promise<{ ok: boolean; url: string; mensagem: string }> {
  const baseUrl = getPocketBaseUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${baseUrl}/api/health`, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      isPocketBaseOfflineCache = false;
      return { ok: true, url: baseUrl, mensagem: 'Conectado ao PocketBase RDP' };
    }
    isPocketBaseOfflineCache = true;
    return { ok: false, url: baseUrl, mensagem: `Status ${res.status}` };
  } catch (err: any) {
    isPocketBaseOfflineCache = true;
    return { ok: false, url: baseUrl, mensagem: err?.message || 'Servidor offline' };
  }
}

/**
 * Registra ou atualiza os metadados da empresa no banco
 */
export async function registrarEmpresaNoBanco(empresa: EmpresaTenant): Promise<void> {
  if (!(await isPocketBaseOnline())) return;

  const baseUrl = getPocketBaseUrl();
  const payload = {
    empresa_id: empresa.id,
    nome_fantasia: empresa.nomeFantasia || '',
    razao_social: empresa.razaoSocial || '',
    cnpj: empresa.cnpj || '',
    banco_padrao: empresa.bancoPadrao || 'inter',
    ultima_sincronizacao: new Date().toISOString(),
  };

  try {
    const findRes = await fetch(
      `${baseUrl}/api/collections/empresas_bling/records?filter=(empresa_id='${encodeURIComponent(empresa.id)}')`
    );
    const findData = await findRes.json();
    if (findData.items && findData.items.length > 0) {
      await fetch(`${baseUrl}/api/collections/empresas_bling/records/${findData.items[0].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${baseUrl}/api/collections/empresas_bling/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
  } catch {}
}
