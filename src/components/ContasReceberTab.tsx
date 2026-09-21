import React, { useState } from 'react';
import { ArrowUpCircle, CheckCircle2, Clock, AlertTriangle, RefreshCw, Search, Calendar, Copy, Check, Barcode, Share2 } from 'lucide-react';
import type { BlingContaReceber, ResumoFinanceiro } from '../types';
import { formatCurrency } from '../utils/financeEngine';
import { speechEngine } from '../utils/speechEngine';

interface ContasReceberTabProps {
  contas: BlingContaReceber[];
  resumo: ResumoFinanceiro;
  isLoading: boolean;
  isLive: boolean;
  onRefresh: () => void;
  onViewBoletoReceber: (conta: BlingContaReceber) => void;
}

export const ContasReceberTab: React.FC<ContasReceberTabProps> = ({
  contas,
  resumo,
  isLoading,
  isLive,
  onRefresh,
  onViewBoletoReceber,
}) => {
  const [filterSituacao, setFilterSituacao] = useState<'todas' | 'aberto' | 'recebidas' | 'atrasadas'>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedLinhaId, setCopiedLinhaId] = useState<number | null>(null);

  const hojeStr = new Date().toISOString().slice(0, 10);

  const contasFiltradas = contas.filter((c) => {
    const matchSearch =
      c.contato.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.numeroDocumento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.historico && c.historico.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchSearch) return false;

    if (filterSituacao === 'aberto') return (c.situacao === 1 || c.situacao === 3) && c.vencimento >= hojeStr;
    if (filterSituacao === 'recebidas') return c.situacao === 2;
    if (filterSituacao === 'atrasadas') return (c.situacao === 1 || c.situacao === 3) && c.vencimento < hojeStr;
    return true;
  });

  const handleCopyLinha = (linha: string, id: number) => {
    navigator.clipboard.writeText(linha);
    setCopiedLinhaId(id);
    speechEngine.playBeep('start');
    setTimeout(() => setCopiedLinhaId(null), 2000);
  };

  const handleShareCobrança = (conta: BlingContaReceber) => {
    const texto = `Olá! Seguem os dados para pagamento referente ao documento ${conta.numeroDocumento}:\n\n` +
      `• Vencimento: ${conta.vencimentoFormatado}\n` +
      `• Valor: ${conta.valorFormatado}\n` +
      (conta.linhaDigitavel ? `• Linha Digitável: ${conta.linhaDigitavel}\n` : '') +
      (conta.pixCopiaECola ? `\n• Pix Copia e Cola:\n${conta.pixCopiaECola}` : '');
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-xl mx-auto w-full pb-36">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Contas a Receber</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {contas.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Entradas, duplicatas e boletos do Bling ERP
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
        <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-card bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center gap-1.5 text-blue-600 text-[11px] font-semibold mb-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>A Receber</span>
          </div>
          <span className="text-sm sm:text-base font-black text-slate-900 block leading-tight">
            {formatCurrency(resumo.totalAberto)}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-emerald-200/90 shadow-card bg-gradient-to-br from-white to-emerald-50/40">
          <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-semibold mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Recebidos</span>
          </div>
          <span className="text-sm sm:text-base font-black text-emerald-700 block leading-tight">
            {formatCurrency(resumo.totalLiquidado)}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-rose-200/90 shadow-card bg-gradient-to-br from-white to-rose-50/40">
          <div className="flex items-center gap-1.5 text-rose-600 text-[11px] font-semibold mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Em Atraso</span>
          </div>
          <span className="text-sm sm:text-base font-black text-rose-600 block leading-tight">
            {formatCurrency(resumo.totalVencido)}
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
            placeholder="Buscar por Cliente ou Nº Documento..."
            className="w-full bg-white text-slate-800 placeholder-slate-400 text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setFilterSituacao('aberto')}
            className={`px-3 py-1 rounded-full font-medium transition shrink-0 ${
              filterSituacao === 'aberto'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            A Receber
          </button>
          <button
            onClick={() => setFilterSituacao('atrasadas')}
            className={`px-3 py-1 rounded-full font-medium transition shrink-0 ${
              filterSituacao === 'atrasadas'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Em Atraso
          </button>
          <button
            onClick={() => setFilterSituacao('recebidas')}
            className={`px-3 py-1 rounded-full font-medium transition shrink-0 ${
              filterSituacao === 'recebidas'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Recebidas
          </button>
          <button
            onClick={() => setFilterSituacao('todas')}
            className={`px-3 py-1 rounded-full font-medium transition shrink-0 ${
              filterSituacao === 'todas'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Todas ({contas.length})
          </button>
        </div>
      </div>

      {/* Lista de Contas a Receber */}
      <div className="space-y-3">
        {contas.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">Nenhuma Conta a Receber no Bling</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Sua conta no Bling ERP está sem títulos ou boletos a receber em aberto (0 registros, R$ 0,00). 100% sincronizado com a base real do Bling!
            </p>
          </div>
        ) : contasFiltradas.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm">
            <ArrowUpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Nenhuma conta encontrada neste filtro</p>
            <p className="text-xs text-slate-400 mt-1">
              Altere o filtro de situação acima para localizar outros registros.
            </p>
          </div>
        ) : (
          contasFiltradas.map((conta) => {
            const isAtrasada = conta.situacao === 1 && conta.vencimento < hojeStr;
            const isRecebida = conta.situacao === 2;

            return (
              <div
                key={conta.id}
                className={`bg-white rounded-2xl p-4 border shadow-card hover:shadow-card-hover transition space-y-2.5 ${
                  isAtrasada ? 'border-rose-300/80 bg-rose-50/20' : 'border-slate-200/90'
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
                      isRecebida
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isAtrasada
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {isRecebida ? 'Liquidada' : isAtrasada ? 'Em Atraso' : 'A Vencer'}
                  </span>
                </div>

                {/* Linha Digitável do Boleto vinculada */}
                {conta.linhaDigitavel && (
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none mb-0.5">
                        Linha Digitável do Boleto:
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-slate-800 truncate block">
                        {conta.linhaDigitavel}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyLinha(conta.linhaDigitavel!, conta.id)}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition shrink-0"
                      title="Copiar Linha Digitável"
                    >
                      {copiedLinhaId === conta.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}

                {/* Vencimento e Valor */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Vencimento: <strong className={isAtrasada ? 'text-rose-600 font-bold' : 'text-slate-800'}>{conta.vencimentoFormatado}</strong>
                    </span>
                  </div>

                  <span className="text-base font-black text-slate-900 tracking-tight">
                    {conta.valorFormatado}
                  </span>
                </div>

                {/* Botões de Ação */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    onClick={() => onViewBoletoReceber(conta)}
                    className="flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 px-2 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition active:scale-95"
                  >
                    <Barcode className="w-3.5 h-3.5 text-blue-600" />
                    <span>Ver Boleto Oficial</span>
                  </button>

                  <button
                    onClick={() => handleShareCobrança(conta)}
                    className="flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 px-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition active:scale-95"
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cobrar WhatsApp</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
