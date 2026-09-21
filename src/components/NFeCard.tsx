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
      speechEngine.speak('Nota fiscal autorizada com sucesso na SEFAZ e sincronizada no Bling!');
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
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm mt-2 transition hover:border-slate-300">
      {/* Top Banner Status */}
      <div className={`px-4 py-2.5 flex items-center justify-between text-xs font-semibold ${
        isAutorizada 
          ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-100' 
          : 'bg-amber-50 text-amber-800 border-b border-amber-100'
      }`}>
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-slate-700" />
          <span className="font-bold">NF-e Nº {nfe.numeroNFe} (Série {nfe.serie})</span>
        </div>
        <div className="flex items-center gap-1">
          {isAutorizada ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-bold text-emerald-700">Autorizada SEFAZ / Bling</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span className="font-bold text-amber-700">Rascunho Pronto</span>
            </>
          )}
        </div>
      </div>

      <div className="p-3.5 space-y-3">
        {/* Destinatário */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Cliente / Destinatário
            </span>
            <h4 className="text-sm font-bold text-slate-900">
              {nfe.destinatario.razaoSocial}
            </h4>
          </div>
          <div className="text-xs text-slate-600 sm:text-right font-mono">
            <span>CNPJ: {nfe.destinatario.cnpj}</span>
            <div className="text-[11px] text-slate-400">
              {nfe.destinatario.cidade} - {nfe.destinatario.uf}
            </div>
          </div>
        </div>

        {/* Itens da Venda */}
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Itens da Venda (Produtos)
          </span>
          <div className="space-y-1.5 bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
            {nfe.itens.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs gap-2">
                <div className="truncate flex-1">
                  <span className="font-bold text-slate-800">{item.descricao}</span>
                  <div className="text-[10px] text-slate-500">
                    Qtd: {item.quantidade} {item.unidade} • NCM: {item.ncm} • CFOP: {item.cfop}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-slate-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorTotal)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chave de Acesso da NF-e */}
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-2">
          <div className="truncate">
            <span className="text-[10px] text-slate-500 block font-semibold">
              Chave de Acesso SEFAZ (44 dígitos):
            </span>
            <span className="text-[11px] font-mono text-slate-700 truncate block font-medium">
              {nfe.chaveAcesso}
            </span>
          </div>
          <button
            onClick={handleCopyKey}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition shrink-0"
            title="Copiar Chave de Acesso"
          >
            {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Total e Ações */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold">Valor Total da Nota</span>
            <span className="text-lg font-black text-blue-700 tracking-tight">
              {nfe.valorTotalFormatado}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewDanfe(nfe)}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>Ver DANFE</span>
            </button>

            {!isAutorizada && (
              <button
                onClick={handleEmitir}
                disabled={isEmitting}
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isEmitting ? 'Transmitindo...' : 'Transmitir SEFAZ'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
