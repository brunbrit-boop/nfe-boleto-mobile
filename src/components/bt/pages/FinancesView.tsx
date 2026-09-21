import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { BlingContaPagar, BlingContaReceber } from '../../../types';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from 'recharts';

export interface FinanceTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  displayDate: string; // DD/MM
  description: string;
  category: string;
  categoryId?: string;
  entity: string; // Origem (cliente) ou Destino (fornecedor)
  amount: number;
  type: 'payable' | 'receivable';
  status: 'open' | 'simulated_paid' | 'paid' | 'marked_reopen';
  originType: 'bank_statement' | 'bling_erp';
  companyName: string;
  bankName: string;
  method: string;
  unit: string;
  unitId?: string;
  numeroDocumento?: string;
  originalBlingReceber?: BlingContaReceber;
  originalBlingPagar?: BlingContaPagar;
}

interface FinancesViewProps {
  contasPagar?: BlingContaPagar[];
  contasReceber?: BlingContaReceber[];
  onRefreshBling?: () => void;
  carregando?: boolean;
  onViewBoletoReceber?: (conta: BlingContaReceber) => void;
}

type TableMode = 'forecast' | 'realized' | 'all';

// Paletas de cores oficiais do BT Business para o Equalizador Hierárquico
const EXPENSE_SEGMENT_COLORS = ['#EF4444', '#F59E0B', '#FB7185', '#FACC15', '#A855F7', '#EC4899'];
const INCOME_SEGMENT_COLORS = ['#11d493', '#10B981', '#3B82F6', '#0EA5E9', '#6366F1', '#14B8A6'];

// Equalizador Hierárquico SVG
const EqualizerBar = (props: any) => {
  const { x, y, width, height, payload, type } = props;
  if (!payload || !width || !height) return null;

  const isExpense = type === 'payable';
  const breakdown = isExpense ? payload.payableBreakdown : payload.receivableBreakdown;
  const total = isExpense ? payload.despesas : payload.receitas;

  const bgColor = isExpense ? '#EF4444' : '#11d493';
  const palette = isExpense ? EXPENSE_SEGMENT_COLORS : INCOME_SEGMENT_COLORS;

  if (!total || total === 0 || !breakdown || breakdown.length === 0) {
    return (
      <rect
        x={x}
        y={y}
        width={Math.max(0, width)}
        height={Math.max(0, height)}
        fill={bgColor}
        opacity={0.8}
        rx={2}
        ry={2}
      />
    );
  }

  const numberOfCategories = Math.max(1, breakdown.length);
  const colWidth = Math.max(0, width) / numberOfCategories;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={Math.max(0, width)}
        height={Math.max(0, height)}
        fill={bgColor}
        opacity={0.3}
        rx={2}
        ry={2}
      />

      {breakdown.map((catData: any, catIndex: number) => {
        const colX = x + catIndex * colWidth;
        const divisor = total || 1;
        const colHeight = (catData.totalValue / divisor) * (height || 0);
        const colBaseY = (y || 0) + (height || 0);
        const baseColor = palette[catIndex % palette.length];

        let currentStackY = colBaseY;

        return (
          <g key={`${catData.category}-${catIndex}`}>
            {catData.units && catData.units.length > 0 ? (
              catData.units.map((unit: any, unitIndex: number) => {
                const unitDivisor = catData.totalValue || 1;
                const unitHeight = (unit.value / unitDivisor) * colHeight;
                currentStackY -= unitHeight;
                const opacity = Math.max(0.4, 1 - unitIndex * 0.18);

                return (
                  <rect
                    key={`${unit.unitName}-${unitIndex}`}
                    x={colX}
                    y={currentStackY}
                    width={Math.max(0, colWidth)}
                    height={Math.max(0, unitHeight)}
                    fill={baseColor}
                    fillOpacity={opacity}
                    stroke={bgColor}
                    strokeWidth={1.5}
                    rx={1}
                  />
                );
              })
            ) : (
              <rect
                x={colX}
                y={colBaseY - colHeight}
                width={Math.max(0, colWidth)}
                height={Math.max(0, colHeight)}
                fill={baseColor}
                stroke={bgColor}
                strokeWidth={1.5}
                rx={1}
              />
            )}
          </g>
        );
      })}
    </g>
  );
};

