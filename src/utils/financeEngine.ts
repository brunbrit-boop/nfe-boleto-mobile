import type { BankConfig, BankProvider, Installment } from '../types';

export const BANKS: Record<BankProvider, BankConfig> = {
  inter: {
    id: 'inter',
    name: 'Banco Inter',
    code: '077',
    color: '#FF7A00',
    badgeBg: 'bg-orange-500/10 border-orange-500/30',
    badgeText: 'text-orange-400',
    logoIcon: '🟠',
    agencyDefault: '0001',
    accountDefault: '1234567-8',
    convenioDefault: '1092837',
  },
  asaas: {
    id: 'asaas',
    name: 'Asaas Gestão Financeira',
    code: '260',
    color: '#003087',
    badgeBg: 'bg-blue-500/10 border-blue-500/30',
    badgeText: 'text-blue-400',
    logoIcon: '🔵',
    agencyDefault: '0001',
    accountDefault: '8849201-3',
    convenioDefault: '992012',
  },
  cora: {
    id: 'cora',
    name: 'Cora Banco PJ',
    code: '403',
    color: '#FE3E6D',
    badgeBg: 'bg-pink-500/10 border-pink-500/30',
    badgeText: 'text-pink-400',
    logoIcon: '🟣',
    agencyDefault: '0001',
    accountDefault: '4039201-9',
    convenioDefault: '403112',
  },
  itau: {
    id: 'itau',
    name: 'Itaú Unibanco',
    code: '341',
    color: '#EC7000',
    badgeBg: 'bg-amber-500/10 border-amber-500/30',
    badgeText: 'text-amber-400',
    logoIcon: '🟧',
    agencyDefault: '1234',
    accountDefault: '98765-4',
    convenioDefault: '175',
  },
  bradesco: {
    id: 'bradesco',
    name: 'Banco Bradesco',
    code: '237',
    color: '#CC092F',
    badgeBg: 'bg-red-500/10 border-red-500/30',
    badgeText: 'text-red-400',
    logoIcon: '🔴',
    agencyDefault: '0543',
    accountDefault: '33445-5',
    convenioDefault: '09',
  },
  sicoob: {
    id: 'sicoob',
    name: 'Sicoob Cooperativa',
    code: '756',
    color: '#003641',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
    badgeText: 'text-emerald-400',
    logoIcon: '🟢',
    agencyDefault: '4321',
    accountDefault: '10203-0',
    convenioDefault: '75600',
  }
};

/**
 * Formata um número para moeda BRL (R$ 1.234,56)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Calcula o fator de vencimento Febraban
 */
function calcularFatorVencimento(data: Date): number {
  // Data base Febraban: 07/10/1997
  const dataBase = new Date(1997, 9, 7);
  const diffMs = data.getTime() - dataBase.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDias % 9000;
}

/**
 * Calcula módulo 10 para linha digitável
 */
function modulo10(bloco: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = bloco.length - 1; i >= 0; i--) {
    let mult = parseInt(bloco.charAt(i), 10) * peso;
    if (mult > 9) {
      mult = Math.floor(mult / 10) + (mult % 10);
    }
    soma += mult;
    peso = peso === 2 ? 1 : 2;
  }
  const dezenaSuperior = Math.ceil(soma / 10) * 10;
  const dv = dezenaSuperior - soma;
  return dv === 10 ? 0 : dv;
}

/**
 * Calcula módulo 11 Febraban
 */
