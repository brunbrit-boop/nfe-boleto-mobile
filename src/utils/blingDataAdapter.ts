import type { BlingContaPagar, BlingContaReceber } from '../types';

export interface IndicadoresBling {
  saldoTotalProjetado: number;
  totalReceberAberto: number;
  totalReceberLiquidado: number;
  totalReceberVencido: number;
  qtdReceberAberto: number;
  totalPagarAberto: number;
  totalPagarLiquidado: number;
  totalPagarVencido: number;
  qtdPagarAberto: number;
  saldoOperacionalRealizado: number;
}

export interface FluxoCaixaItem {
  periodo: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

export interface CategoriaResumo {
  categoria: string;
  total: number;
  porcentagem: number;
  cor: string;
}

export interface ItemUrgente {
  id: number;
  tipo: 'pagar' | 'receber';
  contato: string;
  vencimento: string;
  vencimentoFormatado: string;
  valor: number;
  valorFormatado: string;
  diasAtraso: number; // 0 = hoje, >0 = atrasado, <0 = a vencer
  numeroDocumento: string;
}

const PALETA_CORES = [
  '#11d493', '#0ea5e9', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#3b82f6'
];

export function calcularIndicadoresBling(
  contasPagar: BlingContaPagar[],
  contasReceber: BlingContaReceber[]
): IndicadoresBling {
  const hoje = new Date().toISOString().split('T')[0];

  let totalReceberAberto = 0;
  let totalReceberLiquidado = 0;
  let totalReceberVencido = 0;
  let qtdReceberAberto = 0;

  contasReceber.forEach((cr) => {
    const val = Number(cr.valor) || 0;
    if (cr.situacao === 1) {
      totalReceberAberto += val;
      qtdReceberAberto++;
      if (cr.vencimento && cr.vencimento < hoje) {
        totalReceberVencido += val;
      }
    } else if (cr.situacao === 2) {
      totalReceberLiquidado += val;
    }
  });

  let totalPagarAberto = 0;
  let totalPagarLiquidado = 0;
  let totalPagarVencido = 0;
  let qtdPagarAberto = 0;

  contasPagar.forEach((cp) => {
    const val = Number(cp.valor) || 0;
    if (cp.situacao === 1) {
      totalPagarAberto += val;
      qtdPagarAberto++;
      if (cp.vencimento && cp.vencimento < hoje) {
        totalPagarVencido += val;
      }
    } else if (cp.situacao === 2) {
      totalPagarLiquidado += val;
    }
  });

  return {
    saldoTotalProjetado: totalReceberAberto - totalPagarAberto,
    saldoOperacionalRealizado: totalReceberLiquidado - totalPagarLiquidado,
    totalReceberAberto,
    totalReceberLiquidado,
    totalReceberVencido,
    qtdReceberAberto,
    totalPagarAberto,
    totalPagarLiquidado,
    totalPagarVencido,
    qtdPagarAberto,
  };
}

export function gerarSerieFluxoCaixa(
  contasPagar: BlingContaPagar[],
  contasReceber: BlingContaReceber[]
): FluxoCaixaItem[] {
  // Agrupa por mês/ano (ex: '2026-08', '2026-09', etc.)
  const mapaPeriodos = new Map<string, { receitas: number; despesas: number }>();

  const processarData = (dataStr: string, valor: number, tipo: 'receita' | 'despesa') => {
    if (!dataStr) return;
    const mesAno = dataStr.substring(0, 7); // YYYY-MM
    if (!mapaPeriodos.has(mesAno)) {
      mapaPeriodos.set(mesAno, { receitas: 0, despesas: 0 });
    }
    const atual = mapaPeriodos.get(mesAno)!;
    if (tipo === 'receita') {
      atual.receitas += valor;
    } else {
      atual.despesas += valor;
    }
  };

  contasReceber.forEach((cr) => {
    processarData(cr.vencimento || cr.dataEmissao, Number(cr.valor) || 0, 'receita');
  });

  contasPagar.forEach((cp) => {
    processarData(cp.vencimento || cp.dataEmissao, Number(cp.valor) || 0, 'despesa');
  });

  if (mapaPeriodos.size === 0) {
    const mesesDemo = ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'];
    return mesesDemo.map((m) => ({
      periodo: m,
      receitas: 0,
      despesas: 0,
      saldo: 0,
    }));
  }

  const periodosOrdenados = Array.from(mapaPeriodos.keys()).sort();
  const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return periodosOrdenados.map((p) => {
    const [ano, mes] = p.split('-');
    const nomeMes = nomesMeses[parseInt(mes, 10) - 1] || mes;
    const rotulo = `${nomeMes}/${ano.substring(2)}`;
    const dados = mapaPeriodos.get(p)!;
    return {
      periodo: rotulo,
      receitas: dados.receitas,
      despesas: dados.despesas,
      saldo: dados.receitas - dados.despesas,
    };
  });
}

export function obterItensUrgentes(
  contasPagar: BlingContaPagar[],
  contasReceber: BlingContaReceber[]
): ItemUrgente[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const itens: ItemUrgente[] = [];

  contasPagar
    .filter((cp) => cp.situacao === 1 && cp.vencimento)
    .forEach((cp) => {
      const d = new Date(cp.vencimento + 'T00:00:00');
      const diffDias = Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias >= -7) {
        itens.push({
          id: cp.id,
          tipo: 'pagar',
          contato: cp.contato?.nome || 'Fornecedor',
          vencimento: cp.vencimento,
          vencimentoFormatado: cp.vencimentoFormatado || cp.vencimento,
          valor: cp.valor,
          valorFormatado: cp.valorFormatado,
          diasAtraso: diffDias,
          numeroDocumento: cp.numeroDocumento || String(cp.id),
        });
      }
    });

  contasReceber
    .filter((cr) => cr.situacao === 1 && cr.vencimento)
    .forEach((cr) => {
      const d = new Date(cr.vencimento + 'T00:00:00');
      const diffDias = Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias >= -7) {
        itens.push({
          id: cr.id,
          tipo: 'receber',
          contato: cr.contato?.nome || 'Cliente',
          vencimento: cr.vencimento,
          vencimentoFormatado: cr.vencimentoFormatado || cr.vencimento,
          valor: cr.valor,
          valorFormatado: cr.valorFormatado,
          diasAtraso: diffDias,
          numeroDocumento: cr.numeroDocumento || String(cr.id),
        });
      }
    });

  return itens.sort((a, b) => b.diasAtraso - a.diasAtraso);
}

export function agruparPorCategoria(contas: (BlingContaPagar | BlingContaReceber)[]): CategoriaResumo[] {
  const mapa = new Map<string, number>();
  let totalGeral = 0;

  contas.forEach((item) => {
    const cat = item.categoria || 'Operacional';
    const val = Number(item.valor) || 0;
    mapa.set(cat, (mapa.get(cat) || 0) + val);
    totalGeral += val;
  });

  if (totalGeral === 0) return [];

  const ordenados = Array.from(mapa.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return ordenados.map(([categoria, total], idx) => ({
    categoria,
    total,
    porcentagem: Math.round((total / totalGeral) * 100),
    cor: PALETA_CORES[idx % PALETA_CORES.length],
  }));
}
