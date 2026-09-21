import React, { useEffect, useRef } from 'react';
import { Sparkles, User, Mic, Bot, Clock } from 'lucide-react';
import type { BankProvider, ChatMessage, Installment, NFeData } from '../types';
import { NFeCard } from './NFeCard';
import { InstallmentsCard } from './InstallmentsCard';

interface ChatViewProps {
  messages: ChatMessage[];
  bancoAtual: BankProvider;
  onViewDanfe: (nfe: NFeData) => void;
  onEmitirNFe: (nfe: NFeData) => void;
  onViewBoleto: (parcela: Installment, nfe: NFeData) => void;
  onViewPayloadBanco: (payload: object, parcela: Installment) => void;
  onQuickAction: (actionText: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  bancoAtual,
  onViewDanfe,
  onEmitirNFe,
  onViewBoleto,
  onViewPayloadBanco,
  onQuickAction,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lIdx) => {
      if (!line.trim()) return <div key={lIdx} className="h-2" />;
      
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={lIdx} className="leading-relaxed mb-1">
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-bold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-xl mx-auto w-full pb-48">
      {messages.length === 0 ? (
        <div className="py-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Robô Fiscal & Boletos por Voz
            </h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              Fale naturalmente com o robô para emitir Notas Fiscais no Bling e gerar boletos bancários com divisão de parcelas.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 text-left text-xs space-y-2 max-w-md mx-auto shadow-sm">
            <span className="font-bold text-blue-700 block">Exemplo do que você pode falar:</span>
            <p className="text-slate-700 italic">
              "Olha, eu quero criar uma nota fiscal de venda de produtos da minha empresa para a empresa Silva Materiais no valor de R$ 3.000 em 3 parcelas."
            </p>
            <div className="pt-2 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100">
              <span>👉</span>
              <span>O robô faz a nota sozinho, divide as parcelas e gera os códigos bancários!</span>
            </div>
          </div>
        </div>
      ) : (
        messages.map((msg) => {
          const isBot = msg.sender === 'bot';

          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
            >
              {/* Avatar do Bot */}
              {isBot && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <Bot className="w-4 h-4 text-white stroke-[2.5]" />
                </div>
              )}

              {/* Balão da Mensagem */}
              <div
                className={`max-w-[88%] sm:max-w-[84%] rounded-2xl p-3.5 shadow-sm ${
                  isBot
                    ? 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-sm'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-tr-sm shadow-md shadow-blue-600/10'
                }`}
              >
                {/* Header do Balão */}
                <div className={`flex items-center justify-between gap-3 text-[10px] mb-1.5 ${isBot ? 'text-slate-400' : 'text-blue-100'}`}>
                  <span className="font-bold flex items-center gap-1">
                    {msg.isAudio && <Mic className="w-3 h-3 text-rose-400 animate-pulse" />}
                    {isBot ? 'Robô Fiscal Inteligente' : 'Você (Comando)'}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {msg.timestamp}
                  </span>
                </div>

                {/* Texto da Mensagem */}
                <div className={`text-xs sm:text-[13px] ${isBot ? 'text-slate-700' : 'text-white'}`}>
                  {renderFormattedText(msg.text)}
                </div>

                {/* Card de NF-e Embutido */}
                {msg.nfeData && (
                  <NFeCard
                    nfe={msg.nfeData}
                    onViewDanfe={onViewDanfe}
                    onEmitirNFe={onEmitirNFe}
                  />
                )}

                {/* Card de Parcelamento & Boletos Embutido */}
                {msg.nfeData && msg.nfeData.parcelas && (
                  <InstallmentsCard
                    parcelas={msg.nfeData.parcelas}
                    banco={bancoAtual}
                    nfe={msg.nfeData}
                    onViewBoleto={(parc) => onViewBoleto(parc, msg.nfeData!)}
                    onViewPayloadBanco={onViewPayloadBanco}
                  />
                )}

                {/* Ações Rápidas */}
                {msg.quickActions && msg.quickActions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-100">
                    {msg.quickActions.map((qa, qIdx) => (
                      <button
                        key={qIdx}
                        onClick={() => onQuickAction(qa.action)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-50 hover:bg-slate-100 text-blue-700 border border-blue-200 transition active:scale-95"
                      >
                        {qa.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Avatar do Usuário */}
              {!isBot && (
                <div className="w-8 h-8 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 mt-1 text-blue-700">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
};
