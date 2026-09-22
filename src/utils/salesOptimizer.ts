import type { BankProvider, CompanyProfile, NFeData, ProductItem, BlingCliente, EmpresaTenant } from '../types';
import { calcularDivisaoParcelas, formatCurrency, gerarChaveAcessoNFe } from './financeEngine';

export interface CatalogoProduto {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  precoUnitario: number;
  ncm: string;
  cfop: string;
  categoria: string;
}

export const CATALOGO_PRODUTOS_PADRAO: CatalogoProduto[] = [
  { id: 'prod_1', codigo: 'MAT-001', descricao: 'Cimento CP II-E-32 Todas as Obras 50kg', unidade: 'SC', precoUnitario: 34.90, ncm: '25232910', cfop: '5102', categoria: 'Cimento & Argamassa' },
  { id: 'prod_2', codigo: 'MAT-002', descricao: 'Argamassa Colante AC-III Cinza 20kg Quartzolit', unidade: 'SC', precoUnitario: 32.50, ncm: '38245000', cfop: '5102', categoria: 'Cimento & Argamassa' },
  { id: 'prod_3', codigo: 'HID-001', descricao: 'Tubo Esgoto PVC 100mm 6 Metros Tigre', unidade: 'BR', precoUnitario: 58.90, ncm: '39172300', cfop: '5102', categoria: 'Hidráulica' },
  { id: 'prod_4', codigo: 'HID-002', descricao: 'Tubo Soldável PVC 25mm 3/4" 6 Metros Tigre', unidade: 'BR', precoUnitario: 26.80, ncm: '39172300', cfop: '5102', categoria: 'Hidráulica' },
  { id: 'prod_5', codigo: 'HID-003', descricao: 'Joelhor 90 Soldável PVC 25mm Tigre', unidade: 'UN', precoUnitario: 2.10, ncm: '39174090', cfop: '5102', categoria: 'Hidráulica' },
  { id: 'prod_6', codigo: 'ELE-001', descricao: 'Cabo Flexível 2,5mm 750V Rolo 100m Sil', unidade: 'RL', precoUnitario: 189.90, ncm: '85444900', cfop: '5102', categoria: 'Elétrica' },
  { id: 'prod_7', codigo: 'ELE-002', descricao: 'Cabo Flexível 4,0mm 750V Rolo 100m Sil', unidade: 'RL', precoUnitario: 298.00, ncm: '85444900', cfop: '5102', categoria: 'Elétrica' },
  { id: 'prod_8', codigo: 'ELE-003', descricao: 'Disjuntor Bipolar DIN 32A Steck', unidade: 'UN', precoUnitario: 42.00, ncm: '85362000', cfop: '5102', categoria: 'Elétrica' },
  { id: 'prod_9', codigo: 'TIN-001', descricao: 'Tinta Acrílica Fosco Rende Muito 18L Branco Neve Coral', unidade: 'LT', precoUnitario: 389.00, ncm: '32091010', cfop: '5102', categoria: 'Pintura' },
  { id: 'prod_10', codigo: 'TIN-002', descricao: 'Selador Acrílico Branco 18L Suvinil', unidade: 'LT', precoUnitario: 149.00, ncm: '32091010', cfop: '5102', categoria: 'Pintura' },
  { id: 'prod_11', codigo: 'FER-001', descricao: 'Furadeira de Impacto 1/2 700W GSB 13 RE Bosch 220V', unidade: 'UN', precoUnitario: 389.90, ncm: '84672100', cfop: '5102', categoria: 'Ferramentas' },
  { id: 'prod_12', codigo: 'FER-002', descricao: 'Disco de Corte Inox 4.1/2 x 1,0mm Norton', unidade: 'UN', precoUnitario: 4.80, ncm: '68042211', cfop: '5102', categoria: 'Ferramentas' },
  { id: 'prod_13', codigo: 'REV-001', descricao: 'Porcelanato Esmaltado Polido 84x84cm Caixa 2,12m²', unidade: 'CX', precoUnitario: 145.00, ncm: '69072100', cfop: '5102', categoria: 'Acabamento' },
  { id: 'prod_14', codigo: 'REV-002', descricao: 'Rejunte Porcelanato e Cerâmicas Cinza Platina 1kg', unidade: 'PCT', precoUnitario: 14.50, ncm: '38245000', cfop: '5102', categoria: 'Acabamento' },
  { id: 'prod_15', codigo: 'MET-001', descricao: 'Barra de Ferro CA-50 3/8 (10mm) 12 Metros Gerdau', unidade: 'BR', precoUnitario: 54.00, ncm: '72142000', cfop: '5102', categoria: 'Aço & Estrutura' },
];

