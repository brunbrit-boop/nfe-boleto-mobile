import React, { useState, useRef, useEffect } from 'react';
import type { ClassificationRule } from './ClassifyTransactionsModal';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedRule?: { keyword: string; category: string; unit: string };
}

interface BankPatternChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRule: (rule: ClassificationRule) => void;
}

export const BankPatternChatbotModal: React.FC<BankPatternChatbotModalProps> = ({
  isOpen,
  onClose,
  onAddRule,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        'Olá! Eu sou o Robô de Inteligência Financeira do BT Business. Posso analisar seus extratos, identificar padrões de débito/crédito e criar regras automáticas de conciliação. Como posso te ajudar hoje?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Resposta inteligente simulada com detecção de padrões reais
    setTimeout(() => {
      const lower = userText.toLowerCase();
      let reply = '';
      let suggestedRule: { keyword: string; category: string; unit: string } | undefined;

      if (lower.includes('enel') || lower.includes('luz') || lower.includes('energia')) {
        reply =
          'Identifiquei o padrão de contas de energia elétrica (ENEL). Recomendo categorizar como "Utilidades" associado à sua unidade "Galpão 01" ou "Matriz". Deseja criar essa regra?';
        suggestedRule = { keyword: 'ENEL', category: 'Utilidades', unit: 'Galpão 01' };
      } else if (lower.includes('pix') || lower.includes('venda')) {
        reply =
          'Para recebimentos com descrição PIX de clientes, o melhor padrão é direcionar para "Vendas & Faturamento" na unidade "Matriz". Deseja salvar essa regra?';
        suggestedRule = { keyword: 'PIX CLIENTE', category: 'Vendas & Faturamento', unit: 'Matriz' };
      } else if (lower.includes('tarifa') || lower.includes('iof') || lower.includes('banco')) {
        reply =
          'Tarifas bancárias, taxas de custódia e IOF devem ser classificadas como despesa de "Tarifas Bancárias" na "Matriz".';
        suggestedRule = { keyword: 'TARIFA', category: 'Tarifas Bancárias', unit: 'Matriz' };
      } else if (lower.includes('posto') || lower.includes('gasolina') || lower.includes('combustivel')) {
        reply =
          'Gastos em postos de combustível normalmente pertencem ao centro de custos "Logística / Frota".';
        suggestedRule = { keyword: 'POSTO', category: 'Logística', unit: 'Frota' };
      } else {
        reply = `Entendi a sua dúvida sobre "${userText}". Analisei os extratos das empresas conectadas e sugiro padronizar a identificação por palavra-chave para que o sistema concilie sozinho na próxima importação de OFX/CSV.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assist-${Date.now()}`,
          role: 'assistant',
          content: reply,
          suggestedRule,
        },
      ]);
      setIsTyping(false);
    }, 600);
  };

  const handleApplySuggestedRule = (suggested: {
    keyword: string;
    category: string;
    unit: string;
  }) => {
    onAddRule({
      id: `rule-bot-${Date.now()}`,
      keyword: suggested.keyword,
      category: suggested.category,
      unit: suggested.unit,
      active: true,
    });
    alert(`Regra para "${suggested.keyword}" criada com sucesso!`);
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#10221c] border border-gray-200 dark:border-gray-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[560px]">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a2e28]/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">smart_toy</span>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                Robô de Padrões Bancários
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#11d493]/20 text-[#11d493] font-bold">
                  IA BT
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Assistente de conciliação automática e extratos
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] text-xs p-3 rounded-2xl ${
                  m.role === 'user'
                    ? 'bg-[#11d493] text-gray-950 font-medium rounded-tr-none'
                    : 'bg-gray-100 dark:bg-[#1a2e28] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700/60 rounded-tl-none'
                }`}
              >
                {m.content}

                {/* Sugestão de Regra clicável */}
                {m.suggestedRule && (
                  <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-between gap-2">
                    <div className="text-[10px] font-bold">
                      💡 Regra: <strong className="text-purple-600 dark:text-purple-400">{m.suggestedRule.keyword}</strong> →{' '}
                      {m.suggestedRule.category}
                    </div>
                    <button
                      onClick={() => handleApplySuggestedRule(m.suggestedRule!)}
                      className="px-2 py-1 bg-[#11d493] hover:bg-[#0eb87f] text-gray-950 font-bold text-[10px] rounded-lg shadow-xs"
                    >
                      Criar Regra
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 p-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#11d493] animate-ping"></span>
              Robô analisando padrões...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a2e28]/50 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: Como classificar lançamentos da ENEL ou tarifas?"
            className="flex-1 text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white focus:outline-none focus:border-[#11d493]"
          />
          <button
            type="submit"
            className="p-2 bg-[#11d493] hover:bg-[#0eb87f] text-gray-950 rounded-xl transition-all font-bold flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-base">send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
