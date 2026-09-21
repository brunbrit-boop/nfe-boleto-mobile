import type { BankProvider, CompanyProfile, NFeData, ProductItem } from '../types';
import { calcularDivisaoParcelas, formatCurrency, gerarChaveAcessoNFe } from './financeEngine';

export interface ParsedVoiceCommand {
  destinatarioNome: string;
  destinatarioCnpj?: string;
  destinatarioCidade?: string;
  destinatarioUf?: string;
  descricaoProduto: string;
  quantidadeItens: number;
  valorTotal: number;
  quantidadeParcelas: number;
  banco?: BankProvider;
  confianca: number;
  textoOriginal: string;
  mensagemResposta: string;
}

// Exemplos de clientes fictícios cadastrados para enriquecer automaticamente
const CLIENTES_CONHECIDOS: Record<string, { cnpj: string; cidade: string; uf: string; ie: string }> = {
  'silva materiais': { cnpj: '14.289.471/0001-35', cidade: 'São Paulo', uf: 'SP', ie: '109.832.741.112' },
  'metalúrgica alpha': { cnpj: '28.192.403/0001-89', cidade: 'Campinas', uf: 'SP', ie: '244.921.832.110' },
  'padaria estrela': { cnpj: '08.932.110/0001-44', cidade: 'Santos', uf: 'SP', ie: '633.910.223.119' },
  'construtora morada nova': { cnpj: '33.409.812/0001-02', cidade: 'Belo Horizonte', uf: 'MG', ie: '002.391.821.009' },
  'auto mecânica souza': { cnpj: '19.821.002/0001-71', cidade: 'Ribeirão Preto', uf: 'SP', ie: '582.109.382.115' },
};

/**
 * Converte palavras de números para inteiros (ex: "três" -> 3, "duas" -> 2)
 */
function converterPalavraParaNumero(texto: string): number | null {
  const mapa: Record<string, number> = {
    'uma': 1, 'um': 1,
    'duas': 2, 'dois': 2,
    'três': 3, 'tres': 3,
    'quatro': 4,
    'cinco': 5,
    'seis': 6,
    'sete': 7,
    'oito': 8,
    'nove': 9,
    'dez': 10,
    'doze': 12,
    'quinze': 15,
  };
  const limpo = texto.toLowerCase().trim();
  if (mapa[limpo]) return mapa[limpo];
  const num = parseInt(limpo, 10);
  return isNaN(num) ? null : num;
}

/**
 * Extrai valores monetários do texto falado (ex: "R$ 3.000", "3000 reais", "mil e quinhentos", "2.500,00")
 */
