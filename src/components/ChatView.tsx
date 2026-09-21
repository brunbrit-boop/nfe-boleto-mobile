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

  // Função simples para formatar texto com negrito e quebras de linha
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lIdx) => {
      if (!line.trim()) return <div key={lIdx} className="h-2" />;
      
      // Quebra por **negrito**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={lIdx} className="leading-relaxed mb-1">
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-bold text-white">
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
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-xl mx-auto w-full pb-36">
      {messages.length === 0 ? (
        <div className="py-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 via-emerald-500 to-teal-400 flex items-center justify-center mx-auto shadow-xl shadow-brand-500/20">
            <Sparkles className="w-8 h-8 text-slate-950" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Robô Fiscal & Boletos por Voz
            </h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
              Fale naturalmente com o robô para emitir Notas Fiscais e gerar boletos bancários com divisão de parcelas.
            </p>
          </div>

          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 text-left text-xs space-y-2 max-w-md mx-auto">
            <span className="font-bold text-brand-400 block">Exemplo do que você pode falar:</span>
            <p className="text-slate-300 italic">
              "Olha, eu quero criar uma nota fiscal de venda de produtos da minha empresa para a empresa Silva Materiais, no valor de R$ 3.000 em 3 parcelas."
            </p>
            <div className="pt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
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
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-500 flex items-center justify-center shrink-0 shadow-md shadow-brand-500/20 mt-1">
                  <Bot className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                </div>
              )}

              {/* Balão da Mensagem */}
              <div
                className={`max-w-[88%] sm:max-w-[84%] rounded-2xl p-3.5 shadow-md ${
                  isBot
                    ? 'glass-panel text-slate-200 border-slate-800 rounded-tl-sm'
                    : 'bg-gradient-to-r from-brand-600 to-emerald-600 text-slate-950 font-medium rounded-tr-sm shadow-brand-600/20'
                }`}
              >
                {/* Header do Balão */}
                <div className="flex items-center justify-between gap-3 text-[10px] mb-1.5 opacity-80">
                  <span className="font-bold flex items-center gap-1">
                    {msg.isAudio && <Mic className="w-3 h-3 text-red-400 animate-pulse" />}
                    {isBot ? 'Robô Fiscal Inteligente' : 'Você (Comando)'}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {msg.timestamp}
                  </span>
                </div>

                {/* Texto da Mensagem */}
                <div className="text-xs sm:text-[13px]">
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

                {/* Ações Rápidas (Chips de resposta) */}
                {msg.quickActions && msg.quickActions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-800/80">
                    {msg.quickActions.map((qa, qIdx) => (
                      <button
                        key={qIdx}
                        onClick={() => onQuickAction(qa.action)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 text-brand-300 border border-brand-500/30 transition active:scale-95"
                      >
                        {qa.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Avatar do Usuário */}
              {!isBot && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-1 text-slate-300">
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
