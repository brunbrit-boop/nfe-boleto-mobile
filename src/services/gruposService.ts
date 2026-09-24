/**
 * gruposService.ts
 * Gerenciamento e Execução em Lote de Grupos de Clientes com IA
 */

import type { GrupoClientes, GrupoClienteItem, GrupoProdutos, BlingCliente, CompanyProfile, EmpresaTenant, NFeData, BankProvider } from '../types';
import type { CatalogoProduto, OfertaGeradaResult } from '../utils/salesOptimizer';
import { gerarOfertaComGeminiOuLocal, isCerebroIAConectado } from './geminiService';
import { CATALOGO_PRODUTOS_PADRAO } from '../utils/salesOptimizer';
import { sleep, gravarEsbocoNFeNoBling } from './blingService';
import { formatCurrency, gerarChaveAcessoNFe, calcularDivisaoParcelas } from '../utils/financeEngine';

const STORAGE_PREFIX = 'nfe_grupos_clientes';
const STORAGE_PREFIX_PRODUTOS = 'nfe_grupos_produtos';

/**
 * Carrega a lista de grupos de produtos da empresa a partir do cache local
 */
export function obterGruposProdutosCacheLocal(empresaId: string): GrupoProdutos[] {
  if (!empresaId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX_PRODUTOS}_${empresaId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Cria grupos de produtos sugeridos iniciais baseados no catálogo padrão
  const sugeridos: GrupoProdutos[] = [
    {
      id: `gp_hidraulica_${empresaId}`,
      empresaId,
      nome: 'Kit Hidráulica & Tubulações',
      descricao: 'Tubos, conexões, joelhos e registros de alta demanda',
      produtosCodigos: ['TUB-001', 'TUB-002', 'REG-001'],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    },
    {
      id: `gp_eletrica_${empresaId}`,
      empresaId,
      nome: 'Kit Elétrica Predial',
      descricao: 'Fios 2.5mm e 4.0mm, disjuntores e fita isolante',
      produtosCodigos: ['FIO-001', 'FIO-002', 'DIS-001'],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    },
    {
      id: `gp_obra_${empresaId}`,
      empresaId,
      nome: 'Cimento & Argamassa Base',
      descricao: 'Cimento CP II 50kg, argamassas e insumos de construção',
      produtosCodigos: ['CIM-001', 'ARG-001', 'ARE-001'],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    },
  ];
  salvarGruposProdutosCacheLocal(empresaId, sugeridos);
  return sugeridos;
}

/**
 * Salva a lista de grupos de produtos no cache local da empresa
 */
export function salvarGruposProdutosCacheLocal(empresaId: string, grupos: GrupoProdutos[]): void {
  if (!empresaId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX_PRODUTOS}_${empresaId}`, JSON.stringify(grupos));
    window.dispatchEvent(new CustomEvent('grupos_produtos_updated', { detail: { empresaId } }));
  } catch {}
}

/**
 * Cria um novo grupo de produtos (kit/combo)
 */
export function criarNovoGrupoProdutos(
  empresaId: string,
  nome: string,
  produtosCodigos: string[] = [],
  descricao: string = ''
): GrupoProdutos {
  const agora = new Date().toISOString();
  return {
    id: `gp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    empresaId,
    nome: nome.trim(),
    descricao: descricao.trim(),
    produtosCodigos,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}
/**
/**
 * Distribui uma Meta Total de Vendas entre N clientes de forma escalonada com limite de dispersão:
 * Garante que o maior valor NUNCA seja maior que o menor x fatorMaximo (padrão 1.5).
 * Matematicamente: vMax <= vMin * fatorMaximo.
 * Mantém arredondamento comercial (passos de R$ 50 ou R$ 10) e soma total 100% exata ao centavo.
 */
export function distribuirMetaEscalonada(
  valorTotal: number,
  numClientes: number,
  fatorMaximo: number = 1.5
): number[] {
  if (numClientes <= 0 || valorTotal <= 0) return [];
  if (numClientes === 1) return [Math.round(valorTotal)];

  const step = valorTotal >= 5000 ? 50 : 10;
  const fator = Math.max(1.05, Math.min(fatorMaximo || 1.5, 3.0));

  // Pesos lineares entre fator e 1.0
  const wMax = fator;
  const wMin = 1.0;
  const pesos: number[] = [];
  for (let i = 0; i < numClientes; i++) {
    const ratio = i / (numClientes - 1);
    pesos.push(wMax - ratio * (wMax - wMin));
  }
  const somaPesos = pesos.reduce((a, b) => a + b, 0);

  // Calcula valores arredondados para o passo comercial
  let valores = pesos.map((p) => Math.max(step, Math.round((valorTotal * (p / somaPesos)) / step) * step));
  let somaAtual = valores.reduce((a, b) => a + b, 0);
  let diff = Math.round((valorTotal - somaAtual) / step);

  // Distribui eventuais diferenças de arredondamento de forma equilibrada
  let idx = 1;
  const maxIter = 1000;
  let iter = 0;
  while (diff !== 0 && iter < maxIter) {
    iter++;
    const targetIdx = idx % numClientes;
    if (diff > 0) {
      valores[targetIdx] += step;
      diff--;
    } else if (valores[targetIdx] > step) {
      valores[targetIdx] -= step;
      diff++;
    }
    idx++;
  }

  // Ordena decrescente: valores[0] é o maior, valores[ultimo] é o menor
  valores.sort((a, b) => b - a);

  // Trava rigorosa: garante que valores[0] <= valores[last] * fator
  let ajusteIter = 0;
  while (valores[0] > valores[valores.length - 1] * fator && ajusteIter < 200) {
    ajusteIter++;
    valores[0] -= step;
    valores[valores.length - 1] += step;
    valores.sort((a, b) => b - a);
  }

  // Ajuste residual final de fechamento da soma
  const somaFinal = valores.reduce((a, b) => a + b, 0);
  const diffFinal = Number((valorTotal - somaFinal).toFixed(2));
  if (diffFinal !== 0 && valores.length > 1) {
    const midIdx = Math.floor(valores.length / 2);
    valores[midIdx] = Number((valores[midIdx] + diffFinal).toFixed(2));
  }

  return valores;
}

/**
 * Carrega a lista de grupos de clientes fixos da empresa a partir do cache local
 */
export function obterGruposCacheLocal(empresaId: string): GrupoClientes[] {
  if (!empresaId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}_${empresaId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Salva a lista de grupos de clientes fixos no cache local da empresa
 */
export function salvarGruposCacheLocal(empresaId: string, grupos: GrupoClientes[]): void {
  if (!empresaId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}_${empresaId}`, JSON.stringify(grupos));
    window.dispatchEvent(new CustomEvent('grupos_clientes_updated', { detail: { empresaId } }));
  } catch {}
}

/**
 * Cria um novo grupo fixo de clientes
 */
export function criarNovoGrupo(
  empresaId: string,
  nome: string,
  clientesIniciais: BlingCliente[] = [],
  valorPadrao: number = 5000,
  filtroPadrao: string = ''
): GrupoClientes {
  const agora = new Date().toISOString();
  const grupoId = `grupo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const dataHoje = new Date();
  dataHoje.setDate(dataHoje.getDate() + 30);
  const primeiroVencPadrao = dataHoje.toISOString().split('T')[0];

  const itensClientes: GrupoClienteItem[] = clientesIniciais.map((c) => ({
    clienteId: c.id,
    nome: c.nome,
    fantasia: c.fantasia,
    numeroDocumento: c.numeroDocumento,
    cidade: c.endereco?.geral?.municipio,
    uf: c.endereco?.geral?.uf,
    telefone: c.telefone || c.celular,
    email: c.email,
    valorAlvo: valorPadrao,
    filtroFoco: filtroPadrao || undefined,
    parcelasCount: 1,
    primeiroVencimento: primeiroVencPadrao,
    intervaloDias: 30,
    status: 'pendente',
  }));

  return {
    id: grupoId,
    empresaId,
    nome: nome.trim() || 'Novo Grupo de Clientes',
    valorPadrao,
    filtroPadrao,
    parcelasPadrao: 1,
    primeiroVencimentoPadrao: primeiroVencPadrao,
    intervaloDiasPadrao: 30,
    clientes: itensClientes,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

/**
 * Executa a geração com IA para um único cliente do grupo (com suporte a Grupos de Produtos/Kits)
 */
export async function gerarOfertaParaItem(
  item: GrupoClienteItem,
  catalogoDisponivel: CatalogoProduto[],
  margemMax: number = 0.05,
  gruposProdutos: GrupoProdutos[] = []
): Promise<OfertaGeradaResult> {
  let catalogoEfetivo = catalogoDisponivel;
  let diretriz: string | undefined = undefined;

  // 1. Prioridade Máxima: Se o item estiver vinculado a um Grupo de Produtos (Kit/Combo)
  if (item.grupoProdutoId && gruposProdutos.length > 0) {
    const gp = gruposProdutos.find((g) => g.id === item.grupoProdutoId);
    if (gp && gp.produtosCodigos && gp.produtosCodigos.length > 0) {
      const codigosSet = new Set(gp.produtosCodigos.map((c) => c.toLowerCase().trim()));
      const filtradosPorGrupo = catalogoDisponivel.filter((p) =>
        codigosSet.has((p.codigo || '').toLowerCase().trim()) ||
        codigosSet.has((p.id || '').toLowerCase().trim())
      );
      if (filtradosPorGrupo.length > 0) {
        catalogoEfetivo = filtradosPorGrupo;
        diretriz = `Compor pedido utilizando exclusivamente os produtos do Grupo/Kit: "${gp.nome}".`;
      }
    }
  }

  // 2. Se não encontrou grupo ou não tem grupo vinculado, aplica o filtro de texto/foco
  if (!diretriz) {
    const foco = (item.filtroFoco || '').trim().toLowerCase();
    if (foco) {
      const filtrados = catalogoDisponivel.filter((p) =>
        p.descricao.toLowerCase().includes(foco) ||
        p.categoria.toLowerCase().includes(foco) ||
        (p.codigo && p.codigo.toLowerCase().includes(foco))
      );
      if (filtrados.length >= 2) {
        catalogoEfetivo = filtrados;
      }
      diretriz = `Foco em produtos da linha: "${item.filtroFoco}".`;
    }
  }

  // Se o catálogo estiver vazio, utiliza o padrão
  if (catalogoEfetivo.length === 0) {
    catalogoEfetivo = CATALOGO_PRODUTOS_PADRAO;
  }

  if (!isCerebroIAConectado()) {
    throw new Error('Cérebro IA desconectado! Configure a Chave de API Google Gemini antes de gerar a proposta comercial.');
  }

  return await gerarOfertaComGeminiOuLocal(item.valorAlvo, margemMax, catalogoEfetivo, diretriz);
}

/**
 * Executa a geração em lote para todos os clientes selecionados de um grupo
 */
export async function executarGeracaoEmLote(
  grupo: GrupoClientes,
  catalogo: CatalogoProduto[],
  onProgress?: (clienteId: number, status: 'gerando' | 'gerado' | 'erro', oferta?: OfertaGeradaResult, erro?: string) => void,
  shouldCancel?: () => boolean
): Promise<GrupoClientes> {
  if (!isCerebroIAConectado()) {
    throw new Error('Cérebro IA desconectado! Conecte a Chave de API Google Gemini nas configurações antes de iniciar a geração em lote.');
  }

  const grupoAtualizado: GrupoClientes = {
    ...grupo,
    atualizadoEm: new Date().toISOString(),
    clientes: [...grupo.clientes],
  };

  for (let i = 0; i < grupoAtualizado.clientes.length; i++) {
    if (shouldCancel && shouldCancel()) break;

    const item = grupoAtualizado.clientes[i];
    onProgress?.(item.clienteId, 'gerando');
    item.status = 'gerando';

    try {
      // Gera a oferta personalizada com IA
      const oferta = await gerarOfertaParaItem(item, catalogo);

      item.status = 'gerado';
      item.ofertaGerada = oferta;
      item.erro = undefined;

      onProgress?.(item.clienteId, 'gerado', oferta);
    } catch (err: any) {
      item.status = 'erro';
      item.erro = err.message || 'Falha ao gerar orçamento.';
      onProgress?.(item.clienteId, 'erro', undefined, item.erro);
    }

    // Pequeno intervalo para renderização fluida na tabela
    await sleep(200);
  }

  return grupoAtualizado;
}

/**
 * Cria o rascunho oficial de NF-e e Boleto no Bling a partir da oferta gerada do item do grupo
 */
export async function emitirNFeItemGrupo(
  item: GrupoClienteItem,
  empresa: EmpresaTenant,
  company: CompanyProfile,
  bancoAtual: BankProvider,
  nomeGrupo?: string
): Promise<{ sucesso: boolean; nfe?: NFeData; erro?: string }> {
  if (!item.ofertaGerada || !item.ofertaGerada.itens || item.ofertaGerada.itens.length === 0) {
    return { sucesso: false, erro: 'Este cliente ainda não possui orçamento gerado pela IA.' };
  }

  const token = empresa.blingAccessToken?.trim();
  const valorTotal = item.ofertaGerada.valorTotal;

  // Condição de pagamento personalizada do cliente (ou padrão)
  const numParcelas = Math.max(1, Math.min(item.parcelasCount || 1, 48));
  const intervaloDias = Math.max(1, item.intervaloDias || 30);
  const primeiroVenc = item.primeiroVencimento; // YYYY-MM-DD

  let baseDate: Date | undefined;
  if (primeiroVenc && /^\d{4}-\d{2}-\d{2}$/.test(primeiroVenc)) {
    const [ano, mes, dia] = primeiroVenc.split('-').map(Number);
    baseDate = new Date(ano, mes - 1, dia);
  }

  const parcelasCalculadas = calcularDivisaoParcelas(
    valorTotal,
    numParcelas,
    bancoAtual,
    intervaloDias,
    baseDate
  );

  const condicoesTexto = `Condições de Pagamento: ${parcelasCalculadas.map((p, idx) => `Parcela ${idx + 1}/${numParcelas}: ${p.dataVencimento.split('-').reverse().join('/')} (${formatCurrency(p.valor)})`).join(' | ')}`;
  const textoInformacoesComplementares = nomeGrupo?.trim()
    ? `${nomeGrupo.trim()}\n${condicoesTexto}`
    : condicoesTexto;

  const novaNFe: NFeData = {
    numeroNFe: String(Math.floor(1000 + Math.random() * 9000)),
    serie: '1',
    dataEmissao: new Date().toISOString().split('T')[0],
    naturezaOperacao: 'Venda de Mercadorias (Grupo IA)',
    chaveAcesso: gerarChaveAcessoNFe(company.cnpj, '1001', '1', '35'),
    status: 'rascunho',
    emitente: company,
    destinatario: {
      razaoSocial: item.nome,
      cnpj: item.numeroDocumento,
      inscricaoEstadual: 'ISENTO',
      cidade: item.cidade || 'São Paulo',
      uf: item.uf || 'SP',
      email: item.email,
      telefone: item.telefone,
    },
    itens: item.ofertaGerada.itens,
    valorProdutos: valorTotal,
    valorTotal,
    valorTotalFormatado: formatCurrency(valorTotal),
    quantidadeParcelas: numParcelas,
    parcelas: parcelasCalculadas,
    banco: bancoAtual,
    informacoesComplementares: textoInformacoesComplementares,
  };

  // Verifica se a empresa possui token Bling conectado para emissão do rascunho
  if (!token) {
    return {
      sucesso: false,
      erro: `A empresa "${empresa.nomeFantasia || empresa.razaoSocial}" não possui Token de Acesso do Bling conectado. Conecte o Bling nas configurações da empresa antes de emitir notas.`,
    };
  }

  try {
    const resBling = await gravarEsbocoNFeNoBling({
      empresaToken: token,
      cliente: {
        id: item.clienteId,
        nome: item.nome,
        fantasia: item.fantasia,
        tipoPessoa: item.numeroDocumento.length > 14 ? 'J' : 'F',
        numeroDocumento: item.numeroDocumento,
        situacao: 'A',
        telefone: item.telefone,
        email: item.email,
      } as any,
      itens: item.ofertaGerada.itens,
      parcelasCount: numParcelas,
      banco: bancoAtual,
      intervaloDias: intervaloDias,
      primeiroVencimento: primeiroVenc,
      observacoesAdicionais: nomeGrupo?.trim(),
    });

    if (!resBling.sucesso) {
      return {
        sucesso: false,
        erro: resBling.mensagem || 'Falha ao gravar rascunho de nota fiscal no Bling.',
      };
    }

    if (resBling.idNotaBling) {
      novaNFe.numeroNFe = String(resBling.idNotaBling);
    }
    novaNFe.status = 'rascunho';
  } catch (err: any) {
    return {
      sucesso: false,
      erro: err.message || 'Erro inesperado na comunicação com o Bling.',
    };
  }

  return { sucesso: true, nfe: novaNFe };
}