function modulo11(codigo: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = codigo.length - 1; i >= 0; i--) {
    soma += parseInt(codigo.charAt(i), 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  if (dv === 0 || dv === 10 || dv === 11) return 1;
  return dv;
}

/**
 * Gera Código de Barras e Linha Digitável no padrão Febraban
 */
export function gerarDadosBoletoFebraban(
  banco: BankProvider,
  valor: number,
  dataVencimento: Date,
  nossoNumeroSeq: number
): { linhaDigitavel: string; codigoBarras: string; nossoNumero: string } {
  const bankConfig = BANKS[banco];
  const codBanco = bankConfig.code.padStart(3, '0');
  const codMoeda = '9'; // Real

  const fatorVencimento = calcularFatorVencimento(dataVencimento)
    .toString()
    .padStart(4, '0');

  // Valor em centavos com 10 posições
  const valorCentavos = Math.round(valor * 100)
    .toString()
    .padStart(10, '0');

  // Nosso número com 11 dígitos
  const nossoNumero = nossoNumeroSeq.toString().padStart(11, '0');

  // Campo livre do banco (25 caracteres)
  // Agência (4) + Carteira (2) + Nosso Número (11) + Conta (7) + Zero (1)
  const agencia = bankConfig.agencyDefault.padStart(4, '0');
  const carteira = '17';
  const conta = bankConfig.accountDefault.replace(/\D/g, '').slice(0, 7).padStart(7, '0');
  const campoLivre = `${agencia}${carteira}${nossoNumero}${conta}0`;

  // Montagem do Código de Barras sem DV geral
  const barcodeSemDV = `${codBanco}${codMoeda}${fatorVencimento}${valorCentavos}${campoLivre}`;
  const dvGeral = modulo11(barcodeSemDV);
  const codigoBarras = `${codBanco}${codMoeda}${dvGeral}${fatorVencimento}${valorCentavos}${campoLivre}`;

  // Montagem dos 3 campos da Linha Digitável
  // Campo 1: Banco(3) + Moeda(1) + CampoLivre 1..5 (5) + DV(1)
  const c1 = `${codBanco}${codMoeda}${campoLivre.slice(0, 5)}`;
  const dv1 = modulo10(c1);
  const campo1 = `${c1.slice(0, 5)}.${c1.slice(5)}${dv1}`;

  // Campo 2: CampoLivre 6..15 (10) + DV(1)
  const c2 = campoLivre.slice(5, 15);
  const dv2 = modulo10(c2);
  const campo2 = `${c2.slice(0, 5)}.${c2.slice(5)}${dv2}`;

  // Campo 3: CampoLivre 16..25 (10) + DV(1)
  const c3 = campoLivre.slice(15, 25);
  const dv3 = modulo10(c3);
  const campo3 = `${c3.slice(0, 5)}.${c3.slice(5)}${dv3}`;

  // Campo 4: DV Geral do Código de Barras
  const campo4 = `${dvGeral}`;

  // Campo 5: Fator Vencimento (4) + Valor (10)
  const campo5 = `${fatorVencimento}${valorCentavos}`;

  const linhaDigitavel = `${campo1} ${campo2} ${campo3} ${campo4} ${campo5}`;

  return {
    linhaDigitavel,
    codigoBarras,
    nossoNumero: `${carteira}/${nossoNumero}`,
  };
}

/**
 * Gera código Pix Copia e Cola associado ao boleto (Bolepix)
 */
export function gerarPixCopiaECola(
  valor: number,
  identificador: string,
  nomeRecebedor: string = 'SUA EMPRESA LTDA',
  cidade: string = 'SAO PAULO'
): string {
  const chavePix = 'financeiro@suaempresa.com.br';
  const valorStr = valor.toFixed(2);
  
  // Estrutura simplificada fiel ao padrão EMVCo BR Code
  const pixKeyField = `0014BR.GOV.BCB.PIX01${chavePix.length.toString().padStart(2, '0')}${chavePix}`;
  const txidField = `05${identificador.length.toString().padStart(2, '0')}${identificador}`;
  
  return `00020126${pixKeyField.length.toString().padStart(2, '0')}${pixKeyField}52040000530398654${valorStr.length.toString().padStart(2, '0')}${valorStr}5802BR59${nomeRecebedor.length.toString().padStart(2, '0')}${nomeRecebedor}60${cidade.length.toString().padStart(2, '0')}${cidade}62${(txidField.length + 4).toString().padStart(2, '0')}${txidField}6304A1B2`;
}

/**
 * Retorna a próxima data válida (ou a própria se já for válida) que caia em um dos dias da semana permitidos.
 * 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado.
 */
export function ajustarParaProximoDiaPermitido(data: Date, diasPermitidos: number[]): Date {
  if (!diasPermitidos || diasPermitidos.length === 0) return data;
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  for (let step = 0; step < 7; step++) {
    if (diasPermitidos.includes(d.getDay())) {
      return d;
    }
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Gera uma sequência de datas de primeiro vencimento escalonadas pelos dias da semana selecionados.
 * A primeira data será >= dataInicialStr caindo em um dos dias permitidos.
 * As datas subsequentes avançam nos próximos dias permitidos sucessivos da semana.
 * Suporta 2 modalidades:
 *  - 'continuo': avança continuamente pelas semanas seguintes (1 cliente por dia útil).
 *  - 'mesma_semana': limita o ciclo aos dias da mesma semana de referência, repetindo-os para clientes adicionais.
 */
export function gerarDatasEscalonadasSemanais(
  dataInicialStr: string,
  quantidade: number,
  diasPermitidos: number[],
  modoEscala: 'continuo' | 'mesma_semana' = 'continuo'
): string[] {
  if (quantidade <= 0) return [];
  if (!diasPermitidos || diasPermitidos.length === 0) {
    return Array(quantidade).fill(dataInicialStr);
  }

  let baseDate = new Date();
  if (dataInicialStr && /^\d{4}-\d{2}-\d{2}$/.test(dataInicialStr)) {
    const [ano, mes, dia] = dataInicialStr.split('-').map(Number);
    baseDate = new Date(ano, mes - 1, dia);
  }

  const formatarIso = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  if (modoEscala === 'mesma_semana') {
    // Determina a Segunda-feira da semana de referência
    const diaSem = baseDate.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
    const offsetSegunda = diaSem === 0 ? -6 : 1 - diaSem;
    const segundaFeira = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetSegunda);

    // Mapeia os dias permitidos ordenados de Segunda (1) a Domingo (7)
    const diasPermitidosOrdenados = [...diasPermitidos].sort((a, b) => {
      const pesoA = a === 0 ? 7 : a;
      const pesoB = b === 0 ? 7 : b;
      return pesoA - pesoB;
    });

    const datasDaSemana: string[] = diasPermitidosOrdenados.map((dia) => {
      const d = new Date(segundaFeira);
      const diffDias = (dia === 0 ? 7 : dia) - 1;
      d.setDate(d.getDate() + diffDias);
      return formatarIso(d);
    });

    if (datasDaSemana.length === 0) {
      return Array(quantidade).fill(dataInicialStr);
    }

    const resultado: string[] = [];
    for (let k = 0; k < quantidade; k++) {
      resultado.push(datasDaSemana[k % datasDaSemana.length]);
    }
    return resultado;
  }

  // Modo Contínuo (avança pelas semanas seguintes)
  let cursor = ajustarParaProximoDiaPermitido(baseDate, diasPermitidos);
  const resultado: string[] = [];

  for (let k = 0; k < quantidade; k++) {
    resultado.push(formatarIso(cursor));

    if (k < quantidade - 1) {
      cursor.setDate(cursor.getDate() + 1);
      cursor = ajustarParaProximoDiaPermitido(cursor, diasPermitidos);
    }
  }

  return resultado;
}

/**
 * Motor de Divisão Exata de Parcelas
 * Garante que a soma das parcelas seja rigorosamente igual ao valor total,
 * ajustando qualquer dízima periódica/centavos na 1ª parcela.
 * Suporta Caminho 2: parcelas futuras somam intervalo e caem sempre no próximo dia permitido.
 */
export function calcularDivisaoParcelas(
  valorTotal: number,
  qtdParcelas: number,
  banco: BankProvider = 'inter',
  intervaloDias: number = 30,
  dataPrimeiroVencimento?: Date,
  diasSemanaPermitidos?: number[]
): Installment[] {
  const parcelasValidas = Math.max(1, Math.min(qtdParcelas, 48));
  
  // Cálculo exato de centavos
  const centavosTotais = Math.round(valorTotal * 100);
  const centavosBase = Math.floor(centavosTotais / parcelasValidas);
  const centavosResto = centavosTotais - (centavosBase * parcelasValidas);

  const parcelas: Installment[] = [];
  const baseDate = dataPrimeiroVencimento || new Date();

  // Timestamp base para geração de nosso número único
  const seqBase = Math.floor(Date.now() / 1000) % 900000;

  // Caminho 2: Data corrente evolui a cada parcela
  let dataCorrente = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  if (diasSemanaPermitidos && diasSemanaPermitidos.length > 0) {
    dataCorrente = ajustarParaProximoDiaPermitido(dataCorrente, diasSemanaPermitidos);
  }

  for (let i = 1; i <= parcelasValidas; i++) {
    // Adiciona os centavos restantes na primeira parcela
    const centavosParcela = i === 1 ? centavosBase + centavosResto : centavosBase;
    const valorParcela = centavosParcela / 100;

    if (i === 1) {
      if (!dataPrimeiroVencimento) {
        dataCorrente.setDate(dataCorrente.getDate() + intervaloDias);
        if (diasSemanaPermitidos && diasSemanaPermitidos.length > 0) {
          dataCorrente = ajustarParaProximoDiaPermitido(dataCorrente, diasSemanaPermitidos);
        } else {
          if (dataCorrente.getDay() === 6) dataCorrente.setDate(dataCorrente.getDate() + 2);
          else if (dataCorrente.getDay() === 0) dataCorrente.setDate(dataCorrente.getDate() + 1);
        }
      }
    } else {
      // Parcela 2, 3, etc.: soma intervaloDias e avança para o próximo dia permitido (Caminho 2)
      dataCorrente.setDate(dataCorrente.getDate() + intervaloDias);
      if (diasSemanaPermitidos && diasSemanaPermitidos.length > 0) {
        dataCorrente = ajustarParaProximoDiaPermitido(dataCorrente, diasSemanaPermitidos);
      } else {
        // Se cair em Sábado (6) ou Domingo (0), prorroga para a Segunda-feira útil bancária
        if (dataCorrente.getDay() === 6) {
          dataCorrente.setDate(dataCorrente.getDate() + 2);
        } else if (dataCorrente.getDay() === 0) {
          dataCorrente.setDate(dataCorrente.getDate() + 1);
        }
      }
    }

    const dataVenc = new Date(dataCorrente);

    const yyyy = dataVenc.getFullYear();
    const mm = String(dataVenc.getMonth() + 1).padStart(2, '0');
    const dd = String(dataVenc.getDate()).padStart(2, '0');
    const dataVencimentoStr = `${yyyy}-${mm}-${dd}`;
    const dataVencimentoFormatada = `${dd}/${mm}/${yyyy}`;

    const seqNossoNumero = seqBase + i;
    const { linhaDigitavel, codigoBarras, nossoNumero } = gerarDadosBoletoFebraban(
      banco,
      valorParcela,
      dataVenc,
      seqNossoNumero
    );

    const pixCopiaECola = gerarPixCopiaECola(
      valorParcela,
      `PARC${i}DE${parcelasValidas}`
    );

    parcelas.push({
      numero: i,
      totalParcelas: parcelasValidas,
      dataVencimento: dataVencimentoStr,
      dataVencimentoFormatada,
      valor: valorParcela,
      valorFormatado: formatCurrency(valorParcela),
      nossoNumero,
      linhaDigitavel,
      codigoBarras,
      pixCopiaECola,
      status: 'pendente',
    });
  }

  return parcelas;
}

/**
 * Gera Chave de Acesso NF-e (44 dígitos) no padrão SEFAZ
 */
export function gerarChaveAcessoNFe(cnpjEmitente: string, numeroNFe: string, serie: string = '1', uf: string = '35'): string {
  const cnpjLimpo = cnpjEmitente.replace(/\D/g, '').padStart(14, '0');
  const anoMes = new Date().toISOString().slice(2, 7).replace('-', '');
  const mod = '55'; // NF-e 55
  const seriePad = serie.padStart(3, '0');
  const nNFPad = numeroNFe.padStart(9, '0');
  const tpEmis = '1'; // Normal
  const cNF = Math.floor(10000000 + Math.random() * 90000000).toString(); // Código numérico aleatório

  const chaveSemDV = `${uf}${anoMes}${cnpjLimpo}${mod}${seriePad}${nNFPad}${tpEmis}${cNF}`;
  
  // DV Módulo 11 SEFAZ
  let soma = 0;
  let peso = 2;
  for (let i = chaveSemDV.length - 1; i >= 0; i--) {
    soma += parseInt(chaveSemDV.charAt(i), 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const cDV = (resto === 0 || resto === 1) ? 0 : 11 - resto;

  return `${chaveSemDV}${cDV}`;
}

/**
 * Gera payload estruturado para integração bancária (API do Banco ou CNAB)
 */
export function gerarPayloadIntegracaoBanco(
  banco: BankProvider,
  razaoSocialCliente: string,
  cnpjCliente: string,
  parcela: Installment
): object {
  const bankConfig = BANKS[banco];

  switch (banco) {
    case 'inter':
      return {
        seuNumero: `NF-${parcela.nossoNumero}`,
        valorNominal: parcela.valor,
        dataVencimento: parcela.dataVencimento,
        numDiasAgenda: 60,
        pagador: {
          cpfCnpj: cnpjCliente.replace(/\D/g, ''),
          tipoPessoa: cnpjCliente.replace(/\D/g, '').length === 14 ? 'JURIDICA' : 'FISICA',
          nome: razaoSocialCliente,
        },
        beneficiarioFinal: {
          nome: 'SUA EMPRESA LTDA',
        },
        mensagem: {
          linha1: `Parcela ${parcela.numero} de ${parcela.totalParcelas} referente a NF-e`,
        }
      };

    case 'asaas':
      return {
        customer: cnpjCliente.replace(/\D/g, ''),
        billingType: 'BOLETO',
        value: parcela.valor,
        dueDate: parcela.dataVencimento,
        description: `Parcela ${parcela.numero}/${parcela.totalParcelas} - Venda de Produtos`,
        externalReference: parcela.nossoNumero,
        postalService: false
      };

    default:
      return {
        banco: bankConfig.name,
        codigoBanco: bankConfig.code,
        nossoNumero: parcela.nossoNumero,
        linhaDigitavel: parcela.linhaDigitavel,
        codigoBarras: parcela.codigoBarras,
        vencimento: parcela.dataVencimento,
        valor: parcela.valor,
        sacado: {
          nome: razaoSocialCliente,
          documento: cnpjCliente,
        }
      };
  }
}
