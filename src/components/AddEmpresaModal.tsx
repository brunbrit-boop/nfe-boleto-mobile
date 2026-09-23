import React, { useState } from 'react';
import { X, Building2, Sparkles, ShieldCheck, Eye, EyeOff, ArrowRight, LogOut } from 'lucide-react';
import type { EmpresaTenant } from '../types';

interface AddEmpresaModalProps {
  onClose: () => void;
  onAddEmpresa: (empresa: EmpresaTenant) => void;
}

export const AddEmpresaModal: React.FC<AddEmpresaModalProps> = ({
  onClose,
  onAddEmpresa,
}) => {
  const [linkOuClientId, setLinkOuClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [nomeOpcional, setNomeOpcional] = useState('');
  const [showManual, setShowManual] = useState(false);

  const [empresaId] = useState<string>(() => `emp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  // Extrai o client_id caso o usuário tenha colado a URL completa de convite
  const extrairClientId = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (trimmed.includes('client_id=')) {
      try {
        const url = new URL(trimmed);
        return url.searchParams.get('client_id') || trimmed;
      } catch {
        const match = trimmed.match(/[?&]client_id=([^&]+)/);
        return match ? match[1] : trimmed;
      }
    }
    return trimmed;
  };

  const clientIdDetectado = extrairClientId(linkOuClientId);

  // Inicia o fluxo de autorização no Bling diretamente com o Link e o Secret
  const handleConectarBling = (e: React.FormEvent) => {
    e.preventDefault();

    const cid = clientIdDetectado;
    const sec = clientSecret.trim();

    if (!cid) {
      alert('Por favor, cole o Link de Convite ou o Client ID da sua empresa no Bling.');
      return;
    }

    if (!sec) {
      alert('Por favor, cole o Client Secret gerado no painel do Bling.');
      return;
    }

    // Registra a empresa pendente com seu ID, Client ID e Client Secret
    const rawList = localStorage.getItem('nfe_empresas_list');
    let lista: EmpresaTenant[] = [];
    if (rawList) {
      try {
        lista = JSON.parse(rawList);
      } catch {}
    }

    const preCadastro: EmpresaTenant = {
      id: empresaId,
      razaoSocial: nomeOpcional.trim() || 'Aguardando Bling...',
      nomeFantasia: nomeOpcional.trim() || 'Nova Empresa Bling',
      cnpj: '00.000.000/0001-00',
      cidade: 'São Paulo',
      uf: 'SP',
      bancoPadrao: 'inter',
      corAvatar: 'emerald',
      regimeTributario: 'Simples Nacional',
      certificadoA1Valido: true,
      criadoEm: new Date().toISOString(),
      blingClientId: cid,
      blingClientSecret: sec,
      blingAccessToken: '',
      isBlingConectado: false,
    };

    lista.push(preCadastro);
    localStorage.setItem('nfe_empresas_list', JSON.stringify(lista));

    // Salva referências pendentes isoladas por empresa para não contaminar a empresa ativa
    localStorage.setItem('bling_oauth_pending_empresa_id', empresaId);
    localStorage.setItem(
      `bling_pending_${empresaId}`,
      JSON.stringify({ clientId: cid, clientSecret: sec })
    );

    // Redireciona para o OAuth oficial do Bling com o state amarrado à empresa
    const redirectUrl = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${cid}&state=${empresaId}`;
    window.location.href = redirectUrl;
  };

  // Criação manual alternativa sem o Bling
  const handleCriarManual = () => {
    const nomeFinal = nomeOpcional.trim() || 'Nova Empresa';
    const novaEmpresa: EmpresaTenant = {
      id: empresaId,
      razaoSocial: nomeFinal,
      nomeFantasia: nomeFinal,
      cnpj: '00.000.000/0001-00',
      cidade: 'São Paulo',
      uf: 'SP',
      bancoPadrao: 'inter',
      corAvatar: 'blue',
      regimeTributario: 'Simples Nacional',
      certificadoA1Valido: true,
      criadoEm: new Date().toISOString(),
      blingAccessToken: '',
      isBlingConectado: false,
    };

    onAddEmpresa(novaEmpresa);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#10221c] text-slate-900 dark:text-white w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#1a382e] shadow-2xl overflow-hidden flex flex-col">
        {/* Header Compacto */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">Adicionar Empresa via Bling</h2>
              <p className="text-[11px] text-emerald-100/90 leading-tight">
                Conecte a conta do Bling correspondente a este CNPJ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário Enxuto com apenas 2 campos */}
        <form onSubmit={handleConectarBling} className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <span>⚠️ Atenção se você tem mais de uma conta no Bling:</span>
            </span>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              Antes de clicar em conectar, certifique-se de fazer{' '}
              <a
                href="https://www.bling.com.br/logout.php"
                target="_blank"
                rel="noreferrer"
                className="underline font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500"
              >
                logout da outra conta no Bling (clique aqui)
              </a>{' '}
              para que a tela de autorização abra para o usuário desta nova empresa.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-[#162f27] rounded-xl p-4 border border-slate-200/90 dark:border-[#214739] space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Dados de Conexão do Bling</span>
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                OAuth 2.0
              </span>
            </div>

            {/* Campo 1: Link de Convite do Bling */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Link de convite do Bling <span className="text-emerald-600 font-normal">(ou Client ID)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={linkOuClientId}
                  onChange={(e) => setLinkOuClientId(e.target.value)}
                  placeholder="Cole aqui o Link de convite gerado no Bling..."
                  required
                  className="w-full text-xs font-mono bg-white dark:bg-[#10221c] text-slate-800 dark:text-slate-100 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#214739] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {clientIdDetectado && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-mono truncate">
                  <span>✓ Client ID detectado:</span>
                  <span className="font-bold truncate">{clientIdDetectado}</span>
                </p>
              )}
            </div>

            {/* Campo 2: Client Secret */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Client Secret
                </label>
                <span className="text-[10px] text-slate-400">Chave secreta do seu aplicativo</span>
              </div>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Cole aqui o Client Secret do Bling..."
                  required
                  className="w-full text-xs font-mono bg-white dark:bg-[#10221c] text-slate-800 dark:text-slate-100 px-3 py-2 pr-9 rounded-xl border border-slate-200 dark:border-[#214739] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Dica e Botão de Logout no Bling */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200 space-y-2">
              <p className="leading-relaxed">
                ⚠️ <strong>Atenção à sessão no Bling:</strong> Se o seu navegador ainda estiver com o site do Bling logado na <em>Empresa 1</em>, o Bling tentará autorizar a Empresa 1.
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <a
                  href="https://www.bling.com.br/logout.php"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold bg-white dark:bg-amber-900/50 hover:bg-amber-100 text-amber-900 dark:text-amber-100 rounded-lg border border-amber-300 dark:border-amber-700 shadow-sm transition"
                >
                  <LogOut className="w-3 h-3 text-amber-600" />
                  <span>🚪 Deslogar da conta atual no Bling</span>
                </a>
              </div>
            </div>
          </div>

          {/* Nome Opcional (caso queira adiantar) */}
          {showManual ? (
            <div className="p-3 bg-slate-50 dark:bg-[#162f27] rounded-xl border border-slate-200 dark:border-[#214739]">
              <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Nome ou Apelido da Empresa (Opcional)
              </label>
              <input
                type="text"
                value={nomeOpcional}
                onChange={(e) => setNomeOpcional(e.target.value)}
                placeholder="Ex: Minha Empresa Filial"
                className="w-full text-xs bg-white dark:bg-[#10221c] text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#214739] focus:outline-none"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer block text-center w-full"
            >
              + Deseja definir um apelido ou cadastrar sem o Bling?
            </button>
          )}

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-[#214739]">
            {showManual ? (
              <button
                type="button"
                onClick={handleCriarManual}
                className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#162f27] rounded-xl transition cursor-pointer"
              >
                Cadastrar sem Bling
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 rounded-xl shadow-md shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Conectar com 1 Clique</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
