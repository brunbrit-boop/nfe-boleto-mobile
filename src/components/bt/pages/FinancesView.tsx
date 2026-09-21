import React, { useState, useMemo } from 'react';
import type { BlingContaPagar, BlingContaReceber } from '../../../types';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface FinancialItem {
  id: string;
  date: string;
  description: string;
  category: string;
  entity: string;
  amount: number;
  type: 'payable' | 'receivable';
  status: 'open' | 'paid';
  numeroDocumento?: string;
  vencimentoFormatado?: string;
  originalContaReceber?: BlingContaReceber;
}

interface FinancesViewProps {
  contasPagar?: BlingContaPagar[];
  contasReceber?: BlingContaReceber[];
  onRefreshBling?: () => void;
  carregando?: boolean;
  onViewBoletoReceber?: (conta: BlingContaReceber) => void;
}

export const FinancesView: React.FC<FinancesViewProps> = ({
  contasPagar = [],
  contasReceber = [],
  onRefreshBling,
  carregando = false,
  onViewBoletoReceber,
}) => {
  const [tableMode, setTableMode] = useState<'forecast' | 'realized' | 'all'>('forecast');
  const [zoomDays, setZoomDays] = useState<number>(30);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddPayable, setShowAddPayable] = useState(false);
  const [showAddReceivable, setShowAddReceivable] = useState(false);

  // Mapeia os dados reais do Bling para a tabela financeira
  const items: FinancialItem[] = useMemo(() => {
    const list: FinancialItem[] = [];

    contasReceber.forEach((cr) => {
      list.push({
        id: `rec-${cr.id}`,
        date: cr.vencimento || cr.dataEmissao || '',
        description: cr.historico || `Recebimento Ref #${cr.numeroDocumento || cr.id}`,
        category: cr.categoria || 'Vendas & Receitas',
        entity: cr.contato?.nome || 'Cliente Bling',
        amount: Number(cr.valor) || 0,
        type: 'receivable',
        status: cr.situacao === 2 ? 'paid' : 'open',
        numeroDocumento: cr.numeroDocumento,
        vencimentoFormatado: cr.vencimentoFormatado,
        originalContaReceber: cr,
      });
    });

    contasPagar.forEach((cp) => {
      list.push({
        id: `pay-${cp.id}`,
        date: cp.vencimento || cp.dataEmissao || '',
        description: cp.historico || `Pagamento Ref #${cp.numeroDocumento || cp.id}`,
        category: cp.categoria || 'Operacional / Compras',
        entity: cp.contato?.nome || 'Fornecedor Bling',
        amount: Number(cp.valor) || 0,
        type: 'payable',
        status: cp.situacao === 2 ? 'paid' : 'open',
        numeroDocumento: cp.numeroDocumento,
        vencimentoFormatado: cp.vencimentoFormatado,
      });
    });

    // Se o Bling estiver vazio, exibe dados modelo do BT Business para demonstração completa
    if (list.length === 0) {
      const today = new Date();
      const fmt = (offset: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        return d.toISOString().split('T')[0];
      };

      return [
        { id: 'm-1', date: fmt(-5), description: 'Fornecedor Aços Inox', category: 'Matéria Prima', entity: 'Eginox Indústria', amount: 4200.0, type: 'payable', status: 'paid' },
        { id: 'm-2', date: fmt(-2), description: 'Venda Atacado Faturada', category: 'Vendas', entity: 'Mercado Bom Preço', amount: 6800.0, type: 'receivable', status: 'paid' },
        { id: 'm-3', date: fmt(0), description: 'Internet Fibra Óptica', category: 'Utilidades', entity: 'Vivo Empresas', amount: 280.0, type: 'payable', status: 'open' },
        { id: 'm-4', date: fmt(0), description: 'Recebimento PIX Balcão', category: 'Vendas', entity: 'Cliente Balcão', amount: 1450.0, type: 'receivable', status: 'open' },
        { id: 'm-5', date: fmt(3), description: 'Recebimento Pedido #2041', category: 'Vendas', entity: 'Distribuidora Silva', amount: 4800.0, type: 'receivable', status: 'open' },
        { id: 'm-6', date: fmt(5), description: 'Adiantamento Fornecedor', category: 'Operacional', entity: 'Ambev / Bebidas', amount: 2300.0, type: 'payable', status: 'open' },
      ];
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [contasPagar, contasReceber]);

  // Filtros aplicados
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filtro por modo de tabela (previsão / realizado / todos)
      if (tableMode === 'forecast' && item.status !== 'open') return false;
      if (tableMode === 'realized' && item.status !== 'paid') return false;

      // Filtro por categoria
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

      // Filtro por busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.description.toLowerCase().includes(term) ||
          item.entity.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term) ||
          String(item.amount).includes(term)
        );
      }

      return true;
    });
  }, [items, tableMode, selectedCategory, searchTerm]);

  // Dados agrupados para o Gráfico de Fluxo de Caixa do BT Business
  const chartData = useMemo(() => {
    const mapa = new Map<string, { date: string; receitas: number; despesas: number; saldo: number }>();
    const hoje = new Date();

    for (let i = -10; i <= zoomDays; i += 3) {
      const d = new Date(hoje);
      d.setDate(d.getDate() + i);
      const chave = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      mapa.set(chave, { date: chave, receitas: 0, despesas: 0, saldo: 0 });
    }

    items.forEach((it) => {
      if (!it.date) return;
      const parts = it.date.split('-');
      if (parts.length >= 3) {
        const chave = `${parts[2]}/${parts[1]}`;
        if (mapa.has(chave)) {
          const entry = mapa.get(chave)!;
          if (it.type === 'receivable') entry.receitas += it.amount;
          else entry.despesas += it.amount;
          entry.saldo = entry.receitas - entry.despesas;
        }
      }
    });

    return Array.from(mapa.values());
  }, [items, zoomDays]);

  // Cálculos de totais
  const totalReceitas = filteredItems
    .filter((i) => i.type === 'receivable')
    .reduce((acc, i) => acc + i.amount, 0);

  const totalDespesas = filteredItems
    .filter((i) => i.type === 'payable')
    .reduce((acc, i) => acc + i.amount, 0);

  const saldoPeriodo = totalReceitas - totalDespesas;

  const formatBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const categoriesList = Array.from(new Set(items.map((i) => i.category)));

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] overflow-y-auto font-['Manrope',sans-serif]">
      {/* Top Header idêntico ao BT Business Finances */}
      <div className="p-6 md:p-8 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 text-[32px]">
                account_balance
              </span>
              Financeiro
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Gestão e conciliação de fluxo de caixa (Alimentado pelo Bling ERP)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onRefreshBling && (
              <button
                onClick={onRefreshBling}
                disabled={carregando}
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-800 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${carregando ? 'animate-spin' : ''}`}>
                  sync
                </span>
                Atualizar Bling
              </button>
            )}

            <button
              onClick={() => setShowAddReceivable(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#11d493] text-gray-950 rounded-lg text-xs font-bold hover:bg-[#0fc487] transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              + Receita
            </button>

            <button
              onClick={() => setShowAddPayable(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">remove</span>
              + Despesa
            </button>
          </div>
        </div>

        {/* Barra de Filtros e Zoom Presets (Idêntico ao BT Business original) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-800 shadow-sm">
          {/* Abas Previsão vs Realizado vs Todos */}
          <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 text-xs">
            <button
              onClick={() => setTableMode('forecast')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                tableMode === 'forecast'
                  ? 'bg-white dark:bg-[#1f4236] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              Previsão (Aberto)
            </button>
            <button
              onClick={() => setTableMode('realized')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                tableMode === 'realized'
                  ? 'bg-white dark:bg-[#1f4236] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              Realizado (Pago)
            </button>
            <button
              onClick={() => setTableMode('all')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                tableMode === 'all'
                  ? 'bg-white dark:bg-[#1f4236] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              Todos os Títulos
            </button>
          </div>

          {/* Zoom Presets: 7D, 15D, 30D, 60D */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold uppercase">Zoom:</span>
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 text-xs font-bold">
              {[7, 15, 30, 60].map((days) => (
                <button
                  key={days}
                  onClick={() => setZoomDays(days)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    zoomDays === days
                      ? 'bg-[#11d493] text-gray-950 shadow-sm'
                      : 'text-gray-500 hover:text-gray-200'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>

          {/* Busca e Categoria */}
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por descrição ou entidade..."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#11d493]"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">Todas</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Gráfico Recharts do BT Business */}
      <div className="px-6 md:px-8 mb-6">
        <div className="bg-white dark:bg-[#162f27] rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#11d493] text-[20px]">
                monitoring
              </span>
              Gráfico de Fluxo de Caixa Dinâmico
            </h3>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-[#11d493]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#11d493]" />
                Receitas: {formatBRL(totalReceitas)}
              </span>
              <span className="flex items-center gap-1.5 text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Despesas: {formatBRL(totalDespesas)}
              </span>
              <span className="flex items-center gap-1.5 text-blue-500 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Saldo: {formatBRL(saldoPeriodo)}
              </span>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#25473b" opacity={0.25} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#10221c',
                    borderColor: '#1e4236',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(value: any) => [formatBRL(Number(value) || 0), '']}
                />
                <Legend wrapperStyle={{ display: 'none' }} />
                <Bar dataKey="receitas" name="Receitas" fill="#11d493" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="despesas" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo"
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  dot={{ fill: '#0ea5e9', r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabela de Transações e Títulos */}
      <div className="px-6 md:px-8 pb-8 flex-1">
        <div className="bg-white dark:bg-[#162f27] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
              {filteredItems.length} Registros Encontrados
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/50 uppercase font-bold text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3">Descrição / Título</th>
                  <th className="px-5 py-3">Entidade (Cliente/Fornecedor)</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredItems.map((it) => {
                  const isReceber = it.type === 'receivable';
                  const isPaid = it.status === 'paid';

                  return (
                    <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-[11px]">
                        {it.vencimentoFormatado || it.date}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white">
                        {it.description}
                        <div className="flex items-center gap-2 mt-0.5">
                          {it.numeroDocumento && (
                            <span className="text-[10px] font-normal text-gray-400">
                              Doc: {it.numeroDocumento}
                            </span>
                          )}
                          {isReceber && it.originalContaReceber && onViewBoletoReceber && (
                            <button
                              onClick={() => onViewBoletoReceber(it.originalContaReceber!)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-[#11d493]/15 text-[#11d493] hover:bg-[#11d493]/25 font-bold inline-flex items-center gap-1"
                              title="Visualizar Boleto / PIX do Bling"
                            >
                              <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                              Boleto
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300 font-medium">
                        {it.entity}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {it.category}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isPaid ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          {isPaid ? 'Liquidado' : 'Em Aberto'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-sm">
                        <span className={isReceber ? 'text-[#11d493]' : 'text-rose-500'}>
                          {isReceber ? '+' : '-'} {formatBRL(it.amount)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Simples Nova Despesa */}
      {showAddPayable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nova Conta a Pagar</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Ao adicionar, a despesa poderá ser sincronizada com o Bling ERP da empresa.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowAddPayable(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Simples Nova Receita */}
      {showAddReceivable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nova Conta a Receber</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Ao adicionar, o recebimento poderá gerar boleto Febraban / Pix automaticamente.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowAddReceivable(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
