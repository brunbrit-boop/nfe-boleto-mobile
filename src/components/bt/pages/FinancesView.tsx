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
} from 'recharts';
import { BankUploadModal } from '../finances/BankUploadModal';
import { ClassifyTransactionsModal, type ClassificationRule } from '../finances/ClassifyTransactionsModal';
import { BankPatternChatbotModal } from '../finances/BankPatternChatbotModal';
import {
  obterContasReceberDoBanco,
  obterContasPagarDoBanco,
  testarConexaoPocketBase,
  getPocketBaseUrl,
} from '../../../services/pocketbaseService';

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
  empresaNome?: string;
}

// Paletas de cores oficiais do BT Business para o Equalizador Hierárquico
const EXPENSE_SEGMENT_COLORS = ['#EF4444', '#F59E0B', '#FB7185', '#FACC15', '#A855F7', '#EC4899'];
const INCOME_SEGMENT_COLORS = ['#11d493', '#10B981', '#3B82F6', '#0EA5E9', '#6366F1', '#14B8A6'];

// EqualizerBar Hierárquico SVG com Interatividade (Clique para Fixar e Hover Leve)
interface EqualizerBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: any;
  type?: 'payable' | 'receivable';
  onBarClick?: (payload: any, pos: { x: number; y: number }, type: 'payable' | 'receivable') => void;
  onBarHover?: (payload: any, pos: { x: number; y: number }, type: 'payable' | 'receivable') => void;
  onBarLeave?: () => void;
}