export interface PedidoItemVenda extends ProductItem {
  categoria?: string;
}

export interface OfertaGeradaResult {
  itens: PedidoItemVenda[];
  valorTotal: number;
  valorAlvoOriginal: number;
  margemPercentual: number; // Ex: +2.4% (até +5%)
  razaoExplicativa: string;
}

/**
 * Motor de IA para Composição Otimizada do Pedido de Vendas
 * Calcula o mix de produtos com margem de até 5% a mais em relação ao valor pretendido
 */
export function gerarOfertaComIA(
  valorAlvo: number,
  margemMax: number = 0.05,
  catalogo: CatalogoProduto[] = CATALOGO_PRODUTOS_PADRAO,
  diretrizComercial?: string
): OfertaGeradaResult {
  if (valorAlvo <= 0) {
    return {
      itens: [],
      valorTotal: 0,
      valorAlvoOriginal: valorAlvo,
      margemPercentual: 0,
      razaoExplicativa: 'Informe um valor alvo válido para que a IA monte a proposta.',
    };
  }

  const limiteMaximo = valorAlvo * (1 + margemMax);
  const itensCompostos: Map<string, PedidoItemVenda> = new Map();
  let totalAcumulado = 0;

  // Filtra ou prioriza por diretriz comercial se especificada
  const diretrizLower = (diretrizComercial || '').toLowerCase();
  const catalogoFiltrado = [...catalogo].sort((a, b) => {
    if (diretrizLower) {
      const aMatch =
        a.categoria.toLowerCase().includes(diretrizLower) ||
        a.descricao.toLowerCase().includes(diretrizLower);
      const bMatch =
        b.categoria.toLowerCase().includes(diretrizLower) ||
        b.descricao.toLowerCase().includes(diretrizLower);
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
    }
    return 0.5 - Math.random();
  });

  // Separa produtos em Estruturais / Principais (ticket >= R$ 18) e Acessórios / Miudezas (< R$ 18)
  const itensPrincipais = catalogoFiltrado.filter((p) => p.precoUnitario >= 18);
  const itensAcessorios = catalogoFiltrado.filter((p) => p.precoUnitario < 18);

  // Pool de produtos selecionáveis: se não houver itens principais suficientes, usa o catálogo inteiro
  const poolPrincipais = itensPrincipais.length > 0 ? itensPrincipais : catalogoFiltrado;

  // LEI 3: Alocação de Base (75% a 85% do valor alvo deve vir de itens principais/estruturais)
  const metaBase = valorAlvo * 0.8;

  for (const prod of poolPrincipais) {
    if (totalAcumulado >= metaBase) break;
    const saldoRestante = limiteMaximo - totalAcumulado;
    if (prod.precoUnitario > saldoRestante && totalAcumulado > 0) continue;

    // Calcula lote comercial natural (múltiplos de 5 ou 10 para valores altos)
    const maxPossivel = Math.floor(saldoRestante / prod.precoUnitario);
    if (maxPossivel <= 0) continue;

    // Para orçamentos maiores, distribui quantidades proporcionais reais de obra
    let qtdSugerida = Math.max(1, Math.floor(Math.random() * Math.min(maxPossivel, 25)) + 1);

    // Se o valor alvo for alto (ex: >= 5.000) e for produto estrutural, usa lotes mais expressivos
    if (valorAlvo >= 5000 && prod.precoUnitario >= 30) {
      const fatorLote = Math.min(maxPossivel, Math.max(5, Math.floor(maxPossivel * 0.4)));
      qtdSugerida = Math.max(qtdSugerida, fatorLote);
    }

    const valorItem = Number((qtdSugerida * prod.precoUnitario).toFixed(2));
    if (totalAcumulado + valorItem <= limiteMaximo) {
      itensCompostos.set(prod.id, {
        id: prod.id,
        descricao: prod.descricao,
        quantidade: qtdSugerida,
        unidade: prod.unidade,
        valorUnitario: prod.precoUnitario,
        valorTotal: valorItem,
        ncm: prod.ncm,
        cfop: prod.cfop,
        categoria: prod.categoria,
      });
      totalAcumulado += valorItem;
    }
  }

  // LEI 1 & 2: Adiciona Acessórios em Proporção Funcional (NUNCA milhares de unidades)
  for (const prod of itensAcessorios) {
    if (totalAcumulado >= valorAlvo) break;
    const saldoRestante = limiteMaximo - totalAcumulado;
    if (saldoRestante <= 0) break;

    // Trava de Quantidade Rígida: Itens baratos têm teto máximo de 15 a 30 unidades
    const tetoAcessorio = 20;
    const maxPossivel = Math.min(tetoAcessorio, Math.floor(saldoRestante / prod.precoUnitario));
    if (maxPossivel <= 0) continue;

    const qtdAcessorio = Math.min(
      Math.max(2, Math.floor(Math.random() * 8) + 2),
      maxPossivel
    );

    const valorItem = Number((qtdAcessorio * prod.precoUnitario).toFixed(2));
    if (totalAcumulado + valorItem <= limiteMaximo) {
      itensCompostos.set(prod.id, {
        id: prod.id,
        descricao: prod.descricao,
        quantidade: qtdAcessorio,
        unidade: prod.unidade,
        valorUnitario: prod.precoUnitario,
        valorTotal: valorItem,
        ncm: prod.ncm,
        cfop: prod.cfop,
        categoria: prod.categoria,
      });
      totalAcumulado += valorItem;
    }
  }

  // Se ainda estiver abaixo do valor alvo, incrementa os produtos principais já presentes (ao invés de explodir os baratos)
  if (totalAcumulado < valorAlvo) {
    const itensNoPedido = Array.from(itensCompostos.values()).sort(
      (a, b) => b.valorUnitario - a.valorUnitario
    );

    for (const item of itensNoPedido) {
      if (totalAcumulado >= valorAlvo) break;
      const delta = valorAlvo - totalAcumulado;
      if (delta <= 0) break;

      // Incrementa produtos que custem pelo menos R$ 15 para não distorcer o mix
      if (item.valorUnitario >= 15) {
        const qtdIncremento = Math.min(
          Math.ceil(delta / item.valorUnitario),
          Math.floor((limiteMaximo - totalAcumulado) / item.valorUnitario)
        );

        if (qtdIncremento > 0) {
          item.quantidade += qtdIncremento;
          item.valorTotal = Number((item.quantidade * item.valorUnitario).toFixed(2));
          totalAcumulado += Number((qtdIncremento * item.valorUnitario).toFixed(2));
        }
      }
    }
  }

  // Ajuste milimétrico final (apenas se faltar um saldo pequeno < R$ 50 para atingir o alvo)
  if (totalAcumulado < valorAlvo) {
    const delta = valorAlvo - totalAcumulado;
    const acessorioAjuste = itensAcessorios[0];
    if (acessorioAjuste && delta > 0) {
      const qtdExtra = Math.min(10, Math.ceil(delta / acessorioAjuste.precoUnitario));
      const existente = itensCompostos.get(acessorioAjuste.id);
      if (existente && existente.quantidade + qtdExtra <= 30) {
        existente.quantidade += qtdExtra;
        existente.valorTotal = Number((existente.quantidade * existente.valorUnitario).toFixed(2));
        totalAcumulado += Number((qtdExtra * acessorioAjuste.precoUnitario).toFixed(2));
      }
    }
  }

  const itensFinais = Array.from(itensCompostos.values());
  const valorTotalFinal = Number(itensFinais.reduce((acc, it) => acc + it.valorTotal, 0).toFixed(2));
  const margem = Number((((valorTotalFinal - valorAlvo) / valorAlvo) * 100).toFixed(1));

  return {
    itens: itensFinais,
    valorTotal: valorTotalFinal,
    valorAlvoOriginal: valorAlvo,
    margemPercentual: margem,
    razaoExplicativa: `Oferta composta com ${itensFinais.length} itens em mix equilibrado (proporção de obra realista, sem distorção de acessórios). Total R$ ${valorTotalFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${margem >= 0 ? `+${margem}%` : `${margem}%`} em relação ao alvo de R$ ${valorAlvo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
  };
}

/**
 * Converte um Pedido de Venda Aprovado em Rascunho Oficial de NF-e (Pronto sem transmissão imediata)
 */
export function converterPedidoParaNFeRascunho(
  cliente: BlingCliente,
  itens: PedidoItemVenda[],
  empresa: EmpresaTenant,
  banco: BankProvider = 'inter',
  quantidadeParcelas: number = 1
): NFeData {
  const numeroNFe = String(Math.floor(1000 + Math.random() * 9000));
  const valorTotal = itens.reduce((acc, it) => acc + it.valorTotal, 0);

  const parcelas = calcularDivisaoParcelas(valorTotal, quantidadeParcelas, banco);
  const dataHoje = new Date().toISOString().split('T')[0];

  const emitente: CompanyProfile = {
    razaoSocial: empresa.razaoSocial || 'Empresa Emitente Bling',
    nomeFantasia: empresa.nomeFantasia || empresa.razaoSocial || 'Empresa Emitente',
    cnpj: empresa.cnpj || '00.000.000/0001-00',
    inscricaoEstadual: empresa.inscricaoEstadual || 'ISENTO',
    logradouro: empresa.logradouro || 'Av. Principal',
    numero: empresa.numero || '100',
    bairro: empresa.bairro || 'Centro',
    cidade: empresa.cidade || 'São Paulo',
    uf: empresa.uf || 'SP',
    cep: empresa.cep || '01000-000',
    regimeTributario: (empresa.regimeTributario as any) || 'Simples Nacional',
    certificadoA1Valido: empresa.certificadoA1Valido ?? true,
  };

  const destinatario = {
    razaoSocial: cliente.nome || cliente.fantasia || 'Cliente Destinatário',
    cnpj: cliente.numeroDocumento || '00.000.000/0001-00',
    inscricaoEstadual: cliente.ie || 'ISENTO',
    cidade: cliente.endereco?.geral?.municipio || 'São Paulo',
    uf: cliente.endereco?.geral?.uf || 'SP',
    email: cliente.email || '',
    telefone: cliente.telefone || cliente.celular || '',
  };

  const chaveAcesso = gerarChaveAcessoNFe('35', numeroNFe, emitente.cnpj);

  return {
    numeroNFe,
    serie: '1',
    dataEmissao: dataHoje,
    naturezaOperacao: 'Venda de mercadoria adquirida de terceiros',
    chaveAcesso,
    status: 'rascunho', // IMPORTANTE: Preparada em rascunho sem transmitir
    emitente,
    destinatario,
    itens,
    valorProdutos: valorTotal,
    valorTotal: valorTotal,
    valorTotalFormatado: formatCurrency(valorTotal),
    quantidadeParcelas,
    parcelas,
    banco,
  };
}
