import React, { useState } from 'react';
import { X, Copy, Check, Code2, Send, CheckCircle2 } from 'lucide-react';
import type { Installment } from '../types';

interface PayloadModalProps {
  payload: object | null;
  parcela: Installment | null;
  onClose: () => void;
}

export const PayloadModal: React.FC<PayloadModalProps> = ({
  payload,
  parcela,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!payload || !parcela) return null;

  const jsonString = JSON.stringify(payload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimularEnvio = () => {
    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900/90 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-bold text-slate-100">
              Payload da API do Banco (Parcela {parcela.numero}/{parcela.totalParcelas})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 text-xs">
          <p className="text-slate-300">
            Este é o código/payload exato formatado para ser transmitido na API do banco ou no sistema de cobrança para emitir o boleto automaticamente:
          </p>

          <div className="relative">
            <pre className="p-3.5 rounded-xl bg-slate-950 font-mono text-[11px] text-emerald-300 overflow-x-auto border border-slate-800 max-h-64 selection:bg-brand-500 selection:text-black">
              {jsonString}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1 text-[11px]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>

          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="font-bold text-slate-300 block">Status da Integração Bancária:</span>
            <p>• Linha digitável e código de barras gerados com sucesso.</p>
            <p>• Certificado de autenticação mTLS / OAuth2 pronto para envio.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={handleCopy}
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Copiar Código
          </button>

          <button
            onClick={handleSimularEnvio}
            disabled={sentSuccess}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95 shadow-md shadow-blue-600/20"
          >
            {sentSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Enviado ao Banco com Sucesso!</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Simular Envio à API do Banco</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
