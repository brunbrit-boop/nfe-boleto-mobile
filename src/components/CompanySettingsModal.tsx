import React, { useState } from 'react';
import { X, Building2, ShieldCheck, Key, Save, Check, RefreshCw } from 'lucide-react';
import type { CompanyProfile, EmpresaTenant } from '../types';
import { setBlingAccessTokenDirect, testBlingConnection, renovarTokenBling } from '../utils/blingApi';
import { obterDiagnosticoBling } from '../services/blingService';

interface CompanySettingsModalProps {
  company: CompanyProfile;
  empresa?: EmpresaTenant;
  onSave: (
    updatedCompany: CompanyProfile,
    blingConfig?: {
      token: string;
      clientId: string;
      clientSecret: string;
      refreshToken?: string;
      expiresAt?: number;
    }
  ) => void;
  onClose: () => void;
  onBlingConnected?: () => void;
}

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  company,
  empresa,
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
    empresa?.blingAccessToken || ''
  );
  const [blingRefreshToken, setBlingRefreshToken] = useState(
    empresa?.blingRefreshToken || ''
  );
  const [blingClientId, setBlingClientId] = useState(
    empresa?.blingClientId || ''
  );
  const [blingClientSecret, setBlingClientSecret] = useState(
    empresa?.blingClientSecret || ''
  );
  const [blingExpiresAt, setBlingExpiresAt] = useState<number | undefined>(
    empresa?.blingTokenExpiresAt
  );

  const [isTestingBling, setIsTestingBling] = useState(false);
  const [testBlingResult, setTestBlingResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [diagnostico, setDiagnostico] = useState<{ ok: boolean; contatosCount?: number; contatosRaw?: any; error?: string } | null>(null);
  const [isRunningDiag, setIsRunningDiag] = useState(false);

  const handleRunDiagnostico = async () => {
    setIsRunningDiag(true);
    setDiagnostico(null);
    try {
      const res = await obterDiagnosticoBling();
      setDiagnostico(res);
    } catch (e: any) {
      setDiagnostico({ ok: false, error: e.message });
    } finally {
      setIsRunningDiag(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingBling(true);
    setTestBlingResult(null);
    try {
      setBlingAccessTokenDirect(blingAccessToken);
      const res = await testBlingConnection(blingAccessToken);
      setTestBlingResult(res);
      if (res.success) {
        setBlingAccessToken(localStorage.getItem('bling_access_token') || '');
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

  const handleRenovarToken = async () => {
    if (!blingRefreshToken.trim()) {
      setRefreshFeedback({
        success: false,
        message: 'Informe o Refresh Token para realizar a renovação de 6 horas.',
      });
      return;
    }
    setIsRefreshing(true);
    setRefreshFeedback(null);
    try {
      const res = await renovarTokenBling(blingRefreshToken, blingClientId, blingClientSecret);
      if (res.success && res.accessToken) {
        setBlingAccessToken(res.accessToken);
        if (res.refreshToken) setBlingRefreshToken(res.refreshToken);
        if (res.expiresAt) setBlingExpiresAt(res.expiresAt);
        setRefreshFeedback({
          success: true,
          message: 'Token renovado com sucesso! Mais 6 horas de conexão garantidas.',
        });
        if (onBlingConnected) onBlingConnected();
      } else {
        setRefreshFeedback({
          success: false,
          message: res.error || 'Não foi possível renovar o token. Verifique as credenciais.',
        });
      }
    } catch (err: any) {
      setRefreshFeedback({
        success: false,
        message: err.message || 'Erro na renovação do token',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnectBling = () => {
    setBlingAccessTokenDirect('');
    setBlingAccessToken('');
    setBlingRefreshToken('');
    setBlingExpiresAt(undefined);
    localStorage.removeItem('bling_refresh_token');
    localStorage.removeItem('bling_expires_at');
    setTestBlingResult({
      success: false,
      message: 'Conta do Bling desconectada com sucesso.',
    });
    if (onBlingConnected) onBlingConnected();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (geminiApiKey) {
      localStorage.setItem('gemini_api_key', geminiApiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }

    if (blingAccessToken.trim()) {
      localStorage.setItem('bling_access_token', blingAccessToken.trim());
    } else {
      localStorage.removeItem('bling_access_token');
    }
    if (blingClientId.trim()) {
      localStorage.setItem('bling_client_id', blingClientId.trim());
    }
    if (blingClientSecret.trim()) {
      localStorage.setItem('bling_client_secret', blingClientSecret.trim());
    }
    if (blingRefreshToken.trim()) {
      localStorage.setItem('bling_refresh_token', blingRefreshToken.trim());
    } else {
      localStorage.removeItem('bling_refresh_token');
    }
    if (blingExpiresAt) {
      localStorage.setItem('bling_expires_at', String(blingExpiresAt));
    } else {
      localStorage.removeItem('bling_expires_at');
    }

    onSave(formData, {
      token: blingAccessToken.trim(),
      clientId: blingClientId.trim(),
      clientSecret: blingClientSecret.trim(),
      refreshToken: blingRefreshToken.trim(),
      expiresAt: blingExpiresAt,
    });
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
          {/* Integração Bling ERP (API v3 / OAuth 2.0) */}
          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🟢</span>
                <label className="text-slate-900 text-xs font-bold">
                  Integração Bling ERP (API v3)
                </label>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                blingAccessToken
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {blingAccessToken ? '● Conectado ao Bling' : '○ Aguardando Conexão'}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-3">
              {/* Campo Direto de Token de Acesso (Bearer Token) */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                    <span>🔑</span> Token de Acesso do Bling (Access / Bearer Token)
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Direto & Mais Rápido
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={blingAccessToken}
                    onChange={(e) => {
                      setBlingAccessToken(e.target.value);
                      setBlingAccessTokenDirect(e.target.value);
                    }}
                    placeholder="Cole seu Token de Acesso (Access Token) aqui..."
                    className="flex-1 bg-white border border-emerald-300 rounded-lg px-3 py-2 text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingBling || !blingAccessToken}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <span>⚡</span>
                    <span>{isTestingBling ? 'Testando...' : 'Testar Token'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-emerald-800/80 leading-relaxed">
                  Cole o Token de Acesso gerado na tela do Bling e clique em <strong>Testar Token</strong> para conectar na mesma hora!
                </p>
              </div>

              {/* Campo de Refresh Token (30 dias / Auto-Renovação) */}
              <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-purple-950 flex items-center gap-1.5">
                    <span>🔄</span> Refresh Token do Bling (Validade: 30 dias)
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    Auto-Renovação Contínua
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={blingRefreshToken}
                    onChange={(e) => setBlingRefreshToken(e.target.value)}
                    placeholder="Cole seu Refresh Token do Bling aqui..."
                    className="flex-1 bg-white border border-purple-300 rounded-lg px-3 py-2 text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleRenovarToken}
                    disabled={isRefreshing || !blingRefreshToken}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{isRefreshing ? 'Renovando...' : 'Renovar Token'}</span>
                  </button>
                </div>

                {refreshFeedback && (
                  <div
                    className={`p-2 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 animate-fade-in ${
                      refreshFeedback.success
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    <span>{refreshFeedback.success ? '✅' : '❌'}</span>
                    <span>{refreshFeedback.message}</span>
                  </div>
                )}

                <p className="text-[10px] text-purple-800/80 leading-relaxed">
                  Com o <strong>Refresh Token</strong> salvo nesta empresa, a aplicação renovará o acesso automaticamente a cada 6 horas, sem que você precise digitar ou gerar chaves novamente por 30 dias!
                </p>
              </div>

              {/* Informação sobre Client ID e Secret */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 text-slate-700 text-[11px] leading-relaxed">
                <span className="font-bold text-blue-900 block mb-0.5">ℹ️ Ou conecte via Aplicativo (OAuth 2.0):</span>
                Se preferir autorização automática, informe o <strong>Client ID</strong> e <strong>Client Secret</strong> abaixo e clique no botão de autorizar:
              </div>

              {/* Campos de Client ID e Client Secret */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 text-[10px] font-bold mb-1">
                    Bling Client ID
                  </label>
                  <input
                    type="text"
                    value={blingClientId}
                    onChange={(e) => setBlingClientId(e.target.value)}
                    placeholder="d07e344178ec5f63e8045571930efcf047083dd0"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 text-[10px] font-bold mb-1">
                    Bling Client Secret (Segredo)
                  </label>
                  <input
                    type="password"
                    value={blingClientSecret}
                    onChange={(e) => setBlingClientSecret(e.target.value)}
                    placeholder="Cole seu Client Secret do Bling..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Botão de Conexão em 1 Clique */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const targetId = empresa?.id || 'emp_default';
                    localStorage.setItem('bling_oauth_pending_empresa_id', targetId);
                    if (blingClientId) localStorage.setItem('bling_client_id', blingClientId);
                    if (blingClientSecret) localStorage.setItem('bling_client_secret', blingClientSecret);
                    const authUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${blingClientId}&state=${targetId}`;
                    window.location.href = authUrl;
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <span className="text-sm">🔗</span>
                  <span>Conectar com o Bling Agora (1 Clique)</span>
                </button>
                <p className="text-[10px] text-slate-500 text-center mt-1">
                  Abre o Bling para autorizar e retorna automaticamente com todos os seus dados reais sincronizados.
                </p>
              </div>

              {/* Se já tiver conectado, botão para testar e desconectar */}
              {blingAccessToken && (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
                    <span>✅</span>
                    <span>Conectado com Sucesso</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingBling}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
                    >
                      {isTestingBling ? 'Testando...' : '⚡ Testar'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectBling}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                    >
                      Desconectar
                    </button>
                  </div>
                </div>
              )}

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

              {/* Botão de Inspecionar Estrutura de Dados Reais do Bling */}
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleRunDiagnostico}
                  disabled={isRunningDiag}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-300 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>🔍</span>
                  <span>{isRunningDiag ? 'Consultando Bling...' : 'Inspecionar Estrutura de Dados do Bling'}</span>
                </button>

                {diagnostico && (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-44 animate-fade-in border border-slate-800">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-700 mb-1.5">
                      <span className="font-bold text-[10px] text-blue-400">
                        {diagnostico.ok ? `✅ Resposta Bling API v3 (${diagnostico.contatosCount} contatos encontrados)` : '❌ Erro retornado pelo Bling'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDiagnostico(null)}
                        className="text-slate-400 hover:text-white text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                    {diagnostico.error && (
                      <p className="text-rose-400 font-bold mb-1">{diagnostico.error}</p>
                    )}
                    <pre className="text-[10px] text-slate-300 leading-tight select-all">
                      {JSON.stringify(diagnostico.contatosRaw || diagnostico, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Seção Opcional: URL de Callback para verificação */}
              <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                <span className="font-semibold block mb-0.5">URL de Redirecionamento configurada no Bling:</span>
                <code className="block bg-white p-1.5 rounded border border-slate-200 text-blue-700 font-mono select-all truncate">
                  {typeof window !== 'undefined' ? `${window.location.origin}/oauth/callback` : 'https://nfe-boleto-mobile.vercel.app/oauth/callback'}
                </code>
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
