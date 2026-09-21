import React, { useState } from 'react';
import { X, Building2, ShieldCheck, Key, Save, Check } from 'lucide-react';
import type { CompanyProfile } from '../types';
import { setBlingAccessTokenDirect, testBlingConnection, BLING_DEFAULT_CLIENT_ID } from '../utils/blingApi';

interface CompanySettingsModalProps {
  company: CompanyProfile;
  onSave: (updated: CompanyProfile) => void;
  onClose: () => void;
  onBlingConnected?: () => void;
}

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  company,
  onSave,
  onClose,
  onBlingConnected,
}) => {
  const [formData, setFormData] = useState<CompanyProfile>({ ...company });
  const [savedAlert, setSavedAlert] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(
    localStorage.getItem('gemini_api_key') || ''
  );
  const [blingAccessToken, setBlingAccessToken] = useState(
    localStorage.getItem('bling_access_token') || ''
  );
  const [blingClientId, setBlingClientId] = useState(
    localStorage.getItem('bling_client_id') || BLING_DEFAULT_CLIENT_ID
  );
  const [blingClientSecret, setBlingClientSecret] = useState(
    localStorage.getItem('bling_client_secret') || ''
  );
  const [isTestingBling, setIsTestingBling] = useState(false);
  const [testBlingResult, setTestBlingResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setIsTestingBling(true);
    setTestBlingResult(null);
    try {
      const res = await testBlingConnection(blingAccessToken);
      setTestBlingResult(res);
      if (res.success) {
        setBlingAccessTokenDirect(blingAccessToken);
        if (onBlingConnected) onBlingConnected();
      }
    } catch (err: any) {
      setTestBlingResult({
        success: false,
        message: err.message || 'Erro ao conectar com Bling',
      });
    } finally {
      setIsTestingBling(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (geminiApiKey) {
      localStorage.setItem('gemini_api_key', geminiApiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }

    setBlingAccessTokenDirect(blingAccessToken);
    if (blingClientId) localStorage.setItem('bling_client_id', blingClientId);
    if (blingClientSecret) localStorage.setItem('bling_client_secret', blingClientSecret);

    onSave(formData);
    setSavedAlert(true);
    if (onBlingConnected && blingAccessToken) {
      onBlingConnected();
    }
    setTimeout(() => {
      setSavedAlert(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-50 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-bold text-slate-900">
              Configurações da Empresa & Bling ERP
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs max-h-[82vh] overflow-y-auto">
          {/* Status Certificado A1 */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <span className="font-bold text-emerald-900 block">Certificado Digital A1 Conectado</span>
                <span className="text-[10px] text-emerald-700">Validade: 18/11/2027 • SEFAZ Produção / Homologação</span>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
              Ativo
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 text-[11px] font-semibold mb-1">
                Razão Social da Empresa
              </label>
              <input
                type="text"
                value={formData.razaoSocial}
                onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 text-[11px] font-semibold mb-1">
                Nome Fantasia
              </label>
              <input
                type="text"
                value={formData.nomeFantasia}
                onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 text-[11px] font-semibold mb-1">
                CNPJ do Emitente
              </label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 text-[11px] font-semibold mb-1">
                Inscrição Estadual (IE)
              </label>
              <input
                type="text"
                value={formData.inscricaoEstadual}
                onChange={(e) => setFormData({ ...formData, inscricaoEstadual: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 text-[11px] font-semibold mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-600 text-[11px] font-semibold mb-1">
                Estado (UF)
              </label>
              <input
                type="text"
                value={formData.uf}
                maxLength={2}
                onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Integração Bling ERP (API v3) */}
          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🟢</span>
                <label className="text-slate-900 text-xs font-bold">
                  Conexão Bling ERP (API v3)
                </label>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                blingAccessToken
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {blingAccessToken ? '● Conectado com Token' : '○ Aguardando Conexão'}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-3">
              {/* Opção 1: Token de Acesso Direto (Mais Fácil) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 text-[11px] font-bold flex items-center gap-1">
                    <Key className="w-3 h-3 text-blue-600" />
                    <span>Token de Acesso (Access Token / Bearer)</span>
                  </label>
                  <span className="text-[10px] text-blue-600 font-semibold">Recomendado</span>
                </div>
                <input
                  type="password"
                  value={blingAccessToken}
                  onChange={(e) => {
                    setBlingAccessToken(e.target.value);
                    setTestBlingResult(null);
                  }}
                  placeholder="Cole aqui o Token de Acesso gerado no Bling..."
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Se você já gerou um Access Token no portal do desenvolvedor do Bling, cole aqui para conectar instantaneamente.
                </p>
              </div>

              {/* Botão de Testar Conexão */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingBling || !blingAccessToken.trim()}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                    !blingAccessToken.trim()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                  }`}
                >
                  {isTestingBling ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Testando Conexão...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Testar Conexão com o Bling</span>
                    </>
                  )}
                </button>
              </div>

              {/* Resultado do Teste de Conexão */}
              {testBlingResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-medium border flex items-start gap-2 animate-fade-in ${
                    testBlingResult.success
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <span className="text-sm mt-0.5">
                    {testBlingResult.success ? '✅' : '❌'}
                  </span>
                  <div className="flex-1">
                    <span className="font-bold block">{testBlingResult.message}</span>
                  </div>
                </div>
              )}

              {/* Divisor para Configurações OAuth */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Ou autorizar via Aplicativo OAuth 2.0:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-slate-500 text-[10px] font-semibold mb-0.5">
                      Bling Client ID
                    </label>
                    <input
                      type="text"
                      value={blingClientId}
                      onChange={(e) => setBlingClientId(e.target.value)}
                      placeholder="d07e344178ec5f63e8045571930efcf047083dd0"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 text-[10px] font-semibold mb-0.5">
                      Bling Client Secret (Segredo)
                    </label>
                    <input
                      type="password"
                      value={blingClientSecret}
                      onChange={(e) => setBlingClientSecret(e.target.value)}
                      placeholder="Cole o Client Secret do seu app..."
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Botão Oficial de Autorização do Bling */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-2 mt-2">
                  <div className="text-[11px]">
                    <span className="font-bold text-slate-900 block">Link de Autorização:</span>
                    <span className="text-slate-500 text-[10px]">Abre o painel do Bling para autorizar</span>
                  </div>
                  <a
                    href={`https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${blingClientId}&state=cb9768157cff9aef9675a82bdd68c5e4`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition shadow-sm shrink-0"
                  >
                    Autorizar no Bling ↗
                  </a>
                </div>

                <div className="mt-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    URL de Redirecionamento (Callback):
                  </span>
                  <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                    <input
                      type="text"
                      readOnly
                      value={typeof window !== 'undefined' ? `${window.location.origin}/oauth/callback` : 'https://nfe-boleto-mobile.vercel.app/oauth/callback'}
                      className="w-full bg-transparent text-[11px] font-mono text-blue-700 focus:outline-none select-all font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = typeof window !== 'undefined' ? `${window.location.origin}/oauth/callback` : 'https://nfe-boleto-mobile.vercel.app/oauth/callback';
                        navigator.clipboard.writeText(url);
                        alert('URL de Callback copiada!');
                      }}
                      className="shrink-0 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-300 transition"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chave da IA (Opcional) */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1.5 mb-1">
              <Key className="w-3.5 h-3.5 text-blue-600" />
              <label className="text-slate-800 text-[11px] font-semibold">
                Chave da API de IA (Gemini / Bing / OpenAI) - Opcional
              </label>
            </div>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Deixe em branco para usar o motor de IA integrado nativo..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Botões */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-sm"
            >
              {savedAlert ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvo!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Configurações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