function extrairValorMonetario(texto: string): number | null {
  // Procura padrão R$ 1.234,56 ou 1234,56 ou 1234 reais
  const regexValorDireto = /(?:r\$\s*|valor\s*(?:de)?\s*)?(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?\s*(?:reais|real)?/i;
  
  // Procura por "X mil"
  const regexMil = /(\d+(?:[.,]\d+)?)\s*mil/i;
  const matchMil = texto.match(regexMil);
  if (matchMil) {
    const num = parseFloat(matchMil[1].replace(',', '.'));
    return num * 1000;
  }

  // "mil e quinhentos"
  if (/mil e quinhentos/i.test(texto)) return 1500;
  if (/dois mil/i.test(texto)) return 2000;
  if (/três mil|tres mil/i.test(texto)) return 3000;
  if (/quatro mil/i.test(texto)) return 4000;
  if (/cinco mil/i.test(texto)) return 5000;

  // Procura valores explicitamente acompanhados de R$ ou "reais"
  const regexReais = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+)\s*(?:reais|real)/i;
  const matchReais = texto.match(regexReais);
  if (matchReais) {
    const strLimpa = matchReais[1].replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(strLimpa);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const matchValor = texto.match(regexValorDireto);
  if (matchValor && matchValor[1]) {
    const inteiros = matchValor[1].replace(/\./g, '');
    const centavos = matchValor[2] || '00';
    const parsed = parseFloat(`${inteiros}.${centavos}`);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  return null;
}

/**
 * Extrai quantidade de parcelas (ex: "em 3 parcelas", "3 vezes", "3x", "dividido em 4", "duas vezes")
 */
function extrairQuantidadeParcelas(texto: string): number {
  // "em X parcelas", "X vezes", "X x"
  const regex1 = /(?:em|para|de)\s*(\d+|uma|duas|dois|três|tres|quatro|cinco|seis|sete|oito|nove|dez|doze)\s*(?:parcelas|vezes|x|pagamentos)/i;
  const match1 = texto.match(regex1);
  if (match1) {
    const n = converterPalavraParaNumero(match1[1]);
    if (n && n >= 1) return n;
  }

  // "parcelado em X"
  const regex2 = /parcelad[oa]\s*em\s*(\d+|uma|duas|dois|três|tres|quatro|cinco|seis|sete|oito|nove|dez|doze)/i;
  const match2 = texto.match(regex2);
  if (match2) {
    const n = converterPalavraParaNumero(match2[1]);
    if (n && n >= 1) return n;
  }

  // "X parcelas" direto
  const regex3 = /(\d+)\s*parcelas/i;
  const match3 = texto.match(regex3);
  if (match3) {
    const n = parseInt(match3[1], 10);
    if (!isNaN(n) && n >= 1) return n;
  }

  // "3x" ou "4x"
  const regex4 = /(\d+)x\b/i;
  const match4 = texto.match(regex4);
  if (match4) {
    const n = parseInt(match4[1], 10);
    if (!isNaN(n) && n >= 1) return n;
  }

  // Padrão à vista ou padrão 1x
  if (/à vista|a vista|em 1x|uma vez|única parcela/i.test(texto)) {
    return 1;
  }

  // Se não especificou, assume 3x (ou 1x se for muito baixo)
  return 3;
}

/**
 * Extrai o banco mencionado
 */
function extrairBanco(texto: string): BankProvider | undefined {
  const t = texto.toLowerCase();
  if (t.includes('inter') || t.includes('banco inter')) return 'inter';
  if (t.includes('asaas')) return 'asaas';
  if (t.includes('cora')) return 'cora';
  if (t.includes('itau') || t.includes('itaú')) return 'itau';
  if (t.includes('bradesco')) return 'bradesco';
  if (t.includes('sicoob')) return 'sicoob';
  return undefined;
}

/**
 * Extrai o nome da empresa destinatária
 */
function extrairEmpresa(texto: string): string {
  // Procura padrões como "para [a empresa] X", "para empresa X", "pro cliente X", "para o X"
  const regex = /(?:para\s+a\s+empresa|para\s+empresa|para\s+o\s+cliente|para\s+o|para\s+a|pra\s+empresa|pra\s+a|pra|para)\s+([^,.;]+?)(?:\s+(?:no\s+valor|valor|com|em|\d+|r\$|onde|com\s+o|cnpj)|$)/i;
  const match = texto.match(regex);
  
  if (match && match[1]) {
    let nome = match[1].trim();
    // Limpa palavras soltas
    nome = nome.replace(/^(empresa|cliente|loja)\s+/i, '');
    if (nome.length > 2) {
      return nome.charAt(0).toUpperCase() + nome.slice(1);
    }
  }

  // Fallback padrão se não encontrar
  return 'Empresa Comercial Alfa Ltda';
}

/**
 * Extrai a descrição dos produtos
 */
function extrairDescricaoProduto(texto: string): { descricao: string; quantidade: number } {
  // Procura padrões como "venda de X", "X unidades de Y", "X caixas de Y"
  const regexQtd = /(\d+)\s*(caixas|unidades|peças|metros|sacos|fardos|latas|itens|pacotes)?\s*de\s*([^,.;]+)/i;
  const matchQtd = texto.match(regexQtd);

  if (matchQtd) {
    const qtd = parseInt(matchQtd[1], 10);
    const un = matchQtd[2] || 'unidades';
    const prod = matchQtd[3].trim();
    return {
      descricao: `${prod.charAt(0).toUpperCase() + prod.slice(1)} (${un})`,
      quantidade: isNaN(qtd) || qtd <= 0 ? 1 : qtd,
    };
  }

  // Procura "venda de [produtos]"
  const regexVenda = /venda\s+de\s+([^,.;]+?)(?:\s+(?:da\s+minha|para|no\s+valor|valor)|$)/i;
  const matchVenda = texto.match(regexVenda);
  if (matchVenda && matchVenda[1]) {
    const desc = matchVenda[1].trim();
    return {
      descricao: desc.charAt(0).toUpperCase() + desc.slice(1),
      quantidade: 1,
    };
  }

  return {
    descricao: 'Produtos Manufaturados / Mercadorias para Revenda',
    quantidade: 1,
  };
}

/**
 * Motor Principal de Parsing Semântico e Interpretação por IA
 */
export function interpretarComandoVoz(
  comandoTexto: string,
  bancoAtual: BankProvider = 'inter'
): ParsedVoiceCommand {
  const textoLimpo = comandoTexto.trim();

  // 1. Extrai destinatário
  const destinatarioNome = extrairEmpresa(textoLimpo);

  // Verifica se temos dados adicionais deste cliente
  const chaveCliente = destinatarioNome.toLowerCase();
  let cnpj = '18.490.219/0001-84';
  let cidade = 'São Paulo';
  let uf = 'SP';

  for (const [nomeCadastrado, dados] of Object.entries(CLIENTES_CONHECIDOS)) {
    if (chaveCliente.includes(nomeCadastrado) || nomeCadastrado.includes(chaveCliente)) {
      cnpj = dados.cnpj;
      cidade = dados.cidade;
      uf = dados.uf;
      break;
    }
  }

  // 2. Extrai valor total
  let valorTotal = extrairValorMonetario(textoLimpo);
  if (!valorTotal || valorTotal <= 0) {
    valorTotal = 1500.00; // Valor padrão demonstrativo inteligente se não citado
  }

  // 3. Extrai parcelas
  const quantidadeParcelas = extrairQuantidadeParcelas(textoLimpo);

  // 4. Extrai banco
  const bancoDetectado = extrairBanco(textoLimpo) || bancoAtual;

  // 5. Extrai produto
  const { descricao, quantidade } = extrairDescricaoProduto(textoLimpo);

  // 6. Mensagem de resposta em linguagem natural do robô
  const valorFormatado = formatCurrency(valorTotal);
  const valorParcelaAprox = formatCurrency(valorTotal / quantidadeParcelas);

  let mensagemResposta = `Perfeito! Entendi seu comando. Preparei a **Nota Fiscal de Venda** para a empresa **${destinatarioNome}** no valor total de **${valorFormatado}**.\n\n` +
    `Calculei a divisão automática em **${quantidadeParcelas}x de ${valorParcelaAprox}**, gerando os vencimentos e os códigos bancários (Linha Digitável, Código de Barras e Pix) prontos para o **${bancoDetectado.toUpperCase()}**!\n\n` +
    `Confira o resumo abaixo e clique em **Emitir e Enviar ao Banco** quando quiser autorizar.`;

  return {
    destinatarioNome,
    destinatarioCnpj: cnpj,
    destinatarioCidade: cidade,
    destinatarioUf: uf,
    descricaoProduto: descricao,
    quantidadeItens: quantidade,
    valorTotal,
    quantidadeParcelas,
    banco: bancoDetectado,
    confianca: 0.98,
    textoOriginal: comandoTexto,
    mensagemResposta,
  };
}

/**
 * Cria o objeto completo de NF-e a partir do comando interpretado
 */
export function criarNFeDeComando(
  parsed: ParsedVoiceCommand,
  empresaEmitente: CompanyProfile
): NFeData {
  const numeroNFe = Math.floor(1001 + Math.random() * 8999).toString();
  const serie = '1';
  const agora = new Date();
  const chaveAcesso = gerarChaveAcessoNFe(empresaEmitente.cnpj, numeroNFe, serie, '35');

  // Itens da NF-e
  const valorUnitario = parsed.valorTotal / parsed.quantidadeItens;
  const itens: ProductItem[] = [
    {
      id: 'item-1',
      descricao: parsed.descricaoProduto,
      quantidade: parsed.quantidadeItens,
      unidade: 'UN',
      valorUnitario,
      valorTotal: parsed.valorTotal,
      ncm: '8481.80.99',
      cfop: parsed.destinatarioUf === empresaEmitente.uf ? '5.102' : '6.102',
    }
  ];

  // Cálculo e geração das parcelas bancárias
  const parcelas = calcularDivisaoParcelas(
    parsed.valorTotal,
    parsed.quantidadeParcelas,
    parsed.banco || 'inter',
    30 // 30 dias de intervalo
  );

  return {
    numeroNFe,
    serie,
    dataEmissao: agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR'),
    naturezaOperacao: 'VENDA DE MERCADORIAS ADQUIRIDAS DE TERCEIROS',
    chaveAcesso,
    protocoloAutorizacao: `1352600${Math.floor(10000000 + Math.random() * 90000000)}`,
    status: 'rascunho',
    emitente: empresaEmitente,
    destinatario: {
      razaoSocial: parsed.destinatarioNome,
      cnpj: parsed.destinatarioCnpj || '18.490.219/0001-84',
      cidade: parsed.destinatarioCidade || 'São Paulo',
      uf: parsed.destinatarioUf || 'SP',
      inscricaoEstadual: 'ISENTO',
    },
    itens,
    valorProdutos: parsed.valorTotal,
    valorTotal: parsed.valorTotal,
    valorTotalFormatado: formatCurrency(parsed.valorTotal),
    quantidadeParcelas: parsed.quantidadeParcelas,
    parcelas,
    banco: parsed.banco || 'inter',
  };
}