const EqualizerBar = (props: EqualizerBarProps) => {
  const { x, y, width, height, payload, type, onBarClick, onBarHover, onBarLeave } = props;
  if (!payload || !width || !height) return null;

  const barType: 'payable' | 'receivable' = type || 'payable';
  const isExpense = barType === 'payable';
  const breakdown = isExpense ? payload.payableBreakdown : payload.receivableBreakdown;
  const total = isExpense ? payload.despesas : payload.receitas;

  const bgColor = isExpense ? '#EF4444' : '#11d493';
  const palette = isExpense ? EXPENSE_SEGMENT_COLORS : INCOME_SEGMENT_COLORS;

  const startX = x || 0;
  const startY = y || 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBarClick) {
      onBarClick(payload, { x: startX + (width || 0) / 2, y: startY }, barType);
    }
  };

  const handleMouseEnter = () => {
    if (onBarHover) {
      onBarHover(payload, { x: startX + (width || 0) / 2, y: startY }, barType);
    }
  };

  const handleMouseLeave = () => {
    if (onBarLeave) {
      onBarLeave();
    }
  };

  if (!total || total === 0 || !breakdown || breakdown.length === 0) {
    return (
      <g
        className="cursor-pointer group transition-opacity hover:opacity-80"
        onClick={handleClick}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <rect
          x={startX}
          y={startY}
          width={Math.max(0, width)}
          height={Math.max(0, height)}
          fill={bgColor}
          opacity={0.8}
          rx={2}
          ry={2}
        />
      </g>
    );
  }

  const numberOfCategories = Math.max(1, breakdown.length);
  const colWidth = Math.max(0, width) / numberOfCategories;

  return (
    <g
      className="cursor-pointer group transition-opacity hover:opacity-85"
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <rect
        x={startX}
        y={startY}
        width={Math.max(0, width)}
        height={Math.max(0, height)}
        fill={bgColor}
        opacity={0.3}
        rx={2}
        ry={2}
      />

      {breakdown.map((catData: any, catIndex: number) => {
        const colX = startX + catIndex * colWidth;
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

// Formatação monetária e de data para os componentes de Gráfico e Tooltip
const formatDateBr = (isoStr: string) => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length < 3) return isoStr;
  return `${parts[2]}/${parts[1]}`;
};

const formatFullDateBr = (isoStr: string) => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length < 3) return isoStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatBRL = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  isInteractive?: boolean;
  onFilterCategory?: (category: string, date: string) => void;
  onFilterUnit?: (unit: string, date: string, category?: string) => void;
  onClose?: () => void;
  activeCategory?: string | null;
  activeUnit?: string | null;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  isInteractive = false,
  onFilterCategory,
  onFilterUnit,
  onClose,
  activeCategory,
  activeUnit,
}) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    if (!data) return null;

    const todayISO = new Date().toISOString().split('T')[0];
    const isPast = data.date < todayISO;

    return (
      <div
        className={`bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-700 p-3 rounded-2xl shadow-2xl text-xs z-[120] ${
          isInteractive
            ? 'max-h-[380px] min-w-[340px] md:min-w-[420px] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 ring-2 ring-[#11d493]/40 pointer-events-auto'
            : 'min-w-[240px] pointer-events-none'
        } transition-all`}
      >
        <div className="font-bold text-gray-800 dark:text-gray-100 mb-2 text-center border-b border-gray-100 dark:border-gray-800 pb-1.5 relative">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="material-symbols-outlined text-sm text-[#11d493]">event</span>
            <span>{label || data.displayDate} ({data.date})</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                isPast
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
              }`}
            >
              {isPast ? 'Passado / Auditado' : 'Previsão Bling'}
            </span>
          </div>

          {isInteractive ? (
            <span className="block text-[10px] text-[#11d493] font-semibold mt-0.5">
              Clique em uma categoria ou unidade para filtrar o gráfico e tabela
            </span>
          ) : (
            <span className="block text-[9px] text-gray-400 font-normal mt-0.5">
              Clique na barra ou na bolinha para fixar e filtrar
            </span>
          )}

          {isInteractive && onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors cursor-pointer"
              title="Fechar e desmarcar fixação"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Receitas */}
          <div className="min-w-0">
            <div className="flex items-center gap-1 mb-2 text-emerald-600 dark:text-emerald-400 font-bold border-b border-emerald-100 dark:border-emerald-900/30 pb-1">
              <span className="material-symbols-outlined text-sm">arrow_upward</span>
              <span className="truncate">Receitas: {formatBRL(data.receitas || 0)}</span>
            </div>

            {data.receivableBreakdown && data.receivableBreakdown.length > 0 ? (
              <ul className="space-y-2">
                {data.receivableBreakdown.map((item: any, idx: number) => {
                  const isCatSelected = activeCategory && activeCategory.toLowerCase() === item.category.toLowerCase();
                  return (
                    <li key={idx} className="flex flex-col text-gray-600 dark:text-gray-300">
                      <div
                        className={`flex justify-between items-center gap-1 p-1 rounded transition-colors group ${
                          isInteractive
                            ? 'cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                            : ''
                        } ${
                          isCatSelected
                            ? 'bg-emerald-100/90 dark:bg-emerald-900/50 ring-1 ring-emerald-500 font-bold text-emerald-800 dark:text-emerald-200'
                            : ''
                        }`}
                        onClick={() => isInteractive && onFilterCategory && onFilterCategory(item.category, data.date)}
                        title={isInteractive ? (isCatSelected ? `Clique para remover filtro de ${item.category}` : `Filtrar tabela por ${item.category}`) : undefined}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                INCOME_SEGMENT_COLORS[idx % INCOME_SEGMENT_COLORS.length],
                            }}
                          />
                          <span className="font-bold truncate text-[11px]" title={item.category}>
                            {item.category}
                          </span>
                        </div>
                        <span className="font-mono font-semibold shrink-0 text-[10px]">
                          {formatBRL(item.totalValue)}
                        </span>
                      </div>

                      {item.units && item.units.length > 0 && (
                        <div className="pl-2.5 mt-0.5 border-l-2 border-emerald-200 dark:border-emerald-900/40 space-y-0.5">
                          {item.units.map((u: any, uIdx: number) => {
                            const isUnitSelected = activeUnit && activeUnit.toLowerCase() === u.unitName.toLowerCase();
                            return (
                              <div
                                key={uIdx}
                                className={`flex justify-between text-[10px] text-gray-400 dark:text-gray-400 py-0.5 px-1 rounded group ${
                                  isInteractive
                                    ? 'cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20'
                                    : ''
                                } ${
                                  isUnitSelected
                                    ? 'bg-emerald-100/70 dark:bg-emerald-900/40 font-bold text-emerald-700 dark:text-emerald-300'
                                    : ''
                                }`}
                                onClick={(e) => {
                                  if (isInteractive && onFilterUnit) {
                                    e.stopPropagation();
                                    onFilterUnit(u.unitName, data.date, item.category);
                                  }
                                }}
                                title={isInteractive ? `Filtrar por unidade ${u.unitName}` : undefined}
                              >
                                <span className="truncate max-w-[85px]" title={u.unitName}>
                                  {u.unitName}
                                </span>
                                <span className="shrink-0 font-mono">{formatBRL(u.value)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-400 italic text-[10px] py-1">Sem receitas</p>
            )}
          </div>

          {/* Despesas */}
          <div className="min-w-0">
            <div className="flex items-center gap-1 mb-2 text-rose-600 dark:text-rose-400 font-bold border-b border-rose-100 dark:border-rose-900/30 pb-1">
              <span className="material-symbols-outlined text-sm">arrow_downward</span>
              <span className="truncate">Despesas: {formatBRL(data.despesas || 0)}</span>
            </div>

            {data.payableBreakdown && data.payableBreakdown.length > 0 ? (
              <ul className="space-y-2">
                {data.payableBreakdown.map((item: any, idx: number) => {
                  const isCatSelected = activeCategory && activeCategory.toLowerCase() === item.category.toLowerCase();
                  return (
                    <li key={idx} className="flex flex-col text-gray-600 dark:text-gray-300">
                      <div
                        className={`flex justify-between items-center gap-1 p-1 rounded transition-colors group ${
                          isInteractive
                            ? 'cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-900/30'
                            : ''
                        } ${
                          isCatSelected
                            ? 'bg-rose-100/90 dark:bg-rose-900/50 ring-1 ring-rose-500 font-bold text-rose-800 dark:text-rose-200'
                            : ''
                        }`}
                        onClick={() => isInteractive && onFilterCategory && onFilterCategory(item.category, data.date)}
                        title={isInteractive ? (isCatSelected ? `Clique para remover filtro de ${item.category}` : `Filtrar tabela por ${item.category}`) : undefined}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                EXPENSE_SEGMENT_COLORS[idx % EXPENSE_SEGMENT_COLORS.length],
                            }}
                          />
                          <span className="font-bold truncate text-[11px]" title={item.category}>
                            {item.category}
                          </span>
                        </div>
                        <span className="font-mono font-semibold shrink-0 text-[10px]">
                          {formatBRL(item.totalValue)}
                        </span>
                      </div>

                      {item.units && item.units.length > 0 && (
                        <div className="pl-2.5 mt-0.5 border-l-2 border-rose-200 dark:border-rose-900/40 space-y-0.5">
                          {item.units.map((u: any, uIdx: number) => {
                            const isUnitSelected = activeUnit && activeUnit.toLowerCase() === u.unitName.toLowerCase();
                            return (
                              <div
                                key={uIdx}
                                className={`flex justify-between text-[10px] text-gray-400 dark:text-gray-400 py-0.5 px-1 rounded group ${
                                  isInteractive
                                    ? 'cursor-pointer hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-900/20'
                                    : ''
                                } ${
                                  isUnitSelected
                                    ? 'bg-rose-100/70 dark:bg-rose-900/40 font-bold text-rose-700 dark:text-rose-300'
                                    : ''
                                }`}
                                onClick={(e) => {
                                  if (isInteractive && onFilterUnit) {
                                    e.stopPropagation();
                                    onFilterUnit(u.unitName, data.date, item.category);
                                  }
                                }}
                                title={isInteractive ? `Filtrar por unidade ${u.unitName}` : undefined}
                              >
                                <span className="truncate max-w-[85px]" title={u.unitName}>
                                  {u.unitName}
                                </span>
                                <span className="shrink-0 font-mono">{formatBRL(u.value)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-400 italic text-[10px] py-1">Sem despesas</p>
            )}
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs">
          <span className="text-blue-600 dark:text-blue-400 font-bold">Saldo Projetado:</span>
          <span className="font-mono font-bold text-gray-800 dark:text-white">
            {formatBRL(data.saldo || 0)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const FinancesView: React.FC<FinancesViewProps> = ({
  contasPagar = [],
  contasReceber = [],
  onRefreshBling,
  carregando = false,
  onViewBoletoReceber,
  empresaNome,
}) => {
  void onViewBoletoReceber;
  // --- Estados de Controle Visual e Temporal ---
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
  const [hoveredChartItem, setHoveredChartItem] = useState<{
    payload: any;
    pos: { x: number; y: number };
    kind: 'receivable' | 'payable' | 'balance';
    value: number;
    title: string;
  } | null>(null);
  const [pinnedFilterDate, setPinnedFilterDate] = useState<string | null>(null);
  const [pinnedFilterCategory, setPinnedFilterCategory] = useState<string | null>(null);
  const [pinnedFilterUnit, setPinnedFilterUnit] = useState<string | null>(null);
  const [previousFilters, setPreviousFilters] = useState<{
    category: string | null;
    unit: string | null;
    date: string | null;
  } | null>(null);

  // Drag / Rolagem horizontal
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Filtros de cabeçalho por coluna (funil)
  const [filtersPayable, setFiltersPayable] = useState<Record<string, string>>({});
  const [filtersReceivable, setFiltersReceivable] = useState<Record<string, string>>({});
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<{
    table: 'payable' | 'receivable';
    column: string;
  } | null>(null);

  // Modais Avançados do BT Business
  const [showAddPayable, setShowAddPayable] = useState(false);
  const [showAddReceivable, setShowAddReceivable] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showClassifyModal, setShowClassifyModal] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);

  // Seleção em lote para tabelas
  const [selectedTableItemIds, setSelectedTableItemIds] = useState<Set<string>>(new Set());
  const [deletedTransactions, setDeletedTransactions] = useState<FinanceTransaction[]>([]);

  const todayISO = useMemo(() => new Date().toISOString().split('T')[0], []);

  // --- Base de Transações com Simulação em Estado Local ---
  const [allTransactions, setAllTransactions] = useState<FinanceTransaction[]>([]);

  // --- Suporte a Visão Consolidada Multi-Empresas (PocketBase RDP) ---
  const [modoConsolidado, setModoConsolidado] = useState<boolean>(false);
  const [contasConsolidadasReceber, setContasConsolidadasReceber] = useState<BlingContaReceber[]>([]);
  const [contasConsolidadasPagar, setContasConsolidadasPagar] = useState<BlingContaPagar[]>([]);
  const [carregandoConsolidado, setCarregandoConsolidado] = useState<boolean>(false);
  const [pbOnline, setPbOnline] = useState<boolean | null>(null);

  // Mapa de ID -> Nome da empresa
  const mapaNomesEmpresas = useMemo(() => {
    const map: Record<string, string> = {};
    try {
      const raw = localStorage.getItem('nfe_empresas_list');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((e: any) => {
            if (e.id) map[e.id] = e.nomeFantasia || e.razaoSocial || e.id;
          });
        }
      }
    } catch {}
    return map;
  }, []);

  // Monitora saúde do servidor PocketBase RDP
  useEffect(() => {
    testarConexaoPocketBase()
      .then((res) => setPbOnline(res.ok))
      .catch(() => setPbOnline(false));
  }, []);

  // Busca dados consolidados de todas as empresas do PocketBase
  const carregarDadosConsolidados = async () => {
    setCarregandoConsolidado(true);
    try {
      const [cr, cp] = await Promise.all([
        obterContasReceberDoBanco(),
        obterContasPagarDoBanco(),
      ]);
      setContasConsolidadasReceber(cr);
      setContasConsolidadasPagar(cp);
    } catch (e) {
      console.error('Erro ao carregar dados consolidados:', e);
    } finally {
      setCarregandoConsolidado(false);
    }
  };

  useEffect(() => {
    if (modoConsolidado) {
      carregarDadosConsolidados();
    }
  }, [modoConsolidado]);

  // Inicializa e sincroniza transações reais do Bling ERP (ou consolidadas)
  useEffect(() => {
    const list: FinanceTransaction[] = [];
    const crList = modoConsolidado ? contasConsolidadasReceber : contasReceber;
    const cpList = modoConsolidado ? contasConsolidadasPagar : contasPagar;

    // 1. Contas a Receber Reais do Bling
    crList.forEach((cr: BlingContaReceber) => {
      const dateISO = cr.vencimento || cr.dataEmissao || todayISO;
      const isPaid = cr.situacao === 2;
      const nomeEmp = (cr.empresaId && mapaNomesEmpresas[cr.empresaId]) || empresaNome || 'Minha Empresa';
      list.push({
        id: `rec-bling-${cr.empresaId || ''}-${cr.id}`,
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
        originType: 'bling_erp',
        companyName: nomeEmp,
        bankName: 'Bling ERP',
        method: cr.pixCopiaECola ? 'PIX' : cr.linkBoleto ? 'Boleto' : 'Bolepix',
        unit: nomeEmp,
        numeroDocumento: cr.numeroDocumento,
        originalBlingReceber: cr,
      });
    });

    // 2. Contas a Pagar Reais do Bling
    cpList.forEach((cp: BlingContaPagar) => {
      const dateISO = cp.vencimento || cp.dataEmissao || todayISO;
      const isPaid = cp.situacao === 2;
      const nomeEmp = (cp.empresaId && mapaNomesEmpresas[cp.empresaId]) || empresaNome || 'Minha Empresa';
      list.push({
        id: `pay-bling-${cp.empresaId || ''}-${cp.id}`,
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
        originType: 'bling_erp',
        companyName: nomeEmp,
        bankName: 'Bling ERP',
        method: cp.formaPagamento?.descricao || 'Boleto',
        unit: nomeEmp,
        numeroDocumento: cp.numeroDocumento,
        originalBlingPagar: cp,
      });
    });

    // Mantém exclusivamente as contas reais do Bling + extratos manuais que o usuário porventura importou
    setAllTransactions((prev) => {
      const userUploaded = prev.filter(
        (t) => t.originType === 'bank_statement' && !t.id.startsWith('ext-')
      );
      return [...userUploaded, ...list];
    });
  }, [contasPagar, contasReceber, todayISO, empresaNome, modoConsolidado, contasConsolidadasReceber, contasConsolidadasPagar, mapaNomesEmpresas]);

  // --- Opções Dinâmicas para os Selects das Tabelas e Modais ---
  const bankOptions = useMemo(() => {
    const set = new Set<string>();
    allTransactions.forEach((t) => t.bankName && set.add(t.bankName));
    return Array.from(set).sort().map((name) => ({ id: name, name }));
  }, [allTransactions]);

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    allTransactions.forEach((t) => t.unit && set.add(t.unit));
    return Array.from(set).sort().map((name) => ({ id: name, name }));
  }, [allTransactions]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    allTransactions.forEach((t) => t.category && set.add(t.category));
    return Array.from(set).sort().map((name) => ({ id: name, name }));
  }, [allTransactions]);

  // --- Transações Base ---
  const baseFilteredTransactions = allTransactions;

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

  // --- Edição Direta Inline de Transações ---
  const updateTransaction = (id: string, updates: Partial<FinanceTransaction>) => {
    setAllTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

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

  // Adiamento de Vencimento
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

  // Adiamento em Lote dos Selecionados
  const handleBulkMoveDate = (days: number) => {
    if (selectedTableItemIds.size === 0) return;
    setAllTransactions((prev) =>
      prev.map((item) => {
        if (!selectedTableItemIds.has(item.id)) return item;
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
    setSelectedTableItemIds(new Set());
  };

  // Exclusão em Lote para Lixeira
  const handleBulkDelete = () => {
    if (selectedTableItemIds.size === 0) return;
    const targets = allTransactions.filter((t) => selectedTableItemIds.has(t.id));
    setDeletedTransactions((prev) => [...targets, ...prev]);
    setAllTransactions((prev) => prev.filter((t) => !selectedTableItemIds.has(t.id)));
    setSelectedTableItemIds(new Set());
  };

  // Exclusão individual
  const deleteTransaction = (id: string) => {
    const target = allTransactions.find((t) => t.id === id);
    if (!target) return;
    setDeletedTransactions((prev) => [target, ...prev]);
    setAllTransactions((prev) => prev.filter((t) => t.id !== id));
    if (selectedTableItemIds.has(id)) {
      const next = new Set(selectedTableItemIds);
      next.delete(id);
      setSelectedTableItemIds(next);
    }
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



  const handleClosePinnedTooltip = () => {
    setPinnedTooltipData(null);
    setPinnedTooltipPos(null);
    setPinnedFilterDate(null);
    setPinnedFilterCategory(null);
    setPinnedFilterUnit(null);

    if (previousFilters) {
      setPinnedFilterCategory(previousFilters.category);
      setPinnedFilterUnit(previousFilters.unit);
      setPinnedFilterDate(previousFilters.date);
      setPreviousFilters(null);
    }
  };

  // --- Zoom Contínuo pela Roda do Mouse (handleWheelZoom) ---
  const handleWheelZoom = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 15) return;
    if (pinnedTooltipData) handleClosePinnedTooltip();
    const factor = e.deltaY > 0 ? 3 : -3;
    setVisibleDays((prev) => Math.min(90, Math.max(7, prev + factor)));
  };

  // Chevrons temporais
  const handleScrollTime = (direction: 'left' | 'right') => {
    if (pinnedTooltipData) handleClosePinnedTooltip();
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
    handleClosePinnedTooltip();
  };

  // Drag horizontal proporcional à largura do container e visibleDays (mesmo cálculo do BT Business)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartDate(new Date(referenceDate));
    if (pinnedTooltipData) handleClosePinnedTooltip();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartDate) return;
    const containerWidth = chartContainerRef.current?.clientWidth || 800;
    const diffX = dragStartX - e.clientX;
    const pixelsPerDay = Math.max(8, containerWidth / visibleDays);
    const daysShift = Math.round(diffX / pixelsPerDay);
    if (daysShift !== 0) {
      const newRef = new Date(dragStartDate);
      newRef.setDate(newRef.getDate() + daysShift);
      setReferenceDate(newRef);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStartDate(null);
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

    baseFilteredTransactions.forEach((tx) => {
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

    const sortedDays = Array.from(daysMap.keys()).sort();
    const firstDate = sortedDays[0] || '';
    let runningBalance = baseFilteredTransactions
      .filter((tx) => firstDate && tx.date < firstDate)
      .reduce((acc, tx) => acc + (tx.type === 'receivable' ? tx.amount : -tx.amount), 0);
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
  }, [baseFilteredTransactions, referenceDate, visibleDays]);

  // --- Janela Temporal Visível Atual do Gráfico [startDate, endDate] ---
  // Vinculada 1:1 rigorosamente ao primeiro e último dia gerados nas colunas do gráfico
  const visibleDateRange = useMemo(() => {
    if (chartData.length > 0) {
      return {
        startDate: chartData[0].date,
        endDate: chartData[chartData.length - 1].date,
      };
    }
    const startD = new Date(referenceDate);
    const startDate = startD.toISOString().split('T')[0];
    const endD = new Date(referenceDate);
    endD.setDate(endD.getDate() + visibleDays - 1);
    const endDate = endD.toISOString().split('T')[0];
    return { startDate, endDate };
  }, [chartData, referenceDate, visibleDays]);

  // --- Handlers de Interação com Tooltip Fixado (Drill-down e Fechamento) ---
  const handlePinFilterCategory = (categoryName: string, date: string) => {
    if (pinnedFilterCategory?.toLowerCase() === categoryName.toLowerCase()) {
      // Toggle off se o usuário clicar na mesma categoria que já estava ativa
      setPinnedFilterCategory(null);
      setPinnedFilterUnit(null);
      return;
    }
    if (!previousFilters) {
      setPreviousFilters({
        category: pinnedFilterCategory,
        unit: pinnedFilterUnit,
        date: pinnedFilterDate,
      });
    }
    setPinnedFilterCategory(categoryName);
    setPinnedFilterUnit(null);
    setPinnedFilterDate(date);
  };

  const handlePinFilterUnit = (unitName: string, date: string, categoryName?: string) => {
    if (!previousFilters) {
      setPreviousFilters({
        category: pinnedFilterCategory,
        unit: pinnedFilterUnit,
        date: pinnedFilterDate,
      });
    }
    setPinnedFilterUnit(unitName);
    if (categoryName) {
      setPinnedFilterCategory(categoryName);
    }
    setPinnedFilterDate(date);
  };

  // Clique na Barra (Receita/Despesa) ou na Bolinha de Saldo (Fixa o Card, altera modo Realizado/Previsão e sincroniza data)
  const handleOpenPinnedTooltip = (payload: any, pos: { x: number; y: number }, _kind?: 'payable' | 'receivable' | 'balance') => {
    if (!payload) return;

    setHoveredChartItem(null);
    setPinnedTooltipData(payload);
    setPinnedTooltipPos({
      x: pos.x,
      y: Math.max(15, pos.y - 20),
    });

    if (!previousFilters) {
      setPreviousFilters({
        category: pinnedFilterCategory,
        unit: pinnedFilterUnit,
        date: pinnedFilterDate,
      });
    }

    setPinnedFilterDate(payload.date);
    setPinnedFilterCategory(null);
    setPinnedFilterUnit(null);
  };

  // Hover leve nas barras de receitas e despesas
  const handleBarHover = (payload: any, pos: { x: number; y: number }, type: 'payable' | 'receivable') => {
    if (pinnedTooltipData) return;
    const isExpense = type === 'payable';
    const val = isExpense ? (payload.despesas || 0) : (payload.receitas || 0);
    setHoveredChartItem({
      payload,
      pos,
      kind: type,
      value: val,
      title: isExpense ? 'Despesas do Dia' : 'Receitas do Dia',
    });
  };

  const handleBarLeave = () => {
    setHoveredChartItem(null);
  };

  // Renderizador SVG personalizado da bolinha de saldo com área de clique interativa e hover exato na linha/bolinha
  const renderBalanceDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload) return null;

    const isPinned = pinnedFilterDate === payload.date;
    const isHovered = hoveredChartItem?.kind === 'balance' && hoveredChartItem?.payload?.date === payload.date;

    return (
      <g
        key={`dot-${payload.date}`}
        className="cursor-pointer group"
        onClick={(e) => {
          e.stopPropagation();
          setHoveredChartItem(null);
          handleOpenPinnedTooltip(payload, { x: cx, y: cy }, 'balance');
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          if (!pinnedTooltipData) {
            setHoveredChartItem({
              payload,
              pos: { x: cx, y: cy },
              kind: 'balance',
              value: payload.saldo || 0,
              title: 'Saldo Projetado',
            });
          }
        }}
        onMouseLeave={() => {
          setHoveredChartItem((prev) => (prev?.payload?.date === payload.date ? null : prev));
        }}
      >
        {/* Halo animado quando fixado */}
        {isPinned && (
          <circle
            cx={cx}
            cy={cy}
            r={10}
            fill="#3b82f6"
            fillOpacity={0.25}
            stroke="#2563eb"
            strokeWidth={1.5}
            className="animate-pulse"
          />
        )}

        {/* Bolinha central de saldo (dimensão exata sobre a linha azul) */}
        <circle
          cx={cx}
          cy={cy}
          r={isPinned ? 6 : isHovered ? 5.5 : 4.5}
          fill={isPinned ? '#1d4ed8' : isHovered ? '#3b82f6' : '#2563eb'}
          stroke="#ffffff"
          strokeWidth={2}
          className="transition-all duration-150"
        />
      </g>
    );
  };

  // --- Filtragem das Tabelas com Suporte a Drill-Down e Filtros Globais ---
  const { payablesList, receivablesList } = useMemo(() => {
    let base = baseFilteredTransactions;

    // 1. Filtragem Temporal:
    // Se houver data fixada pelo clique na barra do gráfico, foca naquele dia específico (pinnedFilterDate).
    // Senão, reflete rigorosamente todo o período visível atual do gráfico [startDate, endDate]!
    if (pinnedFilterDate) {
      base = base.filter((tx) => tx.date === pinnedFilterDate);
    } else {
      base = base.filter(
        (tx) => tx.date >= visibleDateRange.startDate && tx.date <= visibleDateRange.endDate
      );
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
        if (col === 'category' && !tx.category.toLowerCase().includes(low)) return false;
      }
      return true;
    };

    return {
      payablesList: base.filter((tx) => tx.type === 'payable' && filterFn(tx, filtersPayable)),
      receivablesList: base.filter((tx) => tx.type === 'receivable' && filterFn(tx, filtersReceivable)),
    };
  }, [
    baseFilteredTransactions,
    pinnedFilterDate,
    visibleDateRange,
    pinnedFilterCategory,
    pinnedFilterUnit,
    filtersPayable,
    filtersReceivable,
  ]);

  // Funil de cabeçalho por coluna
  const renderHeaderWithFilter = (
    table: 'payable' | 'receivable',
    columnKey: string,
    label: string,
    alignRight = false
  ) => {
    const activeFilters = table === 'payable' ? filtersPayable : filtersReceivable;
    const hasFilter = Boolean(activeFilters[columnKey]);
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

  // Toggle de seleção em massa na tabela
  const toggleSelectTableItem = (id: string) => {
    const next = new Set(selectedTableItemIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTableItemIds(next);
  };

  const handleSelectAllTable = (items: FinanceTransaction[]) => {
    const allIds = items.map((i) => i.id);
    const areAllSelected = allIds.every((id) => selectedTableItemIds.has(id));

    const next = new Set(selectedTableItemIds);
    if (areAllSelected) {
      allIds.forEach((id) => next.delete(id));
    } else {
      allIds.forEach((id) => next.add(id));
    }
    setSelectedTableItemIds(next);
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
      {/* 1. Header Superior Principal */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#10221c] flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#11d493]/15 text-[#11d493] flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">monitoring</span>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">
              Fluxo de Caixa
            </h2>
          </div>
        </div>

        {/* Botões de Ação do BT Business */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Status PocketBase RDP */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-lg text-xs font-semibold select-none"
            title={`Servidor RDP PocketBase: ${getPocketBaseUrl()}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                pbOnline === true
                  ? 'bg-emerald-500 shadow-xs shadow-emerald-500 animate-pulse'
                  : pbOnline === false
                  ? 'bg-rose-500'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
              {pbOnline === true ? 'RDP PocketBase' : pbOnline === false ? 'RDP Offline' : 'RDP...'}
            </span>
          </div>

          {/* Toggle Visão Consolidada Multi-Empresas */}
          <button
            onClick={() => setModoConsolidado((prev) => !prev)}
            disabled={carregandoConsolidado}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs border ${
              modoConsolidado
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/25 ring-2 ring-indigo-400/30'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
            title="Consolidar contas de todas as empresas armazenadas no banco de dados do seu servidor RDP"
          >
            <span className={`material-symbols-outlined text-base ${carregandoConsolidado ? 'animate-spin' : ''}`}>
              {carregandoConsolidado ? 'progress_activity' : modoConsolidado ? 'hub' : 'storefront'}
            </span>
            <span>
              {modoConsolidado
                ? 'Visão Consolidada (Todas as Empresas)'
                : 'Empresa Atual'}
            </span>
          </button>

          {/* Botão Sincronizar Bling */}
          {onRefreshBling && (
            <button
              onClick={onRefreshBling}
              disabled={carregando}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 rounded-lg text-xs font-bold transition-all shadow-xs border border-emerald-200/80 dark:border-emerald-800/60 disabled:opacity-50"
              title="Buscar contas a pagar e receber atualizadas do Bling agora"
            >
              <span className={`material-symbols-outlined text-base ${carregando ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{carregando ? 'Sincronizando...' : 'Sincronizar Bling'}</span>
            </button>
          )}

          {/* Botão Uploads de Extratos */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded-lg text-xs font-bold transition-all shadow-xs"
            title="Importar Extrato Bancário (OFX/CSV)"
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            <span className="hidden sm:inline">Uploads Extrato</span>
          </button>

          {/* Botão Classificação Inteligente de Extratos */}
          <button
            onClick={() => setShowClassifyModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 rounded-lg text-xs font-bold transition-all shadow-xs"
            title="Classificação Inteligente & Regras de Extrato"
          >
            <span className="material-symbols-outlined text-base">auto_fix_high</span>
            <span className="hidden sm:inline">Classificar</span>
          </button>

          {/* Botão Robô IA de Padrões */}
          <button
            onClick={() => setShowBotModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 rounded-lg text-xs font-bold transition-all shadow-xs"
            title="Robô IA de Padrões Bancários"
          >
            <span className="material-symbols-outlined text-base">smart_toy</span>
            <span className="hidden sm:inline">Robô IA</span>
          </button>

          {/* Botão Lixeira */}
          <button
            onClick={() => setShowTrashModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 rounded-lg text-xs font-bold transition-colors shadow-xs"
            title="Lixeira de Contas"
          >
            <span className="material-symbols-outlined text-base">auto_delete</span>
            <span className="hidden sm:inline">Lixeira</span>
            {deletedTransactions.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-500 text-white font-bold">
                {deletedTransactions.length}
              </span>
            )}
          </button>

          <div className="h-5 w-px bg-gray-200 dark:bg-gray-800 mx-1 hidden sm:block"></div>

          {/* Chevrons Temporais com Indicador do Período */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 border border-gray-200/60 dark:border-gray-700/60">
            <button
              onClick={() => handleScrollTime('left')}
              className="p-1 hover:bg-white dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
              title="Voltar no tempo"
            >
              <span className="material-symbols-outlined text-xs">chevron_left</span>
            </button>
            <span className="text-[11px] font-bold px-2 text-gray-700 dark:text-gray-300 select-none whitespace-nowrap">
              {formatDateBr(visibleDateRange.startDate)} – {formatDateBr(visibleDateRange.endDate)}
            </span>
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
                  handleClosePinnedTooltip();
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
        </div>
      </div>

      {/* 3. Área do Gráfico com Equalizador Hierárquico SVG e Zoom Contínuo */}
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
              margin={{ top: 15, right: 20, left: 10, bottom: 5 }}
            >
              <defs>
                <pattern id="diagonalHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1" strokeOpacity="0.15" />
                </pattern>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />

              <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#3b82f6' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />

              {/* Fundo Bege Auditado no Passado */}
              {chartData.length > 0 && chartData[0].date < todayISO && (
                <ReferenceArea
                  yAxisId="left"
                  x1={chartData[0].displayDate}
                  x2={formatDateBr(todayISO)}
                  fill="#f7f3e8"
                  fillOpacity={0.65}
                />
              )}

              {/* Linha Vertical Pontilhada de HOJE */}
              <ReferenceLine
                yAxisId="left"
                x={formatDateBr(todayISO)}
                stroke="#11d493"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{
                  value: 'HOJE (Divisão Passado / Futuro)',
                  position: 'top',
                  fill: '#11d493',
                  fontSize: 10,
                  fontWeight: 'bold',
                }}
              />

              {/* Equalizador de Despesas */}
              <Bar
                yAxisId="left"
                dataKey="despesas"
                name="Despesas"
                shape={
                  <EqualizerBar
                    type="payable"
                    onBarClick={handleOpenPinnedTooltip}
                    onBarHover={handleBarHover}
                    onBarLeave={handleBarLeave}
                  />
                }
                maxBarSize={32}
              />

              {/* Equalizador de Receitas */}
              <Bar
                yAxisId="left"
                dataKey="receitas"
                name="Receitas"
                shape={
                  <EqualizerBar
                    type="receivable"
                    onBarClick={handleOpenPinnedTooltip}
                    onBarHover={handleBarHover}
                    onBarLeave={handleBarLeave}
                  />
                }
                maxBarSize={32}
              />

              {/* Curva de Saldo Projetado */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="saldo"
                name="Saldo Projetado"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={renderBalanceDot}
                activeDot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Mini-Badge Leve de Hover (Mostra apenas o valor numérico na cor da coluna/barra) */}
          {!pinnedTooltipData && hoveredChartItem && (
            <div
              className="absolute z-[110] pointer-events-none animate-in fade-in duration-75"
              style={{
                left: hoveredChartItem.pos.x,
                top: Math.max(6, hoveredChartItem.pos.y - 28),
                transform: 'translateX(-50%)',
              }}
            >
              <div
                className="px-2 py-0.5 rounded-md shadow-md border text-[11px] font-mono font-black tracking-tight whitespace-nowrap bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm"
                style={{
                  color:
                    hoveredChartItem.kind === 'receivable'
                      ? '#059669'
                      : hoveredChartItem.kind === 'payable'
                      ? '#dc2626'
                      : '#2563eb',
                  borderColor:
                    hoveredChartItem.kind === 'receivable'
                      ? '#10b981'
                      : hoveredChartItem.kind === 'payable'
                      ? '#ef4444'
                      : '#3b82f6',
                }}
              >
                {formatBRL(hoveredChartItem.value)}
              </div>
            </div>
          )}

          {/* Card Flutuante Fixado com Drill-Down Clicável (Pinned Tooltip) */}
          {pinnedTooltipData && pinnedTooltipPos && (
            <div
              className="absolute z-[120] pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
              style={{
                left: Math.min(
                  typeof window !== 'undefined' ? window.innerWidth - 440 : 600,
                  Math.max(220, pinnedTooltipPos.x)
                ),
                top: 15,
                transform: 'translateX(-50%)',
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <CustomTooltip
                active={true}
                payload={[{ payload: pinnedTooltipData }]}
                label={pinnedTooltipData.displayDate}
                isInteractive={true}
                activeCategory={pinnedFilterCategory}
                activeUnit={pinnedFilterUnit}
                onFilterCategory={handlePinFilterCategory}
                onFilterUnit={handlePinFilterUnit}
                onClose={handleClosePinnedTooltip}
              />
            </div>
          )}
        </div>
      )}

      {/* Se houver algum filtro fixado (data, categoria, unidade) via clique no gráfico, exibe barra de chips compacta */}
      {(pinnedFilterDate || pinnedFilterCategory || pinnedFilterUnit) && (
        <div className="px-4 py-1.5 bg-blue-50/80 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/50 flex items-center gap-2 flex-wrap shrink-0 text-xs">
          <span className="font-bold text-blue-900 dark:text-blue-200 text-[11px] uppercase">Filtro Ativo:</span>
          {pinnedFilterDate && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 text-xs font-semibold shadow-xs">
              <span>📅 {formatFullDateBr(pinnedFilterDate)}</span>
              <button
                onClick={handleClosePinnedTooltip}
                className="hover:text-red-500 ml-1 text-sm font-bold leading-none"
                title="Limpar filtro de data"
              >
                ×
              </button>
            </div>
          )}
          {pinnedFilterCategory && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 text-xs font-semibold shadow-xs">
              <span>🏷️ {pinnedFilterCategory}</span>
              <button
                onClick={() => setPinnedFilterCategory(null)}
                className="hover:text-red-500 ml-1 text-sm font-bold leading-none"
                title="Limpar filtro de categoria"
              >
                ×
              </button>
            </div>
          )}
          {pinnedFilterUnit && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 text-xs font-semibold shadow-xs">
              <span>🏢 {pinnedFilterUnit}</span>
              <button
                onClick={() => setPinnedFilterUnit(null)}
                className="hover:text-red-500 ml-1 text-sm font-bold leading-none"
                title="Limpar filtro de unidade"
              >
                ×
              </button>
            </div>
          )}
          <button
            onClick={handleClosePinnedTooltip}
            className="text-[11px] text-red-500 hover:text-red-700 dark:hover:text-red-400 underline font-bold ml-auto"
          >
            Limpar Filtro
          </button>
        </div>
      )}

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
          {/* Header com Botão (+), Contador e Ações */}
          <div className="p-2.5 bg-red-100/80 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-sm">arrow_downward</span>
              <h3 className="font-bold text-red-700 dark:text-red-400 uppercase text-xs tracking-wider">
                {pinnedFilterDate
                  ? `DESPESAS (${formatFullDateBr(pinnedFilterDate)})`
                  : 'CONTAS A PAGAR / DESPESAS'}
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
              {payablesList.length} Despesas
            </div>
          </div>

          {/* Tabela de Despesas com Edição Inline e Multi-Select */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="bg-white/90 dark:bg-[#162f27] uppercase text-[10px] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <tr>
                  <th className="p-2 text-center w-8">
                    <input
                      type="checkbox"
                      checked={
                        payablesList.length > 0 &&
                        payablesList.every((p) => selectedTableItemIds.has(p.id))
                      }
                      onChange={() => handleSelectAllTable(payablesList)}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500 accent-red-600 cursor-pointer"
                      title="Selecionar todas as despesas exibidas"
                    />
                  </th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'bank', 'BANCO')}</th>
                  <th className="p-2">DATA / ADIAR</th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'entity', 'DESTINO')}</th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'method', 'MÉTODO')}</th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'description', 'DESCRIÇÃO/OBS')}</th>
                  <th className="p-2 text-right">VALOR</th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'unit', 'UNIDADE')}</th>
                  <th className="p-2">{renderHeaderWithFilter('payable', 'category', 'CLASSIFICAÇÃO')}</th>
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
                    const isSelected = selectedTableItemIds.has(tx.id);

                    return (
                      <tr
                        key={tx.id}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-red-100/80 dark:bg-red-950/60 font-medium'
                            : isSimulated
                            ? 'bg-amber-100/60 dark:bg-amber-950/40 font-bold'
                            : isReopen
                            ? 'bg-blue-100/60 dark:bg-blue-950/40 font-bold'
                            : 'hover:bg-red-100/40 dark:hover:bg-red-900/10'
                        }`}
                      >
                        {/* Checkbox de Seleção em Lote */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectTableItem(tx.id)}
                            className="rounded cursor-pointer text-red-600 focus:ring-red-500 accent-red-600"
                            title="Selecionar para operações em lote"
                          />
                        </td>

                        {/* Banco (Dropdown Editável Inline) */}
                        <td className="p-1">
                          <select
                            value={tx.bankName}
                            onChange={(e) => updateTransaction(tx.id, { bankName: e.target.value })}
                            className="text-[11px] p-1 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 bg-transparent text-gray-700 dark:text-gray-200 truncate max-w-[85px]"
                          >
                            {bankOptions.map((b) => (
                              <option key={b.id} value={b.name}>
                                {b.name}
                              </option>
                            ))}
                          </select>
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

                        {/* Unidade (Dropdown Editável Inline) */}
                        <td className="p-1">
                          <select
                            value={tx.unit}
                            onChange={(e) => updateTransaction(tx.id, { unit: e.target.value })}
                            className="text-[11px] p-1 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 bg-transparent text-gray-700 dark:text-gray-200 truncate max-w-[80px]"
                          >
                            {unitOptions.map((u) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Categoria / Classificação (Dropdown Editável Inline) */}
                        <td className="p-1">
                          <select
                            value={tx.category}
                            onChange={(e) => updateTransaction(tx.id, { category: e.target.value })}
                            className="text-[11px] p-1 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 bg-transparent font-medium text-purple-700 dark:text-purple-300 truncate max-w-[100px]"
                          >
                            {categoryOptions.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Ação: Simular / Excluir */}
                        <td className="p-2 text-center">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleSimulation(tx.id)}
                              className={`p-0.5 rounded transition-colors ${
                                isSimulated ? 'text-amber-500' : 'text-gray-400 hover:text-[#11d493]'
                              }`}
                              title="Simular baixa/reabertura imediata"
                            >
                              <span className="material-symbols-outlined text-[14px]">tune</span>
                            </button>
                            <button
                              onClick={() => deleteTransaction(tx.id)}
                              className="text-gray-400 hover:text-red-500"
                              title="Mover para Lixeira"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </div>
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
          {/* Header com Botão (+), Contador e Ações */}
          <div className="p-2.5 bg-emerald-100/80 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-sm">arrow_upward</span>
              <h3 className="font-bold text-emerald-700 dark:text-emerald-400 uppercase text-xs tracking-wider">
                {pinnedFilterDate
                  ? `RECEITAS (${formatFullDateBr(pinnedFilterDate)})`
                  : 'CONTAS A RECEBER / RECEITAS'}
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
              {receivablesList.length} Receitas
            </div>
          </div>

          {/* Tabela de Receitas com Edição Inline e Multi-Select */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="bg-white/90 dark:bg-[#162f27] uppercase text-[10px] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <tr>
                  <th className="p-2 text-center w-8">
                    <input
                      type="checkbox"
                      checked={
                        receivablesList.length > 0 &&
                        receivablesList.every((r) => selectedTableItemIds.has(r.id))
                      }
                      onChange={() => handleSelectAllTable(receivablesList)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                      title="Selecionar todas as receitas exibidas"
                    />
                  </th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'bank', 'BANCO')}</th>
                  <th className="p-2">DATA / ADIAR</th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'entity', 'ORIGEM')}</th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'method', 'MÉTODO')}</th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'description', 'DESCRIÇÃO/OBS')}</th>
                  <th className="p-2 text-right">VALOR</th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'unit', 'UNIDADE')}</th>
                  <th className="p-2">{renderHeaderWithFilter('receivable', 'category', 'CLASSIFICAÇÃO')}</th>
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
                    const isSelected = selectedTableItemIds.has(tx.id);

                    return (
                      <tr
                        key={tx.id}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-emerald-100/80 dark:bg-emerald-950/60 font-medium'
                            : isSimulated
                            ? 'bg-amber-100/60 dark:bg-amber-950/40 font-bold'
                            : isReopen
                            ? 'bg-blue-100/60 dark:bg-blue-950/40 font-bold'
                            : 'hover:bg-emerald-100/40 dark:hover:bg-emerald-900/10'
                        }`}
                      >
                        {/* Checkbox de Seleção em Lote */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectTableItem(tx.id)}
                            className="rounded cursor-pointer text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                            title="Selecionar para operações em lote"
                          />
                        </td>

                        {/* Banco (Dropdown Editável Inline) */}
                        <td className="p-1">
                          <select
                            value={tx.bankName}
                            onChange={(e) => updateTransaction(tx.id, { bankName: e.target.value })}
                            className="text-[11px] p-1 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 bg-transparent text-gray-700 dark:text-gray-200 truncate max-w-[85px]"
                          >
                            {bankOptions.map((b) => (
                              <option key={b.id} value={b.name}>
                                {b.name}
                              </option>
                            ))}
                          </select>
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

                        <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          + {formatBRL(tx.amount)}
                        </td>

                        {/* Unidade (Dropdown Editável Inline) */}
                        <td className="p-1">
                          <select
                            value={tx.unit}
                            onChange={(e) => updateTransaction(tx.id, { unit: e.target.value })}
                            className="text-[11px] p-1 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 bg-transparent text-gray-700 dark:text-gray-200 truncate max-w-[80px]"
                          >
                            {unitOptions.map((u) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Categoria / Classificação (Dropdown Editável Inline) */}
                        <td className="p-1">
                          <select
                            value={tx.category}
                            onChange={(e) => updateTransaction(tx.id, { category: e.target.value })}
                            className="text-[11px] p-1 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 bg-transparent font-medium text-purple-700 dark:text-purple-300 truncate max-w-[100px]"
                          >
                            {categoryOptions.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Ação: Simular / Excluir */}
                        <td className="p-2 text-center">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleSimulation(tx.id)}
                              className={`p-0.5 rounded transition-colors ${
                                isSimulated ? 'text-amber-500' : 'text-gray-400 hover:text-[#11d493]'
                              }`}
                              title="Simular recebimento imediato"
                            >
                              <span className="material-symbols-outlined text-[14px]">tune</span>
                            </button>
                            <button
                              onClick={() => deleteTransaction(tx.id)}
                              className="text-gray-400 hover:text-red-500"
                              title="Mover para Lixeira"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </div>
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

      {/* 6. Barra Flutuante de Ações em Lote (Quando itens estão selecionados) */}
      {selectedTableItemIds.size > 0 && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-700 animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#11d493]" />
            <span className="text-xs font-bold">
              {selectedTableItemIds.size} itens selecionados
            </span>
          </div>

          <div className="h-4 w-px bg-gray-700 mx-1"></div>

          <button
            onClick={() => handleBulkMoveDate(1)}
            className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold transition-all"
            title="Adiar vencimento de todos em +1 dia"
          >
            Adiar +1d
          </button>
          <button
            onClick={() => handleBulkMoveDate(7)}
            className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold transition-all"
            title="Adiar vencimento de todos em +7 dias"
          >
            Adiar +7d
          </button>
          <button
            onClick={() => handleBulkMoveDate(30)}
            className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold transition-all"
            title="Adiar vencimento de todos em +30 dias"
          >
            Adiar +30d
          </button>

          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold transition-all"
          >
            <span className="material-symbols-outlined text-xs">delete</span>
            Mover para Lixeira
          </button>

          <button
            onClick={() => setSelectedTableItemIds(new Set())}
            className="text-[11px] text-gray-400 hover:text-white underline ml-1"
          >
            Desmarcar
          </button>
        </div>
      )}

      {/* 7. Barra Flutuante de Simulação de Baixa / Reabertura */}
      {hasSimulationChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-950 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-gray-700 animate-in fade-in slide-in-from-bottom duration-200">
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

      {/* Modal 1: Lixeira de Contas Excluídas */}
      {showTrashModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
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
                        {dt.entity} • {formatBRL(dt.amount)} • {dt.displayDate} • {dt.bankName}
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

      {/* Modal 2: Upload de Extrato Bancário (Passado) */}
      <BankUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        companies={[empresaNome || 'Empresa Matriz']}
        bankAccounts={bankOptions.map((b) => b.name)}
        onImportSuccess={(newTxs) => {
          setAllTransactions((prev) => [...newTxs, ...prev]);
          alert(`${newTxs.length} transações de extrato foram importadas para o Passado com sucesso!`);
        }}
      />

      {/* Modal 3: Classificação Inteligente & Regras Automáticas */}
      <ClassifyTransactionsModal
        isOpen={showClassifyModal}
        onClose={() => setShowClassifyModal(false)}
        transactions={allTransactions}
        categories={categoryOptions.map((c) => c.name)}
        units={unitOptions.map((u) => u.name)}
        onApplyClassification={(updated) => {
          setAllTransactions(updated);
        }}
      />

      {/* Modal 4: Robô IA de Padrões Bancários */}
      <BankPatternChatbotModal
        isOpen={showBotModal}
        onClose={() => setShowBotModal(false)}
        onAddRule={(newRule: ClassificationRule) => {
          // Salva no localStorage e aplica nas transações
          const saved = localStorage.getItem('bt_finance_rules');
          let currentRules: ClassificationRule[] = [];
          if (saved) {
            try {
              currentRules = JSON.parse(saved);
            } catch {
              // ignore
            }
          }
          const updatedRules = [...currentRules, newRule];
          localStorage.setItem('bt_finance_rules', JSON.stringify(updatedRules));

          // Aplica na lista atual
          setAllTransactions((prev) =>
            prev.map((t) => {
              if (
                `${t.description} ${t.entity}`.toUpperCase().includes(newRule.keyword)
              ) {
                return { ...t, category: newRule.category, unit: newRule.unit };
              }
              return t;
            })
          );
        }}
      />

      {/* Modal 5: Rápido de Nova Conta a Pagar */}
      {showAddPayable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
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
                  className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700 text-gray-900 dark:text-white"
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
                    className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Vencimento</label>
                  <input
                    required
                    type="date"
                    defaultValue={todayISO}
                    className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Categoria</label>
                <select className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700 text-gray-900 dark:text-white">
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
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

      {/* Modal 6: Rápido de Nova Conta a Receber */}
      {showAddReceivable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
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
                  className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700 text-gray-900 dark:text-white"
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
                    className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Vencimento</label>
                  <input
                    required
                    type="date"
                    defaultValue={todayISO}
                    className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Categoria</label>
                <select className="w-full text-xs p-2.5 rounded-lg border dark:bg-[#10221c] dark:border-gray-700 text-gray-900 dark:text-white">
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
