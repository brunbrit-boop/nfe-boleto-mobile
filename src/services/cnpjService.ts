import type { BlingCliente } from '../types';

export interface DadosCartaoCnpj {
  cnpj: string; // formatado 00.000.000/0000-00
  cnpjLimpo: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string; // ATIVA, BAIXADA, INAPTA, SUSPENSA, NULA
  dataSituacaoCadastral?: string;
  motivoSituacaoCadastral?: string;
  dataAbertura?: string;
  naturezaJuridica?: string;
  porte?: string;
  capitalSocial?: number;
  cnaePrincipal?: {
    codigo: string;
    descricao: string;
  };
  cnaesSecundarios?: Array<{
    codigo: string;
    descricao: string;
  }>;
  endereco: {
    tipoLogradouro?: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cep: string;
    municipio: string;
    uf: string;
  };
  contato: {
    telefone?: string;
    email?: string;
  };
  qsa?: Array<{
    nome: string;
    qual?: string;
    faixaEtaria?: string;
  }>;
  consultadoEm: string;
}

const STORAGE_KEY_ENRIQUECIMENTO = 'nfe_clientes_enriquecimento_cnpj';

/**
 * Formata CNPJ com máscara 00.000.000/0000-00
 */
export function formatarCNPJ(doc: string): string {
  const limpo = doc.replace(/\D/g, '');
  if (limpo.length !== 14) return doc;
  return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Formata data ISO (YYYY-MM-DD) para padrão brasileiro DD/MM/AAAA
 */
export function formatarDataBr(dataIso?: string): string {
  if (!dataIso) return '-';
  const limpo = dataIso.split('T')[0];
  const partes = limpo.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataIso;
}

/**
 * Consulta dados oficiais da empresa na Receita Federal (via BrasilAPI com fallback para MinhaReceita)
 */
export async function consultarCnpjReceita(cnpjInput: string): Promise<DadosCartaoCnpj> {
  const cnpjLimpo = cnpjInput.replace(/\D/g, '');

  if (cnpjLimpo.length !== 14) {
    throw new Error(`CNPJ inválido: deve conter exatamente 14 dígitos (recebido: ${cnpjLimpo.length}).`);
  }

  let rawData: any = null;

  // 1. Tentativa Principal: BrasilAPI
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      rawData = await res.json();
    }
  } catch (err) {
    console.warn(`[CNPJ] Falha na BrasilAPI para ${cnpjLimpo}, tentando fallback MinhaReceita...`, err);
  }

  // 2. Fallback: MinhaReceita.org
  if (!rawData) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(`https://minhareceita.org/${cnpjLimpo}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        rawData = await res.json();
      } else if (res.status === 404) {
        throw new Error('CNPJ não encontrado na base pública da Receita Federal.');
      } else if (res.status === 429) {
        throw new Error('Limite temporário de requisições excedido. Aguarde alguns segundos.');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Não foi possível consultar o CNPJ na base pública.');
    }
  }

  if (!rawData || (!rawData.razao_social && !rawData.nome_fantasia)) {
    throw new Error('Dados do CNPJ não puderam ser recuperados.');
  }

  // Normalização padronizada dos dados
  const cnaesSec: Array<{ codigo: string; descricao: string }> = Array.isArray(rawData.cnaes_secundarios)
    ? rawData.cnaes_secundarios.map((cs: any) => ({
        codigo: String(cs.codigo || ''),
        descricao: String(cs.descricao || ''),
      }))
    : [];

  const qsa: Array<{ nome: string; qual?: string; faixaEtaria?: string }> = Array.isArray(rawData.qsa)
    ? rawData.qsa.map((socio: any) => ({
        nome: socio.nome_socio || socio.nome || 'Sócio / Administrador',
        qual: socio.qualificacao_socio || socio.qual || undefined,
        faixaEtaria: socio.faixa_etaria || undefined,
      }))
    : [];

  const ddd = rawData.ddd_telefone_1 ? String(rawData.ddd_telefone_1).replace(/\D/g, '') : '';
  const ddd2 = rawData.ddd_telefone_2 ? String(rawData.ddd_telefone_2).replace(/\D/g, '') : '';
  const fone = ddd || ddd2 || undefined;

  const resultado: DadosCartaoCnpj = {
    cnpj: formatarCNPJ(cnpjLimpo),
    cnpjLimpo,
    razaoSocial: rawData.razao_social || rawData.nome || '',
    nomeFantasia: rawData.nome_fantasia || rawData.fantasia || rawData.razao_social || '',
    situacaoCadastral: (rawData.descricao_situacao_cadastral || rawData.situacao_cadastral || 'ATIVA').toUpperCase(),
    dataSituacaoCadastral: rawData.data_situacao_cadastral || undefined,
    motivoSituacaoCadastral: rawData.motivo_situacao_cadastral || undefined,
    dataAbertura: rawData.data_inicio_atividade || undefined,
    naturezaJuridica: rawData.natureza_juridica || undefined,
    porte: rawData.porte || rawData.descricao_porte || undefined,
    capitalSocial: typeof rawData.capital_social === 'number' ? rawData.capital_social : undefined,
    cnaePrincipal: rawData.cnae_fiscal
      ? {
          codigo: String(rawData.cnae_fiscal),
          descricao: String(rawData.cnae_fiscal_descricao || 'Atividade principal'),
        }
      : undefined,
    cnaesSecundarios: cnaesSec,
    endereco: {
      tipoLogradouro: rawData.descricao_tipo_de_logradouro || undefined,
      logradouro: [rawData.descricao_tipo_de_logradouro, rawData.logradouro].filter(Boolean).join(' ') || '',
      numero: rawData.numero || 'S/N',
      complemento: rawData.complemento || undefined,
      bairro: rawData.bairro || '',
      cep: rawData.cep ? rawData.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '',
      municipio: rawData.municipio || '',
      uf: (rawData.uf || '').toUpperCase(),
    },
    contato: {
      telefone: fone,
      email: rawData.email || undefined,
    },
    qsa,
    consultadoEm: new Date().toISOString(),
  };

  return resultado;
}

/**
 * Mescla os dados oficiais consultados no objeto BlingCliente preservando vínculos de ERP
 */
export function mesclarDadosCartaoNoCliente(cliente: BlingCliente, dados: DadosCartaoCnpj): BlingCliente {
  return {
    ...cliente,
    nome: dados.razaoSocial || cliente.nome,
    fantasia: dados.nomeFantasia || cliente.fantasia,
    numeroDocumento: dados.cnpj,
    email: dados.contato.email || cliente.email,
    telefone: dados.contato.telefone || cliente.telefone,
    situacaoCadastral: dados.situacaoCadastral,
    dataSituacaoCadastral: dados.dataSituacaoCadastral,
    motivoSituacaoCadastral: dados.motivoSituacaoCadastral,
    dataAbertura: dados.dataAbertura,
    naturezaJuridica: dados.naturezaJuridica,
    porte: dados.porte,
    capitalSocial: dados.capitalSocial,
    cnaePrincipal: dados.cnaePrincipal,
    cnaesSecundarios: dados.cnaesSecundarios,
    qsa: dados.qsa,
    consultadoEm: dados.consultadoEm,
    endereco: {
      geral: {
        endereco: dados.endereco.logradouro || cliente.endereco?.geral?.endereco || '',
        numero: dados.endereco.numero || cliente.endereco?.geral?.numero || '',
        complemento: dados.endereco.complemento || cliente.endereco?.geral?.complemento || '',
        bairro: dados.endereco.bairro || cliente.endereco?.geral?.bairro || '',
        cep: dados.endereco.cep || cliente.endereco?.geral?.cep || '',
        municipio: dados.endereco.municipio || cliente.endereco?.geral?.municipio || '',
        uf: dados.endereco.uf || cliente.endereco?.geral?.uf || 'SP',
      },
    },
  };
}

/**
 * Salva no localStorage os dados enriquecidos por CNPJ
 */
export function salvarCacheClientesEnriquecidos(
  empresaId: string,
  mapa: Record<string, Partial<BlingCliente>>
): void {
  try {
    const key = `${STORAGE_KEY_ENRIQUECIMENTO}_${empresaId}`;
    localStorage.setItem(key, JSON.stringify(mapa));
  } catch (e) {
    console.warn('[CNPJ] Falha ao salvar cache de enriquecimento:', e);
  }
}

/**
 * Carrega do localStorage os dados enriquecidos por CNPJ
 */
export function obterCacheClientesEnriquecidos(
  empresaId: string
): Record<string, Partial<BlingCliente>> {
  try {
    const key = `${STORAGE_KEY_ENRIQUECIMENTO}_${empresaId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }
  } catch {}
  return {};
}
