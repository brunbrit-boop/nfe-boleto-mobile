import React from 'react';
import type { BlingContaPagar, BlingContaReceber, BlingCliente } from '../../types';
import {
  calcularIndicadoresBling,
  gerarSerieFluxoCaixa,
  obterItensUrgentes,
  agruparPorCategoria,
} from '../../utils/blingDataAdapter';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  Calendar,
  Users,
} from 'lucide-react';
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

interface BtDashboardViewProps {
  contasPagar: BlingContaPagar[];
  contasReceber: BlingContaReceber[];
  clientes: BlingCliente[];
  onNavigateToTab: (tab: 'pagar' | 'receber' | 'conciliacao' | 'clientes' | 'robo') => void;
}

export const BtDashboardView: React.FC<BtDashboardViewProps> = ({
  contasPagar,
  contasReceber,
  clientes,
  onNavigateToTab,
}) => {
  const indicadores = calcularIndicadoresBling(contasPagar, contasReceber);
  const dadosGrafico = gerarSerieFluxoCaixa(contasPagar, contasReceber);
  const itensUrgentes = obterItensUrgentes(contasPagar, contasReceber);
  const categoriasDespesas = agruparPorCategoria(contasPagar);

  const formatBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6 pb-12">
      {/* Linha 1: Cards de Indicadores Principais (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Saldo Projetado */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Saldo Projetado
            </span>
            <div className={`p-2 rounded-xl ${indicadores.saldoTotalProjetado >= 0 ? 'bg-emerald-500/10 text-[#11d493]' : 'bg-rose-500/10 text-rose-500'}`}>
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-extrabold tracking-tight ${indicadores.saldoTotalProjetado >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatBRL(indicadores.saldoTotalProjetado)}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span>(Receber em aberto − Pagar em aberto)</span>
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1a382e] flex items-center justify-between text-xs">
            <span className="text-slate-500">Realizado no período:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {formatBRL(indicadores.saldoOperacionalRealizado)}
            </span>
          </div>
        </div>

        {/* Card 2: Contas a Receber */}
        <div
          onClick={() => onNavigateToTab('receber')}
          className="p-5 rounded-2xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] shadow-sm hover:border-[#11d493]/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              A Receber (Bling)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-[#11d493] group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {formatBRL(indicadores.totalReceberAberto)}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {indicadores.qtdReceberAberto} títulos aguardando liquidação
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1a382e] flex items-center justify-between text-xs">
            <span className="text-slate-500">Vencidos:</span>
            <span className={`font-semibold ${indicadores.totalReceberVencido > 0 ? 'text-rose-500' : 'text-slate-500'}`}>
              {formatBRL(indicadores.totalReceberVencido)}
            </span>
          </div>
        </div>

        {/* Card 3: Contas a Pagar */}
        <div
          onClick={() => onNavigateToTab('pagar')}
          className="p-5 rounded-2xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] shadow-sm hover:border-rose-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              A Pagar (Bling)
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {formatBRL(indicadores.totalPagarAberto)}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {indicadores.qtdPagarAberto} despesas cadastradas em aberto
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1a382e] flex items-center justify-between text-xs">
            <span className="text-slate-500">Vencidas:</span>
            <span className={`font-semibold ${indicadores.totalPagarVencido > 0 ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
              {formatBRL(indicadores.totalPagarVencido)}
            </span>
          </div>
        </div>

        {/* Card 4: Clientes e Contatos */}
        <div
          onClick={() => onNavigateToTab('clientes')}
          className="p-5 rounded-2xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] shadow-sm hover:border-blue-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Clientes Conectados
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {clientes.length}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Parceiros comerciais no Bling
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1a382e] flex items-center justify-between text-xs">
            <span className="text-slate-500">Acessar lista:</span>
            <span className="font-semibold text-blue-500 flex items-center gap-0.5">
              Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Linha 2: Gráfico de Fluxo de Caixa Recharts */}
      <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#11d493]" />
              Fluxo de Caixa & Evolução Financeira (Bling ERP)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparativo consolidado de Receitas (Receber) vs. Despesas (Pagar)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-[#11d493] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#11d493]" /> Receitas
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Despesas
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Saldo Líquido
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosGrafico} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#25473b" opacity={0.3} />
              <XAxis dataKey="periodo" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#10221c',
                  borderColor: '#1e4236',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(value: any) => [formatBRL(Number(value) || 0), '']}
              />
              <Legend wrapperStyle={{ display: 'none' }} />
              <Bar dataKey="receitas" name="Receitas" fill="#11d493" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="despesas" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Line
                type="monotone"
                dataKey="saldo"
                name="Saldo Líquido"
                stroke="#0ea5e9"
                strokeWidth={3}
                dot={{ fill: '#0ea5e9', r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Linha 3: Contas Urgentes e Distribuição por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel de Contas com Vencimento Próximo ou Atrasadas */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Avisos de Vencimento & Cobrança Prioritária
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Títulos do Bling vencendo nos próximos 7 dias ou já em atraso
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
              {itensUrgentes.length} pendentes
            </span>
          </div>

          {itensUrgentes.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-[#162f27]/50 border border-dashed border-slate-200 dark:border-[#1e4236]">
              <CheckCircle2 className="w-8 h-8 text-[#11d493] mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Nenhuma conta vencida ou urgente nos próximos 7 dias!
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Seu fluxo financeiro do Bling está em dia.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {itensUrgentes.slice(0, 6).map((item) => {
                const isAtrasado = item.diasAtraso > 0;
                const isHoje = item.diasAtraso === 0;
                const isReceber = item.tipo === 'receber';

                return (
                  <div
                    key={`${item.tipo}-${item.id}`}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#162f27]/60 border border-slate-200/80 dark:border-[#1e4236] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isReceber ? 'bg-emerald-500/10 text-[#11d493]' : 'bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        {isReceber ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isReceber
                                ? 'bg-emerald-500/20 text-[#11d493]'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {isReceber ? 'Receber' : 'Pagar'}
                          </span>
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {item.contato}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Vencimento: {item.vencimentoFormatado}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {item.valorFormatado}
                      </span>
                      <div>
                        {isAtrasado && (
                          <span className="text-[10px] font-bold text-rose-500">
                            Atrasado ({item.diasAtraso}d)
                          </span>
                        )}
                        {isHoje && (
                          <span className="text-[10px] font-bold text-amber-500 animate-pulse">
                            Vence Hoje!
                          </span>
                        )}
                        {!isAtrasado && !isHoje && (
                          <span className="text-[10px] text-slate-400">
                            Em {Math.abs(item.diasAtraso)} dias
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Distribuição por Categorias */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Categorias de Despesas
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Principais centros de custo do Bling
          </p>

          {categoriasDespesas.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Nenhuma despesa classificada encontrada.
            </div>
          ) : (
            <div className="space-y-3.5">
              {categoriasDespesas.map((cat) => (
                <div key={cat.categoria}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {cat.categoria}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatBRL(cat.total)} ({cat.porcentagem}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#162f27] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${cat.porcentagem}%`, backgroundColor: cat.cor }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
