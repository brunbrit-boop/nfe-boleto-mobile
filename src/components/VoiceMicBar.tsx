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
    'Criar NF-e de R$ 3.000 em 3 parcelas para Silva Materiais',
    'Vendi 50 caixas de parafuso por R$ 1.500 para Metalúrgica Alpha em 2x',
    'Nota de venda de R$ 950 para Padaria Estrela em 4 parcelas',
    'NF de R$ 4.200 em 3 vezes para Construtora Morada Nova no Banco Inter',
  ];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="fixed bottom-16 left-0 right-0 z-30 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pt-2 pb-1">
      <div className="max-w-xl mx-auto px-4 space-y-2">
        {/* Sugestões Rápidas de Comandos */}
        {!isListening && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
            <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 shrink-0 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200">
              <Sparkles className="w-3 h-3 text-blue-600" /> Voz:
            </span>
            {sugestoesRapidas.map((sugestao, idx) => (
              <button
                key={idx}
                onClick={() => onSendMessage(sugestao)}
                className="shrink-0 text-[11px] bg-white text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 px-2.5 py-1 rounded-full transition truncate max-w-[240px] shadow-sm active:scale-95"
              >
                "{sugestao.length > 34 ? sugestao.slice(0, 34) + '...' : sugestao}"
              </button>
            ))}
          </div>
        )}

        {/* Transcrição em Tempo Real da Fala */}
        {isListening && (
          <div className="bg-white rounded-2xl p-3 border-2 border-rose-400 shadow-lg shadow-rose-500/10 animate-fade-in">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span className="text-xs font-bold text-rose-600 tracking-wide uppercase">
                  Ouvindo sua voz...
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="wave-bar w-1 bg-rose-500 rounded-full h-2"></div>
                <div className="wave-bar w-1 bg-rose-500 rounded-full h-4"></div>
                <div className="wave-bar w-1 bg-rose-500 rounded-full h-6"></div>
                <div className="wave-bar w-1 bg-rose-500 rounded-full h-3"></div>
                <div className="wave-bar w-1 bg-rose-500 rounded-full h-5"></div>
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-800 italic min-h-[22px]">
              {listeningTranscript ? `"${listeningTranscript}"` : 'Fale agora: "Quero criar uma nota fiscal..."'}
            </p>
          </div>
        )}

        {/* Barra de Entrada Principal */}
        <div className="bg-white rounded-2xl p-1.5 flex items-center gap-2 shadow-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setShowKeyboard(!showKeyboard)}
            className={`p-2 rounded-xl transition ${
              showKeyboard
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title={showKeyboard ? 'Ocultar teclado' : 'Digitar em vez de falar'}
          >
            {showKeyboard ? <Mic className="w-5 h-5" /> : <Keyboard className="w-5 h-5" />}
          </button>

          {showKeyboard ? (
            <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Fale ou digite o comando para o robô..."
                className="w-full bg-slate-50 text-xs text-slate-900 placeholder-slate-400 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                autoFocus
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold transition shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="flex-1 flex items-center justify-between px-2">
              <span className="text-xs text-slate-500 font-medium truncate">
                {isListening
                  ? 'Toque para concluir gravação'
                  : 'Toque para falar com o Robô'}
              </span>

              {/* Botão de Microfone Pulsante */}
              <div className="relative">
                {isListening && (
                  <div className="absolute inset-0 rounded-full bg-rose-500/30 animate-ripple pointer-events-none" />
                )}
                <button
                  type="button"
                  onClick={isListening ? onStopListening : onStartListening}
                  className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition active:scale-95 shadow-md ${
                    isListening
                      ? 'bg-rose-600 text-white shadow-rose-600/30'
                      : 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-blue-600/25 hover:opacity-95'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4 animate-bounce" />
                      <span>Parar</span>
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
