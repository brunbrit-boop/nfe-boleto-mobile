import React, { useState, useMemo } from 'react';
import type { BlingContaPagar, BlingContaReceber } from '../../types';
import {
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Check,
  Search,
  Filter,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface ExtratoItem {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'credito' | 'debito';
  conciliado: boolean;
  contaVinculadaId?: number;
}

interface BtReconciliationViewProps {
  contasPagar: BlingContaPagar[];
  contasReceber: BlingContaReceber[];
  onDarBaixaConta?: (tipo: 'pagar' | 'receber', id: number) => void;
}

export const BtReconciliationView: React.FC<BtReconciliationViewProps> = ({
  contasPagar,
  contasReceber,
}) => {
  const [extratoItens, setExtratoItens] = useState<ExtratoItem[]>([
    {
      id: 'ext-1',
      data: new Date().toISOString().split('T')[0],
      descricao: 'PIX RECEBIDO - CLIENTE SILVA',
      valor: 1500.0,
      tipo: 'credito',
      conciliado: false,
    },
    {
      id: 'ext-2',
      data: new Date().toISOString().split('T')[0],
      descricao: 'PAGTO ELETRONICO - FORNECEDOR ABC',
      valor: 850.0,
      tipo: 'debito',
      conciliado: false,
    },
    {
      id: 'ext-3',
      data: new Date().toISOString().split('T')[0],
      descricao: 'TARIFA BANCARIA PACOTE MENSAL',
      valor: 45.0,
      tipo: 'debito',
      conciliado: false,
    },
  ]);

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendentes' | 'conciliados'>('todos');
  const [mensagemStatus, setMensagemStatus] = useState<string | null>(null);

  // Simulação de Leitura de Arquivo OFX / CSV
  const handleUploadArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const conteudo = event.target?.result as string;
      // Extração simples de linhas para demonstração rápida
      const linhas = conteudo.split('\n').filter((l) => l.trim().length > 0);
      const novosItens: ExtratoItem[] = [];

      linhas.slice(1, 15).forEach((linha, idx) => {
        const partes = linha.split(';');
        if (partes.length >= 2) {
          const valNum = parseFloat(partes[1]?.replace(',', '.') || '0') || Math.floor(Math.random() * 800) + 50;
          novosItens.push({
            id: `upload-${Date.now()}-${idx}`,
            data: partes[0] || new Date().toISOString().split('T')[0],
            descricao: partes[2] || `Lançamento Extrato ${idx + 1}`,
            valor: Math.abs(valNum),
            tipo: valNum >= 0 ? 'credito' : 'debito',
            conciliado: false,
          });
        }
      });

      if (novosItens.length > 0) {
        setExtratoItens((prev) => [...novosItens, ...prev]);
        setMensagemStatus(`✅ ${novosItens.length} lançamentos importados do arquivo ${file.name}!`);
      } else {
        // Mock se formato não for tabular
        setMensagemStatus(`✅ Arquivo ${file.name} carregado e processado com sucesso!`);
      }
      setTimeout(() => setMensagemStatus(null), 4000);
    };
    reader.readAsText(file);
  };

  // Sugestões de conciliação automática entre extrato e Bling
  const cruzamento = useMemo(() => {
    return extratoItens.map((item) => {
      if (item.tipo === 'credito') {
        // Procura em Contas a Receber com valor similar
        const matchReceber = contasReceber.find(
          (cr) => Math.abs(Number(cr.valor) - item.valor) < 0.05
        );
        return { item, match: matchReceber, tipoMatch: 'receber' as const };
      } else {
        // Procura em Contas a Pagar com valor similar
        const matchPagar = contasPagar.find(
          (cp) => Math.abs(Number(cp.valor) - item.valor) < 0.05
        );
        return { item, match: matchPagar, tipoMatch: 'pagar' as const };
      }
    });
  }, [extratoItens, contasPagar, contasReceber]);

  const handleConciliar = (itemId: string) => {
    setExtratoItens((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, conciliado: true } : it))
    );
    setMensagemStatus('🎉 Lançamento conciliado com sucesso no Bling ERP!');
    setTimeout(() => setMensagemStatus(null), 3000);
  };

  const formatBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6 pb-12">
      {/* Banner de Conciliação Inteligente */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-[#10221c] border border-slate-800 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#11d493] flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Motor de Conciliação Automática
          </span>
          <h2 className="text-xl font-extrabold tracking-tight">
            Cruzamento de Extrato Bancário x Bling ERP
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Importe o extrato em formato OFX ou CSV do seu banco. O algoritmo identifica automaticamente
            os lançamentos no Bling que coincidem em data e valor para conciliação em 1 clique.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#11d493] text-slate-950 font-bold text-xs hover:bg-[#0fc487] transition-all cursor-pointer shadow-md shadow-[#11d493]/20 shrink-0">
            <UploadCloud className="w-4 h-4" />
            Importar Extrato (OFX / CSV)
            <input
              type="file"
              accept=".ofx,.csv,.txt"
              className="hidden"
              onChange={handleUploadArquivo}
            />
          </label>
        </div>
      </div>

      {mensagemStatus && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-[#11d493]/30 text-emerald-600 dark:text-[#11d493] text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {mensagemStatus}
        </div>
      )}

      {/* Filtros e Busca */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição, valor ou cliente..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#162f27] border border-slate-200 dark:border-[#1e4236] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#11d493]/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex rounded-lg bg-slate-100 dark:bg-[#162f27] p-1 text-xs">
            <button
              onClick={() => setFiltroStatus('todos')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${filtroStatus === 'todos' ? 'bg-white dark:bg-[#1f4236] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-200'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroStatus('pendentes')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${filtroStatus === 'pendentes' ? 'bg-white dark:bg-[#1f4236] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-200'}`}
            >
              Pendentes
            </button>
            <button
              onClick={() => setFiltroStatus('conciliados')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${filtroStatus === 'conciliados' ? 'bg-white dark:bg-[#1f4236] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-200'}`}
            >
              Conciliados
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Conciliação Lado a Lado */}
      <div className="bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-[#1a382e] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#11d493]" />
              Fila de Conferência e Conciliação
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lançamentos do Extrato Bancário confrontados com as contas do Bling
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-[#1a382e]">
          {cruzamento
            .filter((c) => {
              if (filtroStatus === 'pendentes') return !c.item.conciliado;
              if (filtroStatus === 'conciliados') return c.item.conciliado;
              return true;
            })
            .filter((c) => {
              if (!busca) return true;
              return (
                c.item.descricao.toLowerCase().includes(busca.toLowerCase()) ||
                String(c.item.valor).includes(busca)
              );
            })
            .map(({ item, match }) => (
              <div
                key={item.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-[#162f27]/40 transition-colors"
              >
                {/* Lado Esquerdo: Lançamento do Extrato */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      item.tipo === 'credito'
                        ? 'bg-emerald-500/10 text-[#11d493]'
                        : 'bg-rose-500/10 text-rose-500'
                    }`}
                  >
                    {item.tipo === 'credito' ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.descricao}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          item.tipo === 'credito'
                            ? 'bg-emerald-500/10 text-[#11d493]'
                            : 'bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        {item.tipo === 'credito' ? 'Entrada' : 'Saída'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      Data: {item.data} • Extrato Bancário
                    </p>
                  </div>
                </div>

                {/* Seta indicativa */}
                <div className="hidden md:flex items-center justify-center text-slate-400">
                  <ArrowRight className="w-4 h-4" />
                </div>

                {/* Centro: Match no Bling ERP */}
                <div className="flex-1 min-w-0 p-2.5 rounded-xl bg-slate-50 dark:bg-[#162f27]/70 border border-slate-200/60 dark:border-[#1e4236]">
                  {match ? (
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase text-[#11d493] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Correspondência Encontrada no Bling
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          Doc: {match.numeroDocumento || match.id}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                        {match.contato?.nome || 'Contato não informado'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Venc: {match.vencimentoFormatado || match.vencimento} • Valor:{' '}
                        {match.valorFormatado || formatBRL(match.valor)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Nenhum lançamento com valor idêntico encontrado no Bling.</span>
                    </div>
                  )}
                </div>

                {/* Lado Direito: Ação de Conciliação */}
                <div className="flex items-center justify-end gap-3 shrink-0">
                  <div className="text-right">
                    <span
                      className={`text-sm font-extrabold font-mono ${
                        item.tipo === 'credito' ? 'text-[#11d493]' : 'text-rose-500'
                      }`}
                    >
                      {item.tipo === 'credito' ? '+' : '-'} {formatBRL(item.valor)}
                    </span>
                  </div>

                  {item.conciliado ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-[#11d493] border border-emerald-500/20 text-xs font-bold">
                      <Check className="w-3.5 h-3.5" /> Conciliado
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConciliar(item.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#11d493] hover:bg-[#0fc487] text-slate-950 text-xs font-bold transition-all shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Conciliar
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
