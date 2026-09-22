import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Save,
  Building2,
  Cpu,
} from 'lucide-react';
import {
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  testarChaveGemini,
} from '../services/geminiService';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    modelUsado?: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getStoredGeminiApiKey();
      setApiKey(current);
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setStoredGeminiApiKey(apiKey);
    setSaveSuccess(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1000);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testarChaveGemini(apiKey);
      setTestResult(res);
      if (res.success) {
        // Auto-salva chave válida
        setStoredGeminiApiKey(apiKey);
        if (onSaved) onSaved();
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e?.message || 'Erro inesperado ao testar chave.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRemove = () => {
    setApiKey('');
    setStoredGeminiApiKey('');
    setTestResult(null);
    if (onSaved) onSaved();
  };

  const hasKey = Boolean(apiKey.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-['Manrope',sans-serif]">
      <div className="bg-white dark:bg-[#10221c] text-slate-900 dark:text-white w-full max-w-xl rounded-2xl border border-slate-200 dark:border-[#1a382e] shadow-2xl overflow-hidden flex flex-col">
        {/* Header do Modal */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#162f27] border-b border-slate-200 dark:border-[#214739] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-slate-950 flex items-center justify-center shadow-md shadow-emerald-500/20 font-bold">
              <Cpu className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>Configurações & Chaves de API</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#11d493] border border-emerald-500/20">
                  Inteligência Artificial
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Gerencie as conexões do Google Gemini e serviços de IA
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Card Principal: Google Gemini */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-white to-slate-50 dark:from-[#142821] dark:to-[#0f1f1a] border border-slate-200 dark:border-[#214739] shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Google Gemini API</span>
                    {hasKey ? (
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-[#11d493] border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#11d493] animate-pulse" />
                        Configurada
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        Não configurada
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Utilizado no Orçamento Inteligente (Vendas), Robô Fiscal e Comandos de Voz.
                  </p>
                </div>
              </div>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-emerald-600 dark:text-[#11d493] hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Obter chave no Google</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Input da Chave */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Chave de API (API Key)
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400 pointer-events-none">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full pl-9 pr-24 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#10221c] text-slate-900 dark:text-white font-mono text-xs font-semibold focus:ring-2 focus:ring-[#11d493] focus:outline-none transition"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    title={showKey ? 'Ocultar' : 'Visualizar'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {hasKey && (
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-600 px-1.5 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                      title="Limpar Chave"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Sua chave fica armazenada de forma segura e local no seu navegador.
              </p>
            </div>

            {/* Botões de Ação do Gemini */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting || !hasKey}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#1b382e] hover:bg-slate-200 dark:hover:bg-[#22473a] text-slate-700 dark:text-slate-200 border border-slate-300/80 dark:border-[#2b5947] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Sparkles className={`w-3.5 h-3.5 text-[#11d493] ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão Gemini'}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#11d493] hover:bg-[#0eb880] text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{saveSuccess ? 'Chave Salva!' : 'Salvar Chave'}</span>
              </button>
            </div>

            {/* Feedback do Teste */}
            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border flex items-start gap-2.5 animate-fade-in ${
                  testResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#11d493] shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 text-[11px] leading-relaxed">
                  <span className="font-bold block">{testResult.message}</span>
                </div>
              </div>
            )}
          </div>

          {/* Aviso Informativo do Bling ERP */}
          <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-blue-950 dark:text-blue-100">
                Integração Bling ERP (Multi-Empresas)
              </span>
              <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                As credenciais do Bling (<strong>Client ID</strong>, <strong>Client Secret</strong> e <strong>Token OAuth</strong>) são geridas individualmente no <strong>Card de cada Empresa</strong> na tela inicial, garantindo total isolamento fiscal entre seus CNPJs.
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-[#162f27] border-t border-slate-200 dark:border-[#214739] flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#11d493]" />
            Chaves criptografadas e restritas ao ambiente do seu dispositivo
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-bold bg-slate-200 dark:bg-[#10221c] hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
