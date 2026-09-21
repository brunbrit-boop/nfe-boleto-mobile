import React, { useState } from 'react';
import { Mic, MicOff, Send, Sparkles, Keyboard } from 'lucide-react';

interface VoiceMicBarProps {
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onSendMessage: (text: string) => void;
  listeningTranscript: string;
}

export const VoiceMicBar: React.FC<VoiceMicBarProps> = ({
  isListening,
  onStartListening,
  onStopListening,
  onSendMessage,
  listeningTranscript,
}) => {
  const [inputText, setInputText] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);

  const sugestoesRapidas = [
    'Quero criar uma nota fiscal de venda de R$ 3.000 em 3 parcelas para Silva Materiais',
    'Vendi 50 caixas de parafuso por R$ 1.500 para Metalúrgica Alpha, parcela em 2x',
    'Nota de venda de R$ 950 para Padaria Estrela em 4 parcelas',
    'Emite NF de R$ 4.200 em 3 vezes para Construtora Morada Nova no Banco Inter',
  ];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 pb-safe bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-950/0 pt-3">
      <div className="max-w-xl mx-auto px-4 pb-3 space-y-2.5">
        {/* Sugestões Rápidas de Comandos */}
        {!isListening && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-400 shrink-0 px-2 py-1 rounded-full bg-brand-500/10 border border-brand-500/20">
              <Sparkles className="w-3 h-3" /> Exemplos de Voz:
            </span>
            {sugestoesRapidas.map((sugestao, idx) => (
              <button
                key={idx}
                onClick={() => onSendMessage(sugestao)}
                className="shrink-0 text-[11px] bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700/90 border border-slate-700/80 px-2.5 py-1 rounded-full transition truncate max-w-[260px] active:scale-95"
              >
                "{sugestao.length > 38 ? sugestao.slice(0, 38) + '...' : sugestao}"
              </button>
            ))}
          </div>
        )}

        {/* Transcrição em Tempo Real da Fala */}
        {isListening && (
          <div className="glass-panel rounded-2xl p-3.5 border-brand-500/40 shadow-xl shadow-brand-500/10 animate-fade-in">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="text-xs font-bold text-red-400 tracking-wide uppercase">
                  Ouvindo sua voz...
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="wave-bar w-1 bg-brand-400 rounded-full h-2"></div>
                <div className="wave-bar w-1 bg-brand-400 rounded-full h-4"></div>
                <div className="wave-bar w-1 bg-brand-400 rounded-full h-6"></div>
                <div className="wave-bar w-1 bg-brand-400 rounded-full h-3"></div>
                <div className="wave-bar w-1 bg-brand-400 rounded-full h-5"></div>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-100 italic min-h-[22px]">
              {listeningTranscript ? `"${listeningTranscript}"` : 'Fale agora: "Quero criar uma nota fiscal..."'}
            </p>
          </div>
        )}

        {/* Barra de Entrada Principal: Microfone + Input Alternativo */}
        <div className="glass-panel rounded-2xl p-2 flex items-center gap-2 shadow-2xl border-slate-700/80">
          {/* Toggle Teclado / Voz */}
          <button
            type="button"
            onClick={() => setShowKeyboard(!showKeyboard)}
            className={`p-2.5 rounded-xl transition ${
              showKeyboard
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={showKeyboard ? 'Ocultar teclado' : 'Digitar em vez de falar'}
          >
            {showKeyboard ? <Mic className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
          </button>

          {/* Campo de Texto (se teclado estiver ativo ou sempre visível em telas maiores) */}
          {showKeyboard ? (
            <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Fale ou digite o comando fiscal..."
                className="w-full bg-slate-900/90 text-sm text-slate-100 placeholder-slate-500 px-3.5 py-2.5 rounded-xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-brand-400/50"
                autoFocus
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:hover:bg-brand-500 text-slate-950 font-bold transition shadow-md shadow-brand-500/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="flex-1 flex items-center justify-between px-2">
              <span className="text-xs text-slate-400 font-medium truncate">
                {isListening
                  ? 'Toque no microfone para concluir'
                  : 'Toque para falar com o Robô Fiscal'}
              </span>

              {/* Botão Gigante de Microfone Pulsante */}
              <div className="relative">
                {isListening && (
                  <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ripple pointer-events-none" />
                )}
                <button
                  type="button"
                  onClick={isListening ? onStopListening : onStartListening}
                  className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition transform active:scale-95 shadow-lg ${
                    isListening
                      ? 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-red-500/30 ring-2 ring-red-400'
                      : 'bg-gradient-to-r from-brand-500 via-emerald-500 to-teal-400 text-slate-950 shadow-brand-500/25 hover:opacity-95'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4 animate-bounce" />
                      <span>Parar Gravação</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>Falar Comando</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
