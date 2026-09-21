import React, { useState } from 'react';
import { ArrowDownCircle, CheckCircle2, Clock, AlertTriangle, RefreshCw, Search, Calendar } from 'lucide-react';
import type { BlingContaPagar, ResumoFinanceiro } from '../types';
import { formatCurrency } from '../utils/financeEngine';

interface ContasPagarTabProps {
  contas: BlingContaPagar[];
  resumo: ResumoFinanceiro;
  isLoading: boolean;
  isLive: boolean;
  onRefresh: () => void;
}

export const ContasPagarTab: React.FC<ContasPagarTabProps> = ({
  contas,
  resumo,
  isLoading,
  isLive,
  onRefresh,
}) => {
  const [filterSituacao, setFilterSituacao] = useState<'todas' | 'aberto' | 'pagas' | 'vencidas'>('aberto');
  const [searchTerm, setSearchTerm] = useState('');

  const hojeStr = new Date().toISOString().slice(0, 10);

  const contasFiltradas = contas.filter((c) => {
    // Busca
    const matchSearch =
      c.contato.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.numeroDocumento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.historico && c.historico.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchSearch) return false;

    // Filtro de situação
    if (filterSituacao === 'aberto') return c.situacao === 1 && c.vencimento >= hojeStr;
    if (filterSituacao === 'pagas') return c.situacao === 2;
    if (filterSituacao === 'vencidas') return c.situacao === 1 && c.vencimento < hojeStr;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-xl mx-auto w-full pb-36">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Contas a Pagar</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {contas.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Despesas e saídas extraídas do Bling ERP
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLive ? 'Ao Vivo' : 'Sincronizar'}</span>
        </button>
      </div>

      {/* Cards de Resumo Financeiro no Topo */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-card">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>A Vencer</span>
          </div>
          <span className="text-sm sm:text-base font-black text-slate-900 block leading-tight">
            {formatCurrency(resumo.totalAberto)}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-rose-200/90 shadow-card bg-gradient-to-br from-white to-rose-50/40">
          <div className="flex items-center gap-1.5 text-rose-600 text-[11px] font-semibold mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Vencidas</span>
          </div>
          <span className="text-sm sm:text-base font-black text-rose-600 block leading-tight">
            {formatCurrency(resumo.totalVencido)}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-emerald-200/90 shadow-card bg-gradient-to-br from-white to-emerald-50/40">
          <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-semibold mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Pagas</span>
          </div>
          <span className="text-sm sm:text-base font-black text-emerald-700 block leading-tight">
            {formatCurrency(resumo.totalLiquidado)}
          </span>
        </div>
      </div>

      {/* Busca e Filtro de Status */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Fornecedor ou Nº Documento..."
            className="w-full bg-white text-slate-800 placeholder-slate-400 text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setFilterSituacao('aberto')}
            className={`px-3 py-1 rounded-full font-medium transition shrink-0 ${
              filterSituacao === 'aberto'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            A Vencer
          </button>
          <button
            onClick={() => setFilterSituacao('vencidas')}
            className={`px-3 py-1 rounded-full font-medium transition shrink-0 ${
              filterSituacao === 'vencidas'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Vencidas
          </button>
          <button
            onClick={() => setFilterSituacao('pagas')}
            className={`px-3 py-1 rounded-full font-medium transition shrink-0 ${
              filterSituacao === 'pagas'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Pagas
          </button>
          <button
            onClick={() => setFilterSituacao('todas')}
            className={`px-3 py-1 rounded-full font-medium transition shrink-0 ${
              filterSituacao === 'todas'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Todas ({contas.length})
          </button>
        </div>
      </div>

      {/* Lista de Contas a Pagar */}
      <div className="space-y-2.5">
        {contasFiltradas.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
            <ArrowDownCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Nenhuma conta encontrada</p>
            <p className="text-xs text-slate-400 mt-1">
              Todas as contas deste filtro estão em dia ou foram quitadas.
            </p>
          </div>
        ) : (
          contasFiltradas.map((conta) => {
            const isVencida = conta.situacao === 1 && conta.vencimento < hojeStr;
            const isPaga = conta.situacao === 2;

            return (
              <div
                key={conta.id}
                className={`bg-white rounded-2xl p-4 border shadow-card hover:shadow-card-hover transition space-y-2.5 ${
                  isVencida ? 'border-rose-300/80 bg-rose-50/20' : 'border-slate-200/90'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                      {conta.numeroDocumento}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {conta.contato.nome}
                    </h3>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isPaga
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isVencida
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {isPaga ? 'Pago' : isVencida ? 'Vencida' : 'Em Aberto'}
                  </span>
                </div>

                {/* Descrição / Categoria */}
                {conta.historico && (
                  <p className="text-xs text-slate-600 line-clamp-1">
                    {conta.historico}
                  </p>
                )}

                {/* Vencimento e Valor */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Vencimento: <strong className={isVencida ? 'text-rose-600 font-bold' : 'text-slate-800'}>{conta.vencimentoFormatado}</strong>
                    </span>
                  </div>

                  <span className="text-sm font-black text-slate-900 tracking-tight">
                    {conta.valorFormatado}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
