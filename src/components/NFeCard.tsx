import React, { useState } from 'react';
import { FileText, CheckCircle2, Copy, Check, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import type { NFeData } from '../types';
import confetti from 'canvas-confetti';
import { speechEngine } from '../utils/speechEngine';

interface NFeCardProps {
  nfe: NFeData;
  onViewDanfe: (nfe: NFeData) => void;
  onEmitirNFe: (nfe: NFeData) => void;
}

export const NFeCard: React.FC<NFeCardProps> = ({ nfe, onViewDanfe, onEmitirNFe }) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [isEmitting, setIsEmitting] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(nfe.chaveAcesso);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleEmitir = () => {
    setIsEmitting(true);
    setTimeout(() => {
      setIsEmitting(false);
      nfe.status = 'autorizada';
      speechEngine.playBeep('success');
      speechEngine.speak('Nota fiscal autorizada com sucesso na SEFAZ! Os boletos já estão registrados.');
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 }
      });
      onEmitirNFe(nfe);
    }, 1200);
  };

  const isAutorizada = nfe.status === 'autorizada';

  return (
    <div className="glass-card rounded-2xl overflow-hidden border-slate-700/80 shadow-lg mt-2 transition hover:border-slate-600">
      {/* Top Banner Status */}
      <div className={`px-4 py-2.5 flex items-center justify-between text-xs font-semibold ${
        isAutorizada 
          ? 'bg-emerald-500/15 text-emerald-400 border-b border-emerald-500/20' 
          : 'bg-amber-500/15 text-amber-300 border-b border-amber-500/20'
      }`}>
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4" />
          <span>NF-e Nº {nfe.numeroNFe} (Série {nfe.serie})</span>
        </div>
        <div className="flex items-center gap-1">
          {isAutorizada ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Autorizada SEFAZ</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Rascunho Pronto</span>
            </>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Destinatário */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-700/60 pb-2.5">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Cliente / Destinatário
            </span>
            <h4 className="text-sm font-bold text-slate-100">
              {nfe.destinatario.razaoSocial}
            </h4>
          </div>
          <div className="text-xs text-slate-300 sm:text-right font-mono">
            <span>CNPJ: {nfe.destinatario.cnpj}</span>
            <div className="text-[11px] text-slate-400">
              {nfe.destinatario.cidade} - {nfe.destinatario.uf}
            </div>
          </div>
        </div>

        {/* Itens da Venda */}
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Itens da Venda (Produtos)
          </span>
          <div className="space-y-1.5 bg-slate-900/60 rounded-xl p-2.5 border border-slate-800">
            {nfe.itens.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs gap-2">
                <div className="truncate flex-1">
                  <span className="font-semibold text-slate-200">{item.descricao}</span>
                  <div className="text-[10px] text-slate-400">
                    Qtd: {item.quantidade} {item.unidade} • NCM: {item.ncm} • CFOP: {item.cfop}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-slate-100">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorTotal)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chave de Acesso da NF-e */}
        <div className="bg-slate-900/70 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between gap-2">
          <div className="truncate">
            <span className="text-[10px] text-slate-400 block font-semibold">
              Chave de Acesso (44 dígitos SEFAZ):
            </span>
            <span className="text-[11px] font-mono text-slate-300 truncate block">
              {nfe.chaveAcesso}
            </span>
          </div>
          <button
            onClick={handleCopyKey}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
            title="Copiar Chave de Acesso"
          >
            {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Total e Ações */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold">Valor Total da Nota</span>
            <span className="text-lg font-black text-brand-400 tracking-tight">
              {nfe.valorTotalFormatado}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewDanfe(nfe)}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver DANFE</span>
            </button>

            {!isAutorizada && (
              <button
                onClick={handleEmitir}
                disabled={isEmitting}
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-emerald-500 hover:from-brand-400 hover:to-emerald-400 text-slate-950 shadow-md shadow-brand-500/20 transition active:scale-95 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isEmitting ? 'Emitindo...' : 'Emitir na SEFAZ'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
