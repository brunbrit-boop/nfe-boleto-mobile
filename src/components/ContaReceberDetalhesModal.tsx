import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Building2,
  CreditCard,
  Tag,
  FileText,
  Copy,
  Check,
  Barcode,
  Share2,
  Clock,
  Landmark,
  AlignLeft,
} from 'lucide-react';
import type { BlingContaReceber } from '../types';
import { obterDetalhesContaReceberBling } from '../services/blingService';

interface ContaReceberDetalhesModalProps {
  conta: BlingContaReceber | null;
  onClose: () => void;
  onViewBoleto?: (conta: BlingContaReceber) => void;
  onSalvarObservacao?: (idConta: number, novoTexto: string) => void | Promise<void>;
}

export const ContaReceberDetalhesModal: React.FC<ContaReceberDetalhesModalProps> = ({
  conta,
  onClose,
  onViewBoleto,
  onSalvarObservacao,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [observacaoEditada, setObservacaoEditada] = useState<string>(() =>
    conta ? conta.historico || conta.observacoes || (conta as any).detalhes || '' : ''
  );
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [obsSalvaFeedback, setObsSalvaFeedback] = useState(false);

  useEffect(() => {
    if (!conta) return;
    const inicial = conta.historico || conta.observacoes || (conta as any).detalhes || '';
    setObservacaoEditada(inicial);

    const precisaBuscar = !inicial || inicial.startsWith('Recebimento Ref #') || inicial.startsWith('Ref. doc.');
    if (precisaBuscar && conta.id) {
      setCarregandoDetalhes(true);
      obterDetalhesContaReceberBling(conta.id)
        .then((detalhe) => {
          if (detalhe?.historico) {
            setObservacaoEditada(detalhe.historico);
            conta.historico = detalhe.historico;
            conta.observacoes = detalhe.historico;
            if (onSalvarObservacao) {
              onSalvarObservacao(conta.id, detalhe.historico);
            }
          }
        })
        .finally(() => setCarregandoDetalhes(false));
    }
  }, [conta?.id]);

  if (!conta) return null;

  const hojeStr = new Date().toISOString().slice(0, 10);
  const isAtrasada = conta.situacao === 1 && Boolean(conta.vencimento && conta.vencimento < hojeStr);
  const isLiquidada = conta.situacao === 2;

  const clienteNome = conta.contato?.nome || (conta as any).clienteNome || 'Cliente não identificado';
  const clienteDoc = conta.contato?.numeroDocumento || (conta as any).clienteDoc;
  const valorFormatado = conta.valorFormatado || new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(conta.valor) || 0);
  const vencFormatado = conta.vencimentoFormatado || (conta.vencimento ? conta.vencimento.split('-').reverse().join('/') : '-');
  const categoriaFormatada = typeof conta.categoria === 'object' && conta.categoria !== null ? (conta.categoria as any).descricao : (conta.categoria || 'Vendas');

  const contaFinanceiraNome =
    conta.contaFinanceira?.descricao ||
    (conta as any).contaContabil?.descricao ||
    (conta as any).portador?.descricao ||
    (conta as any).portador?.nome ||
    (conta as any).banco?.descricao ||
    'Não informada no Bling';

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleShareWhatsApp = () => {
    const msg =
      `Olá! Seguem os dados para pagamento ref. ao doc ${conta.numeroDocumento || conta.id}:\n\n` +
      `• Vencimento: ${vencFormatado}\n` +
      `• Valor: ${valorFormatado}\n` +
      (conta.linhaDigitavel ? `• Linha Digitável: ${conta.linhaDigitavel}\n` : '') +
      (conta.pixCopiaECola ? `\n• Pix Copia e Cola:\n${conta.pixCopiaECola}` : '');

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Compacto */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                  Conta a Receber
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isLiquidada
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : isAtrasada
                      ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {isLiquidada ? 'Liquidada' : isAtrasada ? 'Vencida' : 'Em aberto'}
                </span>
              </div>
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                Doc: {conta.numeroDocumento || `ID ${conta.id}`}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Card Principal: Valor e Vencimento */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Valor Total
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                {valorFormatado}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Vencimento
              </span>
              <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1 justify-end mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>{vencFormatado}</span>
              </div>
            </div>
          </div>

          {/* Dados do Cliente */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>Cliente</span>
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {clienteNome}
            </div>
            {clienteDoc && (
              <div className="text-[11px] font-mono text-slate-500">
                CNPJ/CPF: {clienteDoc}
              </div>
            )}
          </div>

          {/* 1. Conta Financeira / Contábil (Banco ou Caixa de Destino) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/60 dark:from-blue-950/40 dark:to-indigo-950/20 border border-blue-200/90 dark:border-blue-900/60 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                <Landmark className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 block">
                  Conta Financeira / Contábil
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-white truncate block">
                  {contaFinanceiraNome}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-100/90 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
              Banco / Caixa
            </span>
          </div>

          {/* 2. Histórico do Lançamento no Bling (Editável) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                <span>Histórico do Lançamento</span>
                {carregandoDetalhes && (
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-normal lowercase animate-pulse">
                    (carregando Bling...)
                  </span>
                )}
              </span>
              {onSalvarObservacao && (
                <button
                  onClick={async () => {
                    setSalvandoObs(true);
                    try {
                      await onSalvarObservacao(conta.id, observacaoEditada);
                      setObsSalvaFeedback(true);
                      setTimeout(() => setObsSalvaFeedback(false), 2500);
                    } finally {
                      setSalvandoObs(false);
                    }
                  }}
                  disabled={salvandoObs}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  title="Salvar histórico no painel para envio ao Bling"
                >
                  {salvandoObs ? (
                    <span>Salvando...</span>
                  ) : obsSalvaFeedback ? (
                    <>
                      <Check className="w-3 h-3 text-white" />
                      <span>Salvo!</span>
                    </>
                  ) : (
                    <span>Salvar</span>
                  )}
                </button>
              )}
            </div>
            <textarea
              value={observacaoEditada}
              onChange={(e) => {
                setObservacaoEditada(e.target.value);
                if (onSalvarObservacao) {
                  onSalvarObservacao(conta.id, e.target.value);
                }
              }}
              rows={3}
              placeholder="Ex: Ref. a NF nº 000170 | Parcela 1/3"
              className="w-full text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium bg-white dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* 3. Outros Metadados Financeiros do Bling */}
          <div className="grid grid-cols-3 gap-2">
            {/* Forma de Pagamento */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                <CreditCard className="w-3 h-3 text-purple-500" />
                <span>Forma Pgto</span>
              </span>
              <div className="text-xs font-black text-slate-900 dark:text-white truncate" title={conta.formaPagamento?.descricao || 'Nenhuma'}>
                {conta.formaPagamento?.descricao || 'Nenhuma'}
              </div>
            </div>

            {/* Categoria */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                <Tag className="w-3 h-3 text-amber-500" />
                <span>Categoria</span>
              </span>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={categoriaFormatada}>
                {categoriaFormatada}
              </div>
            </div>

            {/* Emissão */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3 text-emerald-500" />
                <span>Emissão</span>
              </span>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {conta.dataEmissao || conta.vencimentoFormatado}
              </div>
            </div>
          </div>

          {/* Dados de Boleto e Pix */}
          {conta.linhaDigitavel && (
            <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                  Linha Digitável
                </span>
                <button
                  onClick={() => handleCopy(conta.linhaDigitavel!, 'linha')}
                  className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  {copiedKey === 'linha' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 break-all select-all bg-white dark:bg-slate-900 p-2 rounded-xl border border-blue-100 dark:border-blue-950">
                {conta.linhaDigitavel}
              </div>
            </div>
          )}

          {conta.pixCopiaECola && (
            <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Pix Copia e Cola
                </span>
                <button
                  onClick={() => handleCopy(conta.pixCopiaECola!, 'pix')}
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
                >
                  {copiedKey === 'pix' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate select-all bg-white dark:bg-slate-900 p-2 rounded-xl border border-emerald-100 dark:border-emerald-950">
                {conta.pixCopiaECola}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Ações Diretas */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between gap-2">
          {onViewBoleto ? (
            <button
              onClick={() => {
                onClose();
                onViewBoleto(conta);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition shadow-sm"
            >
              <Barcode className="w-4 h-4" />
              <span>Ver Boleto</span>
            </button>
          ) : null}

          <button
            onClick={handleShareWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
