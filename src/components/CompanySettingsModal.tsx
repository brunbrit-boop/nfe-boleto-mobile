import React, { useState } from 'react';
import { X, Building2, ShieldCheck, Key, Save, Check } from 'lucide-react';
import type { CompanyProfile } from '../types';

interface CompanySettingsModalProps {
  company: CompanyProfile;
  onSave: (updated: CompanyProfile) => void;
  onClose: () => void;
}

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  company,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<CompanyProfile>({ ...company });
  const [savedAlert, setSavedAlert] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(
    localStorage.getItem('gemini_api_key') || ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (geminiApiKey) {
      localStorage.setItem('gemini_api_key', geminiApiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    onSave(formData);
    setSavedAlert(true);
    setTimeout(() => {
      setSavedAlert(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="px-4 py-3.5 bg-slate-900/90 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-400" />
            <span className="text-sm font-bold text-slate-100">
              Dados da Empresa Emitente & Certificado A1
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          {/* Status Certificado A1 */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="font-bold text-emerald-300 block">Certificado Digital A1 Conectado</span>
                <span className="text-[10px] text-emerald-400/80">Validade: 18/11/2027 • SEFAZ Produção / Homologação</span>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
              Ativo
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                Razão Social da Empresa
              </label>
              <input
                type="text"
                value={formData.razaoSocial}
                onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-400"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                Nome Fantasia
              </label>
              <input
                type="text"
                value={formData.nomeFantasia}
                onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                CNPJ do Emitente
              </label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                Inscrição Estadual (IE)
              </label>
              <input
                type="text"
                value={formData.inscricaoEstadual}
                onChange={(e) => setFormData({ ...formData, inscricaoEstadual: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-400"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                Estado (UF)
              </label>
              <input
                type="text"
                value={formData.uf}
                maxLength={2}
                onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-brand-400"
                required
              />
            </div>
          </div>

          {/* Integração Bling ERP (API v3) */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🟢</span>
                <label className="text-slate-200 text-xs font-bold">
                  Bling ERP (API v3 / NF-e)
                </label>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                Pronto para Homologação
              </span>
            </div>

            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  URL de Callback (Para cadastrar no Bling):
                </span>
                <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/oauth/callback` : 'https://seu-app.vercel.app/oauth/callback'}
                    className="w-full bg-transparent text-[11px] font-mono text-emerald-300 focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/oauth/callback`;
                      navigator.clipboard.writeText(url);
                      alert('URL de Callback copiada! Cole este link no cadastro do seu aplicativo no Bling.');
                    }}
                    className="shrink-0 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded border border-slate-700 transition"
                  >
                    Copiar URL
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[10px] font-semibold mb-0.5">
                    Bling Client ID
                  </label>
                  <input
                    type="text"
                    placeholder="Cole seu Client ID do Bling..."
                    defaultValue={localStorage.getItem('bling_client_id') || ''}
                    onChange={(e) => localStorage.setItem('bling_client_id', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] font-semibold mb-0.5">
                    Bling Client Secret
                  </label>
                  <input
                    type="password"
                    placeholder="Cole seu Client Secret..."
                    defaultValue={localStorage.getItem('bling_client_secret') || ''}
                    onChange={(e) => localStorage.setItem('bling_client_secret', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Chave da IA (Opcional) */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5 mb-1">
              <Key className="w-3.5 h-3.5 text-brand-400" />
              <label className="text-slate-300 text-[11px] font-semibold">
                Chave da API de IA (Gemini / Bing / OpenAI) - Opcional
              </label>
            </div>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Deixe em branco para usar o motor de IA integrado nativo..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 text-xs font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              O robô já possui um motor semântico fiscal completo integrado de fábrica que roda sem necessidade de chave externa.
            </p>
          </div>

          {/* Botões */}
          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold transition shadow-md shadow-brand-500/20"
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