export const FinancesView: React.FC<FinancesViewProps> = ({
  contasPagar = [],
  contasReceber = [],
  onRefreshBling,
  carregando = false,
  onViewBoletoReceber,
}) => {
  // --- Estados de Controle Visual e Temporal ---
  const [tableMode, setTableMode] = useState<TableMode>('forecast');
  const [visibleDays, setVisibleDays] = useState<number>(30);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isChartMinimized, setIsChartMinimized] = useState<boolean>(false);

  // Split resizer (largura percentual da coluna de despesas vs receitas)
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [isResizingSplit, setIsResizingSplit] = useState<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Centralização 50/50 em Hoje
  const [referenceDate, setReferenceDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return d;
  });

  // Pinned Tooltip / Drill-down
  const [pinnedTooltipData, setPinnedTooltipData] = useState<any>(null);
  const [pinnedTooltipPos, setPinnedTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [pinnedFilterDate, setPinnedFilterDate] = useState<string | null>(null);
  const [pinnedFilterCategory, setPinnedFilterCategory] = useState<string | null>(null);
  const [pinnedFilterUnit, setPinnedFilterUnit] = useState<string | null>(null);

  // Drag / Rolagem horizontal
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Filtros de cabeçalho
  const [filtersPayable, setFiltersPayable] = useState<Record<string, string>>({});
  const [filtersReceivable, setFiltersReceivable] = useState<Record<string, string>>({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<{
    table: 'payable' | 'receivable';
    column: string;
  } | null>(null);

  // Modais de Criação & Lixeira
  const [showAddPayable, setShowAddPayable] = useState(false);
  const [showAddReceivable, setShowAddReceivable] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [deletedTransactions, setDeletedTransactions] = useState<FinanceTransaction[]>([]);

  const todayISO = useMemo(() => new Date().toISOString().split('T')[0], []);

  const formatDateBr = (isoStr: string) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length < 3) return isoStr;
    return `${parts[2]}/${parts[1]}`;
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // --- Base de Transações com Simulação em Estado Local ---
  const [allTransactions, setAllTransactions] = useState<FinanceTransaction[]>([]);

  // Inicializa e sincroniza transações do Bling + Extratos Bancários do Passado
  useEffect(() => {
    const list: FinanceTransaction[] = [];

    // 1. FUTURO: Contas a Receber Bling
    contasReceber.forEach((cr) => {
      const dateISO = cr.vencimento || cr.dataEmissao || todayISO;
      const isPaid = cr.situacao === 2 || dateISO < todayISO;
      list.push({
        id: `rec-bling-${cr.id}`,
        date: dateISO,
        displayDate: formatDateBr(dateISO),
        description: cr.historico || `Recebimento Ref #${cr.numeroDocumento || cr.id}`,
        category:
          (typeof cr.categoria === 'object' && cr.categoria !== null
            ? (cr.categoria as any).descricao
            : cr.categoria) || 'Vendas & Faturamento',
        entity: cr.contato?.nome || 'Cliente Bling',
        amount: Number(cr.valor) || 0,
        type: 'receivable',
        status: isPaid ? 'paid' : 'open',
        originType: isPaid ? 'bank_statement' : 'bling_erp',
        companyName: 'Empresa Ativa',
        bankName: 'Banco Inter',
        method: cr.pixCopiaECola ? 'PIX' : cr.linkBoleto ? 'Boleto' : 'Bolepix',
        unit: 'Matriz',
        numeroDocumento: cr.numeroDocumento,
        originalBlingReceber: cr,
      });
    });

    // 2. FUTURO: Contas a Pagar Bling
    contasPagar.forEach((cp) => {
      const dateISO = cp.vencimento || cp.dataEmissao || todayISO;
      const isPaid = cp.situacao === 2 || dateISO < todayISO;
      list.push({
        id: `pay-bling-${cp.id}`,
        date: dateISO,
        displayDate: formatDateBr(dateISO),
        description: cp.historico || `Pagamento Ref #${cp.numeroDocumento || cp.id}`,
        category:
          (typeof cp.categoria === 'object' && cp.categoria !== null
            ? (cp.categoria as any).descricao
            : cp.categoria) || 'Operacional / Insumos',
        entity: cp.contato?.nome || 'Fornecedor Bling',
        amount: Number(cp.valor) || 0,
        type: 'payable',
        status: isPaid ? 'paid' : 'open',
        originType: isPaid ? 'bank_statement' : 'bling_erp',
        companyName: 'Empresa Ativa',
        bankName: 'Banco Inter',
        method: cp.formaPagamento?.descricao || 'Boleto 30d',
        unit: 'Matriz',
        numeroDocumento: cp.numeroDocumento,
        originalBlingPagar: cp,
      });
    });

    // 3. PASSADO: Extrato Bancário Auditado (Histórico Realizado)
    const today = new Date();
    const getOffsetDate = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return d.toISOString().split('T')[0];
    };

    const bankStatementPast: FinanceTransaction[] = [
      {
        id: 'ext-p1',
        date: getOffsetDate(-14),
        displayDate: formatDateBr(getOffsetDate(-14)),
        description: 'DEB AUT ENEL DISTRIB SP',
        category: 'Utilidades',
        entity: 'Enel SP',
        amount: 1420.5,
        type: 'payable',
        status: 'paid',
        originType: 'bank_statement',
        companyName: 'Matriz SP',
        bankName: 'Itaú',
        method: 'Débito Automático',
        unit: 'Galpão 01',
      },
      {
        id: 'ext-r1',
        date: getOffsetDate(-12),
        displayDate: formatDateBr(getOffsetDate(-12)),
        description: 'PIX RECEBIDO MERCADO BOM PRECO',
        category: 'Vendas',
        entity: 'Mercado Bom Preço',
        amount: 8650.0,
        type: 'receivable',
        status: 'paid',
        originType: 'bank_statement',
        companyName: 'Matriz SP',
        bankName: 'Banco Inter',
        method: 'PIX',
        unit: 'Loja Centro',
      },
      {
        id: 'ext-p2',
        date: getOffsetDate(-10),
        displayDate: formatDateBr(getOffsetDate(-10)),
        description: 'PAGTO TIT EGILOX INDUSTRIA',
        category: 'Matéria Prima',
        entity: 'Egilox Indústria',
        amount: 4890.0,
        type: 'payable',
        status: 'paid',
        originType: 'bank_statement',
        companyName: 'Matriz SP',
        bankName: 'Banco Inter',
        method: 'Boleto',
        unit: 'Fábrica',
      },
      {
        id: 'ext-r2',
        date: getOffsetDate(-8),
        displayDate: formatDateBr(getOffsetDate(-8)),
        description: 'TED RECEBIMENTO SILVA DISTRIBUIDORA',
        category: 'Vendas',
        entity: 'Silva Distribuidora',
        amount: 5200.0,
        type: 'receivable',
        status: 'paid',
        originType: 'bank_statement',
        companyName: 'Filial PR',
        bankName: 'Banco do Brasil',
        method: 'TED',
        unit: 'Filial Sul',
      },
      {
        id: 'ext-p3',
        date: getOffsetDate(-6),
        displayDate: formatDateBr(getOffsetDate(-6)),
        description: 'PGTO ALUGUEL IMOVEIS CENTRAL',
        category: 'Aluguel',
        entity: 'Imóveis Central',
        amount: 3200.0,
        type: 'payable',
        status: 'paid',
        originType: 'bank_statement',
        companyName: 'Matriz SP',
        bankName: 'Itaú',
        method: 'Transferência',
        unit: 'Escritório',
      },
      {
        id: 'ext-r3',
        date: getOffsetDate(-4),
        displayDate: formatDateBr(getOffsetDate(-4)),
        description: 'LIQUIDACAO BOLETO #4091 CLIENTE VIP',
        category: 'Serviços',
        entity: 'Cliente VIP Corp',
        amount: 3900.0,
        type: 'receivable',
        status: 'paid',
        originType: 'bank_statement',
        companyName: 'Matriz SP',
        bankName: 'Banco Inter',
        method: 'Bolepix',
        unit: 'Matriz',
      },
      {
        id: 'ext-p4',
        date: getOffsetDate(-2),
        displayDate: formatDateBr(getOffsetDate(-2)),
        description: 'FOLHA PAGTO ADIANTAMENTO QUINZENA',
        category: 'RH / Salários',
        entity: 'Folha de Pagamento',
        amount: 7400.0,
        type: 'payable',
        status: 'paid',
        originType: 'bank_statement',
        companyName: 'Matriz SP',
        bankName: 'Banco Inter',
        method: 'PIX Lote',
        unit: 'Geral',
      },
    ];

    // Previsões complementares para demonstração completa de fluxo
    const futureModel: FinanceTransaction[] = [
      {
        id: 'fut-p1',
        date: getOffsetDate(2),
        displayDate: formatDateBr(getOffsetDate(2)),
        description: 'Fornecedor Embalagens Plásticas',
        category: 'Matéria Prima',
        entity: 'PlastPack Embalagens',
        amount: 2100.0,
        type: 'payable',
        status: 'open',
        originType: 'bling_erp',
        companyName: 'Matriz SP',
        bankName: 'Banco Inter',
        method: 'Boleto 15d',
        unit: 'Fábrica',
      },
      {
        id: 'fut-r1',
        date: getOffsetDate(3),
        displayDate: formatDateBr(getOffsetDate(3)),
        description: 'Faturamento Pedido Venda #1089',
        category: 'Vendas',
        entity: 'Supermercado Central',
        amount: 7800.0,
        type: 'receivable',
        status: 'open',
        originType: 'bling_erp',
        companyName: 'Matriz SP',
        bankName: 'Banco Inter',
        method: 'Bolepix',
        unit: 'Loja Centro',
      },
      {
        id: 'fut-p2',
        date: getOffsetDate(6),
        displayDate: formatDateBr(getOffsetDate(6)),
        description: 'DAS Simples Nacional Guia Mensal',
        category: 'Tributos',
        entity: 'Receita Federal',
        amount: 3450.0,
        type: 'payable',
        status: 'open',
        originType: 'bling_erp',
        companyName: 'Matriz SP',
        bankName: 'Itaú',
        method: 'Boleto Governo',
        unit: 'Fiscal',
      },
      {
        id: 'fut-r2',
        date: getOffsetDate(9),
        displayDate: formatDateBr(getOffsetDate(9)),
        description: 'Contrato Mensalidade Manutenção',
        category: 'Serviços',
        entity: 'Tech Soluções Ltda',
        amount: 6200.0,
        type: 'receivable',
        status: 'open',
        originType: 'bling_erp',
        companyName: 'Filial PR',
        bankName: 'Banco do Brasil',
        method: 'Boleto 30d',
        unit: 'Filial Sul',
      },
    ];

    setAllTransactions([...bankStatementPast, ...list, ...futureModel]);
  }, [contasPagar, contasReceber, todayISO]);

  // --- Operação de Arraste da Barra Divisória (Split Resizer) ---
  useEffect(() => {
    const handleMouseMoveResizer = (e: MouseEvent) => {
      if (!isResizingSplit || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
      if (newRatio >= 15 && newRatio <= 85) {
        setSplitRatio(newRatio);
      }
    };

    const handleMouseUpResizer = () => {
      setIsResizingSplit(false);
    };

    if (isResizingSplit) {
      window.addEventListener('mousemove', handleMouseMoveResizer);
      window.addEventListener('mouseup', handleMouseUpResizer);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveResizer);
      window.removeEventListener('mouseup', handleMouseUpResizer);
    };
  }, [isResizingSplit]);

  // --- Simulação Financeira (toggleSimulation) ---
  const toggleSimulation = (id: string) => {
    setAllTransactions((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.status === 'open') return { ...item, status: 'simulated_paid' };
        if (item.status === 'simulated_paid') return { ...item, status: 'open' };
        if (item.status === 'paid') return { ...item, status: 'marked_reopen' };
        if (item.status === 'marked_reopen') return { ...item, status: 'paid' };
        return item;
      })
    );
  };

  // Adiamento / Postergação de Vencimento
  const moveDate = (id: string, days: number) => {
    setAllTransactions((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const d = new Date(item.date + 'T12:00:00');
        d.setDate(d.getDate() + days);
        const newIso = d.toISOString().split('T')[0];
        return {
          ...item,
          date: newIso,
          displayDate: formatDateBr(newIso),
        };
      })
    );
  };

  // Exclusão e Envio para a Lixeira
  const deleteTransaction = (id: string) => {
    const target = allTransactions.find((t) => t.id === id);
    if (!target) return;
    setDeletedTransactions((prev) => [target, ...prev]);
    setAllTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const restoreTransaction = (id: string) => {
    const target = deletedTransactions.find((t) => t.id === id);
    if (!target) return;
    setAllTransactions((prev) => [target, ...prev]);
    setDeletedTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Contadores de Simulação
  const simulatedPaidCount = allTransactions.filter((t) => t.status === 'simulated_paid').length;
  const markedReopenCount = allTransactions.filter((t) => t.status === 'marked_reopen').length;
  const hasSimulationChanges = simulatedPaidCount > 0 || markedReopenCount > 0;

  const confirmSimulationChanges = () => {
    setAllTransactions((prev) =>
      prev.map((t) => {
        if (t.status === 'simulated_paid') return { ...t, status: 'paid' };
        if (t.status === 'marked_reopen') return { ...t, status: 'open' };
        return t;
      })
    );
  };

  const discardSimulationChanges = () => {
    setAllTransactions((prev) =>
      prev.map((t) => {
        if (t.status === 'simulated_paid') return { ...t, status: 'open' };
        if (t.status === 'marked_reopen') return { ...t, status: 'paid' };
        return t;
      })
    );
  };

  // --- Zoom Contínuo pela Roda do Mouse (handleWheelZoom) ---
  const handleWheelZoom = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 15) return;
    const factor = e.deltaY > 0 ? 3 : -3;
    setVisibleDays((prev) => Math.min(90, Math.max(7, prev + factor)));
  };

  // Chevrons temporais
  const handleScrollTime = (direction: 'left' | 'right') => {
    const shift = Math.max(3, Math.floor(visibleDays / 4));
    setReferenceDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + (direction === 'right' ? shift : -shift));
      return next;
    });
  };

  // Centralização 50/50 em Hoje
  const handleCenterToday = () => {
    const half = Math.floor(visibleDays / 2);
    const d = new Date();
    d.setDate(d.getDate() - half);
    setReferenceDate(d);
    setPinnedFilterDate(null);
    setPinnedFilterCategory(null);
    setPinnedFilterUnit(null);
    setPinnedTooltipData(null);
    setPinnedTooltipPos(null);
  };

  // Drag horizontal
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartDate(new Date(referenceDate));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartDate) return;
    const deltaX = e.clientX - dragStartX;
    const daysShift = Math.round(deltaX / 30);
    if (daysShift !== 0) {
      const newRef = new Date(dragStartDate);
      newRef.setDate(newRef.getDate() - daysShift);
      setReferenceDate(newRef);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStartDate(null);
  };

  // Clique no gráfico
  const handleChartClick = (state: any) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      const payload = state.activePayload[0].payload;
      setPinnedTooltipData(payload);
      setPinnedTooltipPos({
        x: state.chartX || 220,
        y: Math.max(20, (state.chartY || 100) - 30),
      });
      setPinnedFilterDate(payload.date);
      setPinnedFilterCategory(null);
      setPinnedFilterUnit(null);

      if (payload.date < todayISO) {
        setTableMode('realized');
      } else {
        setTableMode('forecast');
      }
    }
  };

  // --- Montagem do Gráfico com Equalizador e Decomposição Hierárquica ---
  const chartData = useMemo(() => {
    const daysMap = new Map<
      string,
      {
        receitas: number;
        despesas: number;
        payGroups: Map<string, { total: number; name: string; units: Map<string, number> }>;
        recGroups: Map<string, { total: number; name: string; units: Map<string, number> }>;
        items: FinanceTransaction[];
      }
    >();

    for (let i = 0; i < visibleDays; i++) {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      daysMap.set(iso, {
        receitas: 0,
        despesas: 0,
        payGroups: new Map(),
        recGroups: new Map(),
        items: [],
      });
    }

    allTransactions.forEach((tx) => {
      if (daysMap.has(tx.date)) {
        const slot = daysMap.get(tx.date)!;
        slot.items.push(tx);

        const isExpense = tx.type === 'payable';
        if (isExpense) {
          slot.despesas += tx.amount;
        } else {
          slot.receitas += tx.amount;
        }

        const targetGroup = isExpense ? slot.payGroups : slot.recGroups;
        const catKey = tx.category || 'Geral';
        if (!targetGroup.has(catKey)) {
          targetGroup.set(catKey, { total: 0, name: catKey, units: new Map() });
        }
        const cGroup = targetGroup.get(catKey)!;
        cGroup.total += tx.amount;

        const uKey = tx.unit || 'Matriz';
        cGroup.units.set(uKey, (cGroup.units.get(uKey) || 0) + tx.amount);
      }
    });

    let runningBalance = 20800;
    const dataPoints: any[] = [];

    const convertGroupsToArray = (
      gMap: Map<string, { total: number; name: string; units: Map<string, number> }>
    ) => {
      return Array.from(gMap.values()).map((g) => ({
        category: g.name,
        totalValue: g.total,
        units: Array.from(g.units.entries()).map(([uName, val]) => ({
          unitName: uName,
          value: val,
        })),
      }));
    };

    Array.from(daysMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([iso, val]) => {
        runningBalance = runningBalance + val.receitas - val.despesas;
        dataPoints.push({
          date: iso,
          displayDate: formatDateBr(iso),
          receitas: val.receitas,
          despesas: val.despesas,
          saldo: runningBalance,
          payableBreakdown: convertGroupsToArray(val.payGroups),
          receivableBreakdown: convertGroupsToArray(val.recGroups),
          items: val.items,
        });
      });

    return dataPoints;
  }, [allTransactions, referenceDate, visibleDays]);

  // --- Filtragem das Tabelas com Suporte a Drill-Down ---
  const { payablesList, receivablesList } = useMemo(() => {
    let base = allTransactions;

    if (pinnedFilterDate) {
      base = base.filter((tx) => tx.date === pinnedFilterDate);
    } else {
      if (tableMode === 'forecast') {
        base = base.filter((tx) => tx.status !== 'paid');
      } else if (tableMode === 'realized') {
        base = base.filter((tx) => tx.status === 'paid' || tx.status === 'marked_reopen');
      }
    }

    if (pinnedFilterCategory) {
      base = base.filter((tx) => tx.category.toLowerCase() === pinnedFilterCategory.toLowerCase());
    }

    if (pinnedFilterUnit) {
      base = base.filter((tx) => tx.unit.toLowerCase() === pinnedFilterUnit.toLowerCase());
    }

    const filterFn = (tx: FinanceTransaction, f: Record<string, string>) => {
      for (const [col, val] of Object.entries(f)) {
        if (!val) continue;
        const low = val.toLowerCase();
        if (col === 'company' && !tx.companyName.toLowerCase().includes(low)) return false;
        if (col === 'bank' && !tx.bankName.toLowerCase().includes(low)) return false;
        if (col === 'entity' && !tx.entity.toLowerCase().includes(low)) return false;
        if (col === 'method' && !tx.method.toLowerCase().includes(low)) return false;
        if (col === 'description' && !tx.description.toLowerCase().includes(low)) return false;
        if (col === 'unit' && !tx.unit.toLowerCase().includes(low)) return false;
      }
      return true;
    };

    return {
      payablesList: base.filter((t) => t.type === 'payable' && filterFn(t, filtersPayable)),
      receivablesList: base.filter((t) => t.type === 'receivable' && filterFn(t, filtersReceivable)),
    };
  }, [
    allTransactions,
    tableMode,
    pinnedFilterDate,
    pinnedFilterCategory,
    pinnedFilterUnit,
    filtersPayable,
    filtersReceivable,
  ]);

  // Contadores
  const counts = useMemo(() => {
    const openP = allTransactions.filter((t) => t.type === 'payable' && t.status !== 'paid').length;
    const openR = allTransactions.filter((t) => t.type === 'receivable' && t.status !== 'paid').length;
    const paidP = allTransactions.filter((t) => t.type === 'payable' && t.status === 'paid').length;
    const paidR = allTransactions.filter((t) => t.type === 'receivable' && t.status === 'paid').length;
    return {
      forecast: openP + openR,
      realized: paidP + paidR,
      openP,
      openR,
      paidP,
      paidR,
    };
  }, [allTransactions]);

  // Renderizador de Colunas com Funil de Filtro
  const renderHeaderWithFilter = (
    table: 'payable' | 'receivable',
    columnKey: string,
    label: string,
    alignRight = false
  ) => {
    const activeFilters = table === 'payable' ? filtersPayable : filtersReceivable;
    const hasFilter = !!activeFilters[columnKey];
    const isOpen =
      activeFilterDropdown?.table === table && activeFilterDropdown?.column === columnKey;

    return (
      <div className={`relative flex items-center gap-1 ${alignRight ? 'justify-end' : ''}`}>
        <span className="font-bold tracking-wider">{label}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveFilterDropdown(isOpen ? null : { table, column: columnKey });
          }}
          className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
            hasFilter ? 'text-[#11d493] font-black' : 'text-gray-400'
          }`}
          title={`Filtrar ${label}`}
        >
          <span className="material-symbols-outlined text-[13px]">filter_alt</span>
        </button>

        {isOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-[#1a2e28] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2 z-50 normal-case font-normal"
          >
            <input
              autoFocus
              type="text"
              placeholder={`Filtrar ${label}...`}
              value={activeFilters[columnKey] || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (table === 'payable') {
                  setFiltersPayable((prev) => ({ ...prev, [columnKey]: val }));
                } else {
                  setFiltersReceivable((prev) => ({ ...prev, [columnKey]: val }));
                }
              }}
              className="w-full text-xs p-1.5 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-[#10221c] text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#11d493]"
            />
            {hasFilter && (
              <button
                onClick={() => {
                  if (table === 'payable') {
                    setFiltersPayable((prev) => ({ ...prev, [columnKey]: '' }));
                  } else {
                    setFiltersReceivable((prev) => ({ ...prev, [columnKey]: '' }));
                  }
                  setActiveFilterDropdown(null);
                }}
                className="mt-1 text-[11px] text-red-500 hover:underline w-full text-left"
              >
                Limpar filtro
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col h-full bg-[#f6f8f7] dark:bg-[#0c1a15] select-none font-['Manrope',sans-serif] relative ${
        isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-[#0c1a15]' : ''
      }`}
      onClick={() => {
        setActiveFilterDropdown(null);
      }}
    >
      {/* 1. Header Superior com Controles Avançados do BT Business */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#10221c] flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#11d493]/15 text-[#11d493] flex items-center justify-center">
            <span className="material-symbols-outlined text-base">monitoring</span>
          </div>
          <h2 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">
            Financeiro (Passado & Futuro)
          </h2>
          <span className="text-[10px] text-gray-400 hidden sm:inline">
            • Extratos Bancários + Bling ERP
          </span>
        </div>

        {/* Barra de Ações: Lixeira, Chevrons, Zoom e Hoje (50/50) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Lixeira */}
          <button
            onClick={() => setShowTrashModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold transition-colors"
            title="Abrir Lixeira"
          >
            <span className="material-symbols-outlined text-sm">auto_delete</span>
            <span className="hidden sm:inline">Lixeira</span>
            {deletedTransactions.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-red-500 text-white font-bold">
                {deletedTransactions.length}
              </span>
            )}
          </button>

          {/* Chevrons Temporais */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => handleScrollTime('left')}
              className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
              title="Voltar no tempo"
            >
              <span className="material-symbols-outlined text-xs">chevron_left</span>
            </button>
            <button
              onClick={() => handleScrollTime('right')}
              className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
              title="Avançar no tempo"
            >
              <span className="material-symbols-outlined text-xs">chevron_right</span>
            </button>
          </div>

          {/* Presets de Zoom */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg text-xs font-bold">
            {[7, 15, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => {
                  setVisibleDays(d);
                  const half = Math.floor(d / 2);
                  const dt = new Date();
                  dt.setDate(dt.getDate() - half);
                  setReferenceDate(dt);
                }}
                className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                  visibleDays === d
                    ? 'bg-white dark:bg-[#162f27] text-[#11d493] shadow-sm font-black'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {d}D
              </button>
            ))}
          </div>

          {/* Botão Hoje (50/50) */}
          <button
            onClick={handleCenterToday}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-[11px] font-bold border border-blue-200 dark:border-blue-800 transition-colors shadow-sm"
            title="Recentralizar em Hoje (50% Passado Extratos / 50% Futuro Bling)"
          >
            <span className="material-symbols-outlined text-[13px]">today</span>
            Hoje (50/50)
          </button>

          {/* Maximizar / Minimizar Gráfico */}
          <button
            onClick={() => setIsChartMinimized(!isChartMinimized)}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-white"
            title={isChartMinimized ? 'Expandir Gráfico' : 'Minimizar Gráfico'}
          >
            <span className="material-symbols-outlined text-base">
              {isChartMinimized ? 'expand_more' : 'expand_less'}
            </span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-white"
            title="Tela Cheia"
          >
            <span className="material-symbols-outlined text-base">
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>

          {/* Botão Sincronizar Bling */}
          {onRefreshBling && (
            <button
              onClick={onRefreshBling}
              disabled={carregando}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-[#11d493] text-xs font-bold border border-emerald-500/30 transition-all disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[15px] ${carregando ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{carregando ? 'Sincronizando...' : 'Atualizar Bling'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Área do Gráfico com Equalizador Hierárquico SVG e Zoom Contínuo por Roda do Mouse */}
      {!isChartMinimized && (
        <div
          ref={chartContainerRef}
          onWheel={handleWheelZoom}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full relative border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#10221c] p-2 transition-cursor shrink-0 ${
            isFullscreen ? 'h-72' : 'h-52'
          } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 12, right: 15, left: 0, bottom: 0 }}
              barGap={2}
              onClick={handleChartClick}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />

              {/* Pano de Fundo Bicolor: Passado Bege (#f7f3e8) */}
              <ReferenceArea
                yAxisId="right"
                x1={chartData[0]?.displayDate}
                x2={formatDateBr(todayISO)}
                y1={-9999999}
                y2={9999999}
                fill="#f7f3e8"
                fillOpacity={0.65}
                ifOverflow="extendDomain"
                style={{ pointerEvents: 'none' }}
              />

              {/* Linha HOJE Centralizada */}
              <ReferenceLine
                yAxisId="right"
                x={formatDateBr(todayISO)}
                stroke="#2563EB"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{
                  value: 'HOJE',
                  position: 'top',
                  fill: '#2563EB',
                  fontSize: 10,
                  fontWeight: 900,
                }}
              />

              <XAxis
                dataKey="displayDate"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
                minTickGap={10}
              />
              <YAxis yAxisId="left" orientation="left" hide />
              <YAxis yAxisId="right" orientation="right" hide />

              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                formatter={(value) => (
                  <span className="text-[11px] text-gray-700 dark:text-gray-300 font-bold">
                    {value}
                  </span>
                )}
              />

              {/* Despesas: Shape EqualizerBar Hierárquico */}
              <Bar
                yAxisId="left"
                dataKey="despesas"
                name="Despesas (Categorias & Unidades)"
                shape={<EqualizerBar type="payable" />}
                maxBarSize={28}
                isAnimationActive={!isDragging}
              />

              {/* Receitas: Shape EqualizerBar Hierárquico */}
              <Bar
                yAxisId="left"
                dataKey="receitas"
                name="Receitas (Categorias & Unidades)"
                shape={<EqualizerBar type="receivable" />}
                maxBarSize={28}
                isAnimationActive={!isDragging}
              />

              {/* Linha de Saldo Azul com Recálculo Dinâmico */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="saldo"
                name="Saldo Projetado"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={{ fill: '#2563EB', r: 2 }}
                isAnimationActive={!isDragging}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* 3. Card Flutuante Interativo com Drill-Down Clicável por Categoria e Unidade */}
          {pinnedTooltipData && pinnedTooltipPos && (
            <div
              className="absolute z-50 pointer-events-auto shadow-2xl rounded-2xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-700 p-3 min-w-[340px] max-w-[420px] max-h-[360px] overflow-y-auto"
              style={{
                left: Math.min(Math.max(pinnedTooltipPos.x, 170), window.innerWidth - 360),
                top: Math.max(10, pinnedTooltipPos.y),
                transform: 'translate(-50%, -100%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setPinnedTooltipData(null);
                  setPinnedTooltipPos(null);
                  setPinnedFilterDate(null);
                  setPinnedFilterCategory(null);
                  setPinnedFilterUnit(null);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors"
                title="Fechar"
              >
                <span className="material-symbols-outlined text-[13px] font-bold">close</span>
              </button>

              <div className="text-center pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-xs font-black text-gray-900 dark:text-white">
                  {pinnedTooltipData.displayDate}
                </span>
                <p className="text-[10px] text-[#11d493] font-bold">
                  Clique em uma Categoria ou Unidade para filtrar
                </p>
              </div>

              {/* Detalhamento Clicável com Drill-Down */}
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                {/* Receitas */}
                <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-2 rounded-lg">
                  <span className="text-[#11d493] font-black text-[11px] block border-b border-emerald-200 dark:border-emerald-800/40 pb-1 mb-1">
                    ↑ Receitas: {formatBRL(pinnedTooltipData.receitas)}
                  </span>
                  {pinnedTooltipData.receivableBreakdown && pinnedTooltipData.receivableBreakdown.length > 0 ? (
                    <div className="space-y-1.5 mt-1">
                      {pinnedTooltipData.receivableBreakdown.map((item: any, idx: number) => (
                        <div key={idx} className="text-[10px]">
                          <div
                            onClick={() => setPinnedFilterCategory(item.category)}
                            className="flex items-center justify-between font-bold cursor-pointer hover:underline text-emerald-800 dark:text-emerald-300"
                            title={`Filtrar apenas ${item.category}`}
                          >
                            <span className="truncate">{item.category}</span>
                            <span>{formatBRL(item.totalValue)}</span>
                          </div>
                          {item.units &&
                            item.units.map((u: any, uIdx: number) => (
                              <div
                                key={uIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPinnedFilterUnit(u.unitName);
                                }}
                                className="flex items-center justify-between pl-2 text-[9px] text-gray-500 hover:text-[#11d493] cursor-pointer"
                                title={`Filtrar unidade ${u.unitName}`}
                              >
                                <span className="truncate">{u.unitName}</span>
                                <span>{formatBRL(u.value)}</span>
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-400 italic">Sem receitas</span>
                  )}
                </div>

                {/* Despesas */}
                <div className="bg-rose-50/70 dark:bg-rose-950/20 p-2 rounded-lg">
                  <span className="text-rose-600 dark:text-rose-400 font-black text-[11px] block border-b border-rose-200 dark:border-rose-800/40 pb-1 mb-1">
                    ↓ Despesas: {formatBRL(pinnedTooltipData.despesas)}
                  </span>
                  {pinnedTooltipData.payableBreakdown && pinnedTooltipData.payableBreakdown.length > 0 ? (
                    <div className="space-y-1.5 mt-1">
                      {pinnedTooltipData.payableBreakdown.map((item: any, idx: number) => (
                        <div key={idx} className="text-[10px]">
                          <div
                            onClick={() => setPinnedFilterCategory(item.category)}
                            className="flex items-center justify-between font-bold cursor-pointer hover:underline text-rose-800 dark:text-rose-300"
                            title={`Filtrar apenas ${item.category}`}
                          >
                            <span className="truncate">{item.category}</span>
                            <span>{formatBRL(item.totalValue)}</span>
                          </div>
                          {item.units &&
                            item.units.map((u: any, uIdx: number) => (
                              <div
                                key={uIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPinnedFilterUnit(u.unitName);
                                }}
                                className="flex items-center justify-between pl-2 text-[9px] text-gray-500 hover:text-rose-600 cursor-pointer"
                                title={`Filtrar unidade ${u.unitName}`}
                              >
                                <span className="truncate">{u.unitName}</span>
                                <span>{formatBRL(u.value)}</span>
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-400 italic">Sem despesas</span>
                  )}
                </div>
              </div>

              {/* Rodapé: Saldo Projetado */}
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100 dark:border-gray-800 font-bold">
                <span className="text-blue-600 dark:text-blue-400">Saldo Projetado:</span>
                <span className="font-mono text-gray-900 dark:text-white">
                  {formatBRL(pinnedTooltipData.saldo)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Barra de Controle e Filtro ("EXIBIÇÃO:") */}
      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">view_agenda</span>
            EXIBIÇÃO:
          </span>

          <div className="flex bg-gray-200 dark:bg-gray-700/60 p-0.5 rounded-lg text-xs font-semibold gap-1">
            <button
              onClick={() => {
                setTableMode('forecast');
                setPinnedFilterDate(null);
                setPinnedFilterCategory(null);
                setPinnedFilterUnit(null);
              }}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                tableMode === 'forecast'
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <span>🔮 Previsão (A Vencer)</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full font-bold">
                {counts.forecast}
              </span>
            </button>

            <button
              onClick={() => {
                setTableMode('realized');
                setPinnedFilterDate(null);
                setPinnedFilterCategory(null);
                setPinnedFilterUnit(null);
              }}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                tableMode === 'realized'
                  ? 'bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 shadow-sm font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <span>📜 Realizado (Auditado)</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full font-bold">
                {counts.realized}
              </span>
            </button>

            <button
              onClick={() => {
                setTableMode('all');
                setPinnedFilterDate(null);
                setPinnedFilterCategory(null);
                setPinnedFilterUnit(null);
              }}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                tableMode === 'all'
                  ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <span>📋 Todas</span>
            </button>
          </div>
        </div>

        {/* Tags de Filtros Ativos */}
        <div className="flex items-center gap-2 flex-wrap">
          {pinnedFilterDate && (
            <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-xs">
              <span className="material-symbols-outlined text-[13px]">calendar_month</span>
              <span>Data: <strong>{formatDateBr(pinnedFilterDate)}</strong></span>
              <button
                onClick={() => setPinnedFilterDate(null)}
                className="hover:text-red-500 ml-0.5"
                title="Limpar filtro de data"
              >
                <span className="material-symbols-outlined text-[13px]">cancel</span>
              </button>
            </div>
          )}

          {pinnedFilterCategory && (
            <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full text-xs">
              <span className="material-symbols-outlined text-[13px]">category</span>
              <span>Cat: <strong>{pinnedFilterCategory}</strong></span>
              <button
                onClick={() => setPinnedFilterCategory(null)}
                className="hover:text-red-500 ml-0.5"
                title="Limpar filtro de categoria"
              >
                <span className="material-symbols-outlined text-[13px]">cancel</span>
              </button>
            </div>
          )}

          {pinnedFilterUnit && (
            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full text-xs">
              <span className="material-symbols-outlined text-[13px]">domain</span>
              <span>Unidade: <strong>{pinnedFilterUnit}</strong></span>
              <button
                onClick={() => setPinnedFilterUnit(null)}
                className="hover:text-red-500 ml-0.5"
                title="Limpar filtro de unidade"
              >
                <span className="material-symbols-outlined text-[13px]">cancel</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. Divisão em Duas Colunas com Split Resizer Arrastável */}
      <div
        ref={splitContainerRef}
        className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0 select-none"
      >
        {/* ================= COLUNA ESQUERDA: DESPESAS / PAGAR ================= */}
        <div
          style={{ width: window.innerWidth > 768 ? `${splitRatio}%` : '100%' }}
          className="flex flex-col bg-red-50/30 dark:bg-red-950/5 overflow-hidden border-r border-gray-200 dark:border-gray-800"
        >
          {/* Header com Botão (+) e Contador */}
          <div className="p-2.5 bg-red-100/80 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-sm">arrow_downward</span>
              <h3 className="font-bold text-red-700 dark:text-red-400 uppercase text-xs tracking-wider">
                {tableMode === 'forecast'
                  ? 'CONTAS A PAGAR (PREVISÃO BLING)'
                  : tableMode === 'realized'
                  ? 'CONTAS PAGAS (AUDITADAS)'
                  : 'TODAS AS DESPESAS'}
              </h3>
              <button
                onClick={() => setShowAddPayable(true)}
                className="w-5 h-5 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors shadow-sm"
                title="Nova Conta a Pagar"
              >
                <span className="material-symbols-outlined text-xs font-bold">add</span>
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-red-600 shadow-sm border border-red-100 dark:border-gray-700">
              {tableMode === 'forecast'
                ? `${payablesList.length} Pendentes`
                : `${payablesList.length} Pagas`}
            </div>
          </div>

          {/* Tabela de Despesas com Simulação e Edição Inline */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="bg-white/90 dark:bg-[#162f27] uppercase text-[10px] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <tr>
                  <th className="p-2 text-center w-8">
                    <span className="material-symbols-outlined text-xs" title="Simular Pagamento">
                      tune
                    </span>
                  </th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'company', 'EMPRESA')}</th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'bank', 'BANCO')}</th>
                  <th className="p-2">DATA / ADIAR</th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'entity', 'DESTINO')}</th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'method', 'MÉTODO')}</th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'description', 'DESCRIÇÃO/OBS')}</th>
                  <th className="p-2 text-right">VALOR</th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'unit', 'UNIDADE')}</th>
                  <th className="p-2 text-center w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {payablesList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-gray-400 italic text-xs">
                      Nenhuma transação encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  payablesList.map((tx) => {
                    const isSimulated = tx.status === 'simulated_paid';
                    const isReopen = tx.status === 'marked_reopen';

                    return (
                      <tr
                        key={tx.id}
                        className={`transition-colors ${
                          isSimulated
                            ? 'bg-amber-100/60 dark:bg-amber-950/40 font-bold'
                            : isReopen
                            ? 'bg-blue-100/60 dark:bg-blue-950/40 font-bold'
                            : 'hover:bg-red-100/40 dark:hover:bg-red-900/10'
                        }`}
                      >
                        {/* Checkbox de Simulação */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={tx.status === 'paid' || isSimulated}
                            onChange={() => toggleSimulation(tx.id)}
                            className={`rounded cursor-pointer ${
                              isSimulated
                                ? 'text-amber-500 focus:ring-amber-400'
                                : 'text-red-600 focus:ring-red-500'
                            }`}
                            title={
                              tableMode === 'realized'
                                ? 'Simular reabertura de conta'
                                : 'Simular baixa de pagamento imediato'
                            }
                          />
                        </td>

                        <td className="p-2 font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[90px]">
                          {tx.companyName}
                        </td>

                        <td className="p-2 text-gray-600 dark:text-gray-300 truncate max-w-[75px]">
                          {tx.bankName}
                        </td>

                        {/* Data com Botões de Adiar */}
                        <td className="p-2 font-mono whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span>{tx.displayDate}</span>
                            <button
                              onClick={() => moveDate(tx.id, 1)}
                              className="text-[9px] px-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 font-bold"
                              title="Adiar +1 dia"
                            >
                              +1d
                            </button>
                            <button
                              onClick={() => moveDate(tx.id, 7)}
                              className="text-[9px] px-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 font-bold"
                              title="Adiar +7 dias"
                            >
                              +7d
                            </button>
                          </div>
                        </td>

                        <td className="p-2 font-bold text-gray-900 dark:text-white truncate max-w-[110px]">
                          {tx.entity}
                        </td>

                        <td className="p-2 text-gray-500 truncate max-w-[75px]">{tx.method}</td>

                        <td className="p-2 text-gray-700 dark:text-gray-300 truncate max-w-[130px]">
                          {tx.description}
                        </td>

                        <td className="p-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          - {formatBRL(tx.amount)}
                        </td>

                        <td className="p-2 text-gray-500 truncate max-w-[70px]">{tx.unit}</td>

                        <td className="p-2 text-center">
                          <button
                            onClick={() => deleteTransaction(tx.id)}
                            className="text-gray-400 hover:text-red-500"
                            title="Mover para Lixeira"
                          >
                            <span className="material-symbols-outlined text-[13px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= BARRA DE REDIMENSIONAMENTO ARRASTÁVEL (SPLIT RESIZER) ================= */}
        <div
          onMouseDown={() => setIsResizingSplit(true)}
          className="hidden md:flex w-1.5 hover:w-2 bg-gray-300 dark:bg-gray-700 hover:bg-[#11d493] cursor-col-resize transition-all z-20 items-center justify-center select-none"
          title="Arrastar para redimensionar colunas"
        >
          <div className="w-0.5 h-8 bg-gray-400 dark:bg-gray-500 rounded-full" />
        </div>

        {/* ================= COLUNA DIREITA: RECEITAS / RECEBER ================= */}
        <div
          style={{ width: window.innerWidth > 768 ? `${100 - splitRatio}%` : '100%' }}
          className="flex flex-col bg-emerald-50/30 dark:bg-emerald-950/5 overflow-hidden"
        >
          {/* Header com Botão (+) e Contador */}
          <div className="p-2.5 bg-emerald-100/80 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-sm">arrow_upward</span>
              <h3 className="font-bold text-emerald-700 dark:text-emerald-400 uppercase text-xs tracking-wider">
                {tableMode === 'forecast'
                  ? 'CONTAS A RECEBER (PREVISÃO BLING)'
                  : tableMode === 'realized'
                  ? 'CONTAS RECEBIDAS (AUDITADAS)'
                  : 'TODAS AS RECEITAS'}
              </h3>
              <button
                onClick={() => setShowAddReceivable(true)}
                className="w-5 h-5 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-colors shadow-sm"
                title="Nova Conta a Receber"
              >
                <span className="material-symbols-outlined text-xs font-bold">add</span>
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-600 shadow-sm border border-emerald-100 dark:border-gray-700">
              {tableMode === 'forecast'
                ? `${receivablesList.length} Pendentes`
                : `${receivablesList.length} Recebidas`}
            </div>
          </div>

          {/* Tabela de Receitas com Simulação e Edição Inline */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="bg-white/90 dark:bg-[#162f27] uppercase text-[10px] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <tr>
                  <th className="p-2 text-center w-8">
                    <span className="material-symbols-outlined text-xs" title="Simular Recebimento">
                      tune
                    </span>
                  </th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'company', 'EMPRESA')}</th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'bank', 'BANCO')}</th>
                  <th className="p-2">DATA / ADIAR</th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'entity', 'ORIGEM')}</th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'method', 'MÉTODO')}</th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'description', 'DESCRIÇÃO/OBS')}</th>
                  <th className="p-2 text-right">VALOR</th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'unit', 'UNIDADE')}</th>
                  <th className="p-2 text-center w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {receivablesList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-gray-400 italic text-xs">
                      Nenhuma transação encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  receivablesList.map((tx) => {
                    const isSimulated = tx.status === 'simulated_paid';
                    const isReopen = tx.status === 'marked_reopen';

                    return (
                      <tr
                        key={tx.id}
                        className={`transition-colors ${
                          isSimulated
                            ? 'bg-amber-100/60 dark:bg-amber-950/40 font-bold'
                            : isReopen
                            ? 'bg-blue-100/60 dark:bg-blue-950/40 font-bold'
                            : 'hover:bg-emerald-100/40 dark:hover:bg-emerald-900/10'
                        }`}
                      >
                        {/* Checkbox de Simulação */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={tx.status === 'paid' || isSimulated}
                            onChange={() => toggleSimulation(tx.id)}
                            className={`rounded cursor-pointer ${
                              isSimulated
                                ? 'text-amber-500 focus:ring-amber-400'
                                : 'text-emerald-600 focus:ring-emerald-500'
                            }`}
                            title={
                              tableMode === 'realized'
                                ? 'Simular reabertura de recebimento'
                                : 'Simular recebimento imediato'
                            }
                          />
                        </td>

                        <td className="p-2 font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[90px]">
                          {tx.companyName}
                        </td>

                        <td className="p-2 text-gray-600 dark:text-gray-300 truncate max-w-[75px]">
                          {tx.bankName}
                        </td>

                        {/* Data com Botões de Adiar */}
                        <td className="p-2 font-mono whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span>{tx.displayDate}</span>
                            <button
                              onClick={() => moveDate(tx.id, 1)}
                              className="text-[9px] px-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 font-bold"
                              title="Adiar +1 dia"
                            >
                              +1d
                            </button>
                            <button
                              onClick={() => moveDate(tx.id, 7)}
                              className="text-[9px] px-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 font-bold"
                              title="Adiar +7 dias"
                            >
                              +7d
                            </button>
                          </div>
                        </td>

                        <td className="p-2 font-bold text-gray-900 dark:text-white truncate max-w-[110px]">
                          {tx.entity}
                          {tx.originalBlingReceber && onViewBoletoReceber && (
                            <button
                              onClick={() => onViewBoletoReceber(tx.originalBlingReceber!)}
                              className="ml-1 text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 font-bold inline-flex items-center gap-0.5"
                              title="Ver Boleto Bling"
                            >
                              Boleto
                            </button>
                          )}
                        </td>

                        <td className="p-2 text-gray-500 truncate max-w-[75px]">{tx.method}</td>

                        <td className="p-2 text-gray-700 dark:text-gray-300 truncate max-w-[130px]">
                          {tx.description}
                        </td>

                        <td className="p-2 text-right font-mono font-bold text-[#11d493] whitespace-nowrap">
                          + {formatBRL(tx.amount)}
                        </td>

                        <td className="p-2 text-gray-500 truncate max-w-[70px]">{tx.unit}</td>

                        <td className="p-2 text-center">
                          <button
                            onClick={() => deleteTransaction(tx.id)}
                            className="text-gray-400 hover:text-red-500"
                            title="Mover para Lixeira"
                          >
                            <span className="material-symbols-outlined text-[13px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. Barra Flutuante de Simulação de Baixa / Reabertura */}
      {hasSimulationChanges && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-gray-950 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-gray-700 animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold">
              {simulatedPaidCount > 0
                ? `${simulatedPaidCount} pagamentos simulados (saldo recalculado)`
                : `${markedReopenCount} reaberturas simuladas`}
            </span>
          </div>

          <button
            onClick={confirmSimulationChanges}
            className="px-4 py-1.5 rounded-xl bg-[#11d493] text-gray-950 text-xs font-black hover:bg-[#0ea876] transition-all shadow-md"
          >
            {simulatedPaidCount > 0 ? 'Confirmar Baixa' : 'Confirmar Reabertura'}
          </button>

          <button
            onClick={discardSimulationChanges}
            className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-all"
          >
            Descartar
          </button>
        </div>
      )}

      {/* Modal Lixeira */}
      {showTrashModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500">auto_delete</span>
                Lixeira de Contas ({deletedTransactions.length})
              </h3>
              <button onClick={() => setShowTrashModal(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {deletedTransactions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8 italic">A lixeira está vazia.</p>
              ) : (
                deletedTransactions.map((dt) => (
                  <div key={dt.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-800 dark:text-white">{dt.description}</p>
                      <span className="text-[10px] text-gray-400">
                        {dt.entity} • {formatBRL(dt.amount)} • {dt.displayDate}
                      </span>
                    </div>
                    <button
                      onClick={() => restoreTransaction(dt.id)}
                      className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 font-bold text-xs"
                    >
                      Restaurar
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t dark:border-gray-800 flex justify-end">
              <button
                onClick={() => setShowTrashModal(false)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rápido de Nova Conta a Pagar */}
      {showAddPayable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-500">remove_circle</span>
                Nova Despesa / Conta a Pagar
              </h3>
              <button onClick={() => setShowAddPayable(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowAddPayable(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Fornecedor / Destino</label>
                <input
                  required
                  placeholder="Ex: Eginox Indústria"
                  className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Valor (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Vencimento</label>
                  <input
                    required
                    type="date"
                    defaultValue={todayISO}
                    className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Categoria / Descrição</label>
                <input
                  placeholder="Ex: Matéria Prima, Aluguel..."
                  className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddPayable(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rápido de Nova Conta a Receber */}
      {showAddReceivable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#11d493]">add_circle</span>
                Nova Receita / Conta a Receber
              </h3>
              <button onClick={() => setShowAddReceivable(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowAddReceivable(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Cliente / Origem</label>
                <input
                  required
                  placeholder="Ex: Mercado Bom Preço"
                  className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Valor (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Vencimento</label>
                  <input
                    required
                    type="date"
                    defaultValue={todayISO}
                    className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Categoria / Descrição</label>
                <input
                  placeholder="Ex: Venda Faturada, Contrato..."
                  className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddReceivable(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#11d493] text-gray-950 hover:bg-[#0ea876] shadow-sm"
                >
                  Salvar Receita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
