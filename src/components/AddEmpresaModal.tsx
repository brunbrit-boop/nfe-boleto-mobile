import React, { useState } from 'react';
import { X, Building2, Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { EmpresaTenant, BankProvider } from '../types';
import { BANKS } from '../utils/financeEngine';
import { obterDadosEmpresaBling } from '../services/blingService';
import { BLING_DEFAULT_CLIENT_ID } from '../utils/blingApi';

interface AddEmpresaModalProps {
  onClose: () => void;
  onAddEmpresa: (empresa: EmpresaTenant) => void;
}

export const AddEmpresaModal: React.FC<AddEmpresaModalProps> = ({
  onClose,
  onAddEmpresa,
}) => {
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState(BLING_DEFAULT_CLIENT_ID);
  const [clientSecret, setClientSecret] = useState('');
  const [bancoPadrao, setBancoPadrao] = useState<BankProvider>('inter');

  // Dados cadastrais (preenchidos manualmente ou puxados da API do Bling)
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');

  const [isLoadingBling, setIsLoadingBling] = useState(false);
  const [blingFeedback, setBlingFeedback] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);

  // Puxa dados automaticamente da API v3 do Bling
  const handlePuxarDadosBling = async () => {
    const tokenParaUsar = token.trim();
    if (!tokenParaUsar) {
      setBlingFeedback({
        tipo: 'erro',
        mensagem: 'Informe o Token de Acesso do Bling para consultar os dados automaticamente.',
      });
      return;
    }

    setIsLoadingBling(true);
    setBlingFeedback(null);

    try {
      const res = await obterDadosEmpresaBling(tokenParaUsar);
      if (res.success) {
        if (res.razaoSocial) setRazaoSocial(res.razaoSocial);
        if (res.nomeFantasia) setNomeFantasia(res.nomeFantasia);
        if (res.cnpj) setCnpj(res.cnpj);
        if (res.inscricaoEstadual) setInscricaoEstadual(res.inscricaoEstadual);
        if (res.cidade) setCidade(res.cidade);
        if (res.uf) setUf(res.uf);
        if (res.logradouro) setLogradouro(res.logradouro);
        if (res.numero) setNumero(res.numero);
        if (res.bairro) setBairro(res.bairro);
        if (res.cep) setCep(res.cep);

        setBlingFeedback({
          tipo: 'sucesso',
          mensagem: res.mensagem || 'Dados cadastrais extraídos com sucesso do Bling!',
        });
      } else {
        setBlingFeedback({
          tipo: 'erro',
          mensagem: res.mensagem || 'Não foi possível extrair dados automaticamente. Você pode preencher manualmente abaixo.',
        });
      }
    } catch (err: any) {
      setBlingFeedback({
        tipo: 'erro',
        mensagem: err.message || 'Erro ao conectar à API do Bling.',
      });
    } finally {
      setIsLoadingBling(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nomeFinal = nomeFantasia.trim() || razaoSocial.trim() || 'Nova Empresa';
    const razaoFinal = razaoSocial.trim() || nomeFinal;

    const cores = ['blue', 'emerald', 'indigo', 'purple', 'amber', 'rose'];
    const corAvatar = cores[Math.floor(Math.random() * cores.length)];

    const novaEmpresa: EmpresaTenant = {
      id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      razaoSocial: razaoFinal,
      nomeFantasia: nomeFinal,
      cnpj: cnpj.trim(),
      inscricaoEstadual: inscricaoEstadual.trim(),
      logradouro: logradouro.trim(),
      numero: numero.trim(),
      bairro: bairro.trim(),
      cidade: cidade.trim() || 'São Paulo',
      uf: uf.trim().toUpperCase() || 'SP',
      cep: cep.trim(),
      regimeTributario: 'Simples Nacional',
      certificadoA1Valido: true,

      blingClientId: clientId.trim(),
      blingClientSecret: clientSecret.trim(),
      blingAccessToken: token.trim(),
      isBlingConectado: Boolean(token.trim()),
      ultimaSincronizacao: new Date().toISOString(),

      bancoPadrao,
      corAvatar,
      criadoEm: new Date().toISOString(),
    };

    onAddEmpresa(novaEmpresa);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">Conectar Nova Empresa (Bling)</h2>
              <p className="text-[11px] text-blue-100/90 leading-tight">Adicione um novo CNPJ ao seu painel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Sessão 1: Credenciais do Bling */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>🔑</span> Credenciais da Conta Bling
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                API v3
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Token de Acesso do Bling (Bearer Token)
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Cole o access_token gerado para esta empresa..."
                className="w-full text-xs font-mono bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                  Client ID (Opcional)
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="ID da aplicação Bling"
                  className="w-full text-[11px] font-mono bg-white text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                  Client Secret (Opcional)
                </label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Secret da aplicação"
                  className="w-full text-[11px] font-mono bg-white text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Botão de Puxar Automaticamente */}
            <button
              type="button"
              onClick={handlePuxarDadosBling}
              disabled={isLoadingBling || !token.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingBling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Consultando dados no Bling...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Puxar Dados da Empresa do Bling Automaticamente</span>
                </>
              )}
            </button>

            {blingFeedback && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                  blingFeedback.tipo === 'sucesso'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {blingFeedback.tipo === 'sucesso' ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <span>{blingFeedback.mensagem}</span>
              </div>
            )}
          </div>

          {/* Sessão 2: Universo Bancário da Empresa */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/90 space-y-2">
            <label className="text-xs font-bold text-slate-800 block">
              🏦 Banco Emissor Padrão desta Empresa (Boletos & Pix)
            </label>
            <p className="text-[11px] text-slate-500">
              Cada empresa opera com seu próprio banco para emissão de cobranças.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {Object.values(BANKS).map((banco) => (
                <button
                  key={banco.id}
                  type="button"
                  onClick={() => setBancoPadrao(banco.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition ${
                    bancoPadrao === banco.id
                      ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white/60 border-slate-200 hover:bg-white text-slate-700'
                  }`}
                >
                  <span className="text-base">{banco.logoIcon}</span>
                  <div>
                    <span className="text-xs font-bold block text-slate-900 leading-tight">
                      {banco.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Cód: {banco.code}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sessão 3: Dados Cadastrais */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-800 block">
              🏢 Dados Cadastrais da Empresa (Pré-preenchidos ou Manuais)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nome Fantasia *
                </label>
                <input
                  type="text"
                  required
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  placeholder="Ex: Minha Empresa Filial"
                  className="w-full text-xs bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Ex: Minha Empresa Comercio LTDA"
                  className="w-full text-xs bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  CNPJ *
                </label>
                <input
                  type="text"
                  required
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full text-xs bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Inscrição Estadual
                </label>
                <input
                  type="text"
                  value={inscricaoEstadual}
                  onChange={(e) => setInscricaoEstadual(e.target.value)}
                  placeholder="Ex: 110.829.391.002"
                  className="w-full text-xs bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: São Paulo"
                  className="w-full text-xs bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  UF
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                  placeholder="SP"
                  className="w-full text-xs bg-white text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                />
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Salvar e Conectar Empresa</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
