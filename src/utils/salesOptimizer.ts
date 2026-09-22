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
  catalogo: CatalogoProduto[] = CATALOGO_PRODUTOS_PADRAO
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

  // Embaralha levemente o catálogo para gerar combinações dinâmicas e inteligentes
  const catalogoOrdenado = [...catalogo].sort(() => 0.5 - Math.random());

  // 1. Fase de Mix Principal: Adiciona itens estratégicos
  for (const prod of catalogoOrdenado) {
    if (totalAcumulado >= valorAlvo) break;

    const saldoRestante = limiteMaximo - totalAcumulado;
    if (prod.precoUnitario > saldoRestante && totalAcumulado > 0) continue;

    // Calcula quantidade ideal para este item
    const maxPossivel = Math.floor(saldoRestante / prod.precoUnitario);
    if (maxPossivel <= 0) continue;

    // Distribui em quantidades proporcionais
    const qtdDesejada = Math.min(
      Math.max(1, Math.floor(Math.random() * Math.min(maxPossivel, 8)) + 1),
      maxPossivel
    );

    const valorItem = Number((qtdDesejada * prod.precoUnitario).toFixed(2));
    if (totalAcumulado + valorItem <= limiteMaximo) {
      itensCompostos.set(prod.id, {
        id: prod.id,
        descricao: prod.descricao,
        quantidade: qtdDesejada,
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

  // 2. Fase de Ajuste Fino: se ainda estiver abaixo do valor alvo, adiciona itens de menor ticket
  if (totalAcumulado < valorAlvo) {
    const itensMenorPreco = [...catalogo].sort((a, b) => a.precoUnitario - b.precoUnitario);

    for (const prod of itensMenorPreco) {
      if (totalAcumulado >= valorAlvo && totalAcumulado <= limiteMaximo) break;

      const delta = valorAlvo - totalAcumulado;
      if (delta <= 0) break;

      const qtdNecessaria = Math.ceil(delta / prod.precoUnitario);
      const valorAdicional = Number((qtdNecessaria * prod.precoUnitario).toFixed(2));

      if (totalAcumulado + valorAdicional <= limiteMaximo) {
        const existente = itensCompostos.get(prod.id);
        if (existente) {
          existente.quantidade += qtdNecessaria;
          existente.valorTotal = Number((existente.quantidade * existente.valorUnitario).toFixed(2));
          totalAcumulado += valorAdicional;
        } else {
          itensCompostos.set(prod.id, {
            id: prod.id,
            descricao: prod.descricao,
            quantidade: qtdNecessaria,
            unidade: prod.unidade,
            valorUnitario: prod.precoUnitario,
            valorTotal: valorAdicional,
            ncm: prod.ncm,
            cfop: prod.cfop,
            categoria: prod.categoria,
          });
          totalAcumulado += valorAdicional;
        }
        break;
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
    razaoExplicativa: `Oferta composta com ${itensFinais.length} itens do mix de produtos. Total R$ ${valorTotalFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${margem >= 0 ? `+${margem}%` : `${margem}%`} em relação ao alvo de R$ ${valorAlvo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
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
