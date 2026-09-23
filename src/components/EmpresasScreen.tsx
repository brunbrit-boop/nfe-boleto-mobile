import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Sparkles,
  ArrowRight,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Search,
  X,
  MapPin,
  Copy,
  Check,
  Layers,
  CreditCard,
  Key,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';
import type { EmpresaTenant, BankProvider } from '../types';
import { BANKS } from '../utils/financeEngine';
import { ApiKeysModal } from './ApiKeysModal';

interface EmpresasScreenProps {
  empresas: EmpresaTenant[];
  onSelectEmpresa: (empresa: EmpresaTenant) => void;
  onOpenAddEmpresa: () => void;
  onDeleteEmpresa: (empresaId: string) => void;
  onSyncEmpresa?: (empresa: EmpresaTenant) => Promise<void>;
  onDisconnectBling?: (empresaId: string) => void;
  onUpdateEmpresaBanco?: (empresaId: string, banco: BankProvider) => void;
}

export const EmpresasScreen: React.FC<EmpresasScreenProps> = ({
  empresas,
  onSelectEmpresa,
  onOpenAddEmpresa,
  onDeleteEmpresa,
  onSyncEmpresa,
  onDisconnectBling,
  onUpdateEmpresaBanco,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [copiedCnpjId, setCopiedCnpjId] = useState<string | null>(null);
  const [selectedEmpresaForBanks, setSelectedEmpresaForBanks] = useState<EmpresaTenant | null>(null);
  const [isApiKeysOpen, setIsApiKeysOpen] = useState(false);

  // Modal para Ativar Bling em empresa existente
  const [empresaParaAtivarBling, setEmpresaParaAtivarBling] = useState<EmpresaTenant | null>(null);
  const [linkOuCidModal, setLinkOuCidModal] = useState('');
  const [secretModal, setSecretModal] = useState('');
  const [showSecretModal, setShowSecretModal] = useState(false);

  const getGradientByCor = (cor?: string) => {
    switch (cor) {
      case 'emerald':
        return 'from-emerald-500 to-teal-600 text-white shadow-emerald-500/20';
      case 'indigo':
        return 'from-indigo-500 to-blue-600 text-white shadow-indigo-500/20';
      case 'purple':
        return 'from-purple-500 to-pink-600 text-white shadow-purple-500/20';
      case 'amber':
        return 'from-amber-400 to-orange-500 text-white shadow-amber-500/20';
      case 'rose':
        return 'from-rose-500 to-red-600 text-white shadow-rose-500/20';
      default:
        return 'from-emerald-500 to-teal-600 text-slate-950 shadow-emerald-500/20';
    }
  };

  const getIniciais = (nome: string) => {
    if (!nome) return 'EM';
    const partes = nome.trim().split(' ');
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  };

  const handleSync = async (e: React.MouseEvent, emp: EmpresaTenant) => {
    e.stopPropagation();
    if (!onSyncEmpresa) return;
    setSyncingId(emp.id);
    try {
      await onSyncEmpresa(emp);
    } finally {
      setSyncingId(null);
    }
  };

  const handleCopyCnpj = (e: React.MouseEvent, empId: string, cnpj?: string) => {
    e.stopPropagation();
    if (!cnpj) return;
    navigator.clipboard.writeText(cnpj);
    setCopiedCnpjId(empId);
    setTimeout(() => setCopiedCnpjId(null), 1800);
  };

  const handleSelectBanco = (empId: string, bancoKey: BankProvider) => {
    if (onUpdateEmpresaBanco) {
      onUpdateEmpresaBanco(empId, bancoKey);
    }
    if (selectedEmpresaForBanks && selectedEmpresaForBanks.id === empId) {
      setSelectedEmpresaForBanks({
        ...selectedEmpresaForBanks,
        bancoPadrao: bancoKey,
      });
    }
  };

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

  const handleAbrirConectarBling = (empresa: EmpresaTenant) => {
    // Se a empresa já tem Client ID e Secret configurados, pode ir direto
    if (empresa.blingClientId && empresa.blingClientSecret) {
      localStorage.setItem('bling_oauth_pending_empresa_id', empresa.id);
      localStorage.setItem('bling_client_id', empresa.blingClientId);
      localStorage.setItem('bling_client_secret', empresa.blingClientSecret);
      window.location.href = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${empresa.blingClientId}&state=${empresa.id}`;
      return;
    }

    setEmpresaParaAtivarBling(empresa);
    setLinkOuCidModal(empresa.blingClientId || '');
    setSecretModal(empresa.blingClientSecret || '');
  };

  const handleConfirmarConexaoBling = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaParaAtivarBling) return;

    const cid = extrairClientId(linkOuCidModal);
    const sec = secretModal.trim();

    if (!cid) {
      alert('Por favor, cole o Link de Convite ou o Client ID da sua empresa no Bling.');
      return;
    }
    if (!sec) {
      alert('Por favor, cole o Client Secret gerado no painel do Bling.');
      return;
    }

    const rawList = localStorage.getItem('nfe_empresas_list');
    if (rawList) {
      try {
        const lista: EmpresaTenant[] = JSON.parse(rawList);
        const atualizadas = lista.map((item) =>
          item.id === empresaParaAtivarBling.id
            ? { ...item, blingClientId: cid, blingClientSecret: sec }
            : item
        );
        localStorage.setItem('nfe_empresas_list', JSON.stringify(atualizadas));
      } catch {}
    }

    // Salva credenciais isoladas por ID da empresa para não contaminar a empresa ativa
    localStorage.setItem('bling_oauth_pending_empresa_id', empresaParaAtivarBling.id);
    localStorage.setItem(
      `bling_pending_${empresaParaAtivarBling.id}`,
      JSON.stringify({ clientId: cid, clientSecret: sec })
    );

    window.location.href = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${cid}&state=${empresaParaAtivarBling.id}`;
  };

  // Filtragem de empresas por busca
  const empresasFiltradas = empresas.filter((emp) => {
    const term = searchTerm.toLowerCase();
    const nome = (emp.nomeFantasia || emp.razaoSocial || '').toLowerCase();
    const razao = (emp.razaoSocial || '').toLowerCase();
    const cnpj = (emp.cnpj || '').replace(/\D/g, '');
    const cidade = (emp.cidade || '').toLowerCase();

    return (
      nome.includes(term) ||
      razao.includes(term) ||
      cnpj.includes(term.replace(/\D/g, '')) ||
      cidade.includes(term)
    );
  });

  const blingsAtivos = empresas.filter((e) => e.isBlingConectado).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c1a15] text-slate-900 dark:text-white flex flex-col font-['Manrope',sans-serif] transition-colors duration-200">
      {/* Top Header Estilo BT Business Suite */}
      <header className="h-16 px-4 md:px-8 bg-white dark:bg-[#10221c] border-b border-slate-200 dark:border-[#1a382e] flex items-center justify-between sticky top-0 z-30 shadow-sm">
        {/* Esquerda: Logo BT Business + Título do Hub (Clicável para abrir Configurações & Chaves de API) */}
        <button
          onClick={() => setIsApiKeysOpen(true)}
          className="flex items-center gap-3 group text-left cursor-pointer hover:opacity-95 transition-opacity"
          title="Clique para abrir Configurações de API & Google Gemini"
        >
          <div className="relative flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#11d493] ring-2 ring-white dark:ring-[#10221c] animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none group-hover:text-[#11d493] transition-colors">
                BT Business Hub
              </h1>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-[#11d493] border border-emerald-500/20">
                Multi-Empresas
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5 flex items-center gap-1">
              <span>Gestão Financeira & Robô Fiscal Bling ERP</span>
              <span className="text-[10px] text-emerald-600 dark:text-[#11d493] font-bold">• Chaves de API</span>
            </p>
          </div>
        </button>

        {/* Direita: Botões de Ação */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => {
              if (confirm('Deseja limpar todo o cache e tokens do Bling para começar do zero com conexões 100% limpas?')) {
                localStorage.removeItem('nfe_empresas_list');
                localStorage.removeItem('nfe_empresa_ativa_id');
                localStorage.removeItem('bling_client_id');
                localStorage.removeItem('bling_client_secret');
                localStorage.removeItem('bling_access_token');
                localStorage.removeItem('bling_refresh_token');
                localStorage.removeItem('bling_expires_at');
                localStorage.removeItem('bling_config');
                localStorage.removeItem('bling_oauth_pending_empresa_id');
                localStorage.removeItem('bling_auth_code');
                window.location.href = window.location.origin;
              }
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800/30 transition-all cursor-pointer"
            title="Limpar todo o cache e tokens antigos do Bling para começar limpo"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Resetar Cache</span>
          </button>

          <button
            onClick={() => setIsApiKeysOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162f27] hover:bg-slate-200 dark:hover:bg-[#1f4236] border border-slate-200 dark:border-[#214739] transition-all cursor-pointer"
            title="Configurações & Chaves de API (Google Gemini)"
          >
            <Key className="w-3.5 h-3.5 text-[#11d493]" />
            <span className="hidden sm:inline">Chaves de API</span>
          </button>

          <button
            onClick={onOpenAddEmpresa}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#11d493] hover:bg-[#0eb880] active:scale-95 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.8]" />
            <span>Adicionar Empresa</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal em Largura Ampla */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-8 py-6 space-y-6">
        {/* Painel de Métricas & Boas-Vindas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Empresas Cadastradas */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-1">
                Empresas no Grupo
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {empresas.length}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {empresas.length === 1 ? 'cadastrada' : 'cadastradas'}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Building2 className="w-6 h-6 stroke-[2.2]" />
            </div>
          </div>

          {/* Card 2: Blings Ativos / Conectados */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-1">
                Conexões Bling ERP
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#11d493] tracking-tight">
                  {blingsAtivos} / {empresas.length}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  {blingsAtivos === empresas.length ? '100% Online' : 'Parcial'}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-[#11d493] flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
            </div>
          </div>

          {/* Card 3: Bancos & Conciliação */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] shadow-sm flex items-center justify-between sm:col-span-3 lg:col-span-1">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 block mb-1">
                Ambientes & Universos
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
                  100%
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Isolados & Seguros
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Layers className="w-6 h-6 stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Linha de Busca & Controles */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Razão Social, Fantasia, CNPJ ou Cidade..."
              className="w-full bg-white dark:bg-[#10221c] text-slate-800 dark:text-slate-100 placeholder-slate-400 text-xs pl-10 pr-9 py-3 rounded-xl border border-slate-200 dark:border-[#1a382e] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#11d493]/30 focus:border-[#11d493] transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium self-end sm:self-center">
            Exibindo <span className="font-bold text-slate-900 dark:text-white">{empresasFiltradas.length}</span> de <span className="font-bold text-slate-900 dark:text-white">{empresas.length}</span> empresas
          </div>
        </div>

        {/* Grid de Cards de Empresas Dimensionado em 2 a 3 Colunas no Desktop */}
        {empresas.length === 0 ? (
          <div className="bg-white dark:bg-[#10221c] rounded-2xl p-12 text-center border border-slate-200 dark:border-[#1a382e] shadow-sm space-y-4 my-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-[#11d493] flex items-center justify-center mx-auto border border-emerald-500/20 shadow-sm">
              <Building2 className="w-8 h-8 stroke-[2]" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Nenhuma empresa conectada ao Hub
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Adicione seu primeiro Bling ERP. O sistema puxará automaticamente a Razão Social, CNPJ e configurará o ecossistema completo de gestão financeira e robô fiscal.
              </p>
            </div>
            <button
              onClick={onOpenAddEmpresa}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs text-slate-950 bg-[#11d493] hover:bg-[#0eb880] shadow-lg shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.8]" />
              <span>Conectar Primeira Empresa</span>
            </button>
          </div>
        ) : empresasFiltradas.length === 0 ? (
          <div className="bg-white dark:bg-[#10221c] rounded-2xl p-10 text-center border border-slate-200 dark:border-[#1a382e] shadow-sm space-y-3">
            <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Nenhuma empresa encontrada
            </h4>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Não encontramos resultados para o termo "{searchTerm}".
            </p>
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs font-bold text-[#11d493] hover:underline pt-1"
            >
              Limpar termo de busca
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {empresasFiltradas.map((empresa) => {
              const banco = BANKS[empresa.bancoPadrao] || BANKS.inter;
              const gradiente = getGradientByCor(empresa.corAvatar);
              const iniciais = getIniciais(empresa.nomeFantasia || empresa.razaoSocial);
              const isSyncing = syncingId === empresa.id;
              const isCopied = copiedCnpjId === empresa.id;

              return (
                <div
                  key={empresa.id}
                  onClick={() => onSelectEmpresa(empresa)}
                  className="bg-white dark:bg-[#10221c] rounded-2xl border border-slate-200 dark:border-[#1a382e] shadow-sm hover:shadow-md hover:border-[#11d493]/50 dark:hover:border-[#11d493]/60 transition-all duration-200 overflow-hidden flex flex-col justify-between cursor-pointer group"
                >
                  <div className="p-5 space-y-4">
                    {/* Header do Card: Avatar Squircle + Títulos + Ações */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Avatar Squircle Amplo */}
                        <div
                          className={`w-13 h-13 rounded-2xl bg-gradient-to-tr ${gradiente} flex items-center justify-center font-black text-base shadow-md ring-2 ring-slate-100 dark:ring-[#162f27] shrink-0`}
                        >
                          {iniciais}
                        </div>

                        {/* Nomes & Status */}
                        <div className="min-w-0">
                          <h3 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-white group-hover:text-[#11d493] transition-colors leading-tight truncate">
                            {empresa.nomeFantasia || empresa.razaoSocial}
                          </h3>

                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium mt-0.5">
                            {empresa.razaoSocial || 'Razão Social não informada'}
                          </p>

                          <div className="mt-2.5 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                            {empresa.isBlingExpirado || (empresa.blingTokenExpiresAt && Date.now() > empresa.blingTokenExpiresAt && !empresa.blingRefreshToken) ? (
                              <button
                                type="button"
                                onClick={() => handleAbrirConectarBling(empresa)}
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-sm shadow-amber-500/30 transition-all duration-150 active:scale-95 cursor-pointer animate-pulse"
                                title="O token do Bling expirou (validade de 6h). Clique para reconectar agora com 1 clique!"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>⚠️ Token Expirado • Reconectar</span>
                              </button>
                            ) : empresa.isBlingConectado ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleAbrirConectarBling(empresa)}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-[#11d493] border border-emerald-500/25 hover:bg-emerald-500/20 transition cursor-pointer"
                                  title="A integração do Bling ERP já está ativa. Clique caso queira renovar a conexão."
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#11d493] animate-pulse" />
                                  <span>✓ Bling Ativo</span>
                                </button>
                                {onDisconnectBling && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Deseja desconectar a integração do Bling da empresa "${empresa.nomeFantasia || empresa.razaoSocial}"?`)) {
                                        onDisconnectBling(empresa.id);
                                      }
                                    }}
                                    className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline px-1.5 py-0.5 rounded transition cursor-pointer"
                                    title="Desconectar Bling desta empresa"
                                  >
                                    Desconectar
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAbrirConectarBling(empresa)}
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm shadow-emerald-600/30 transition-all duration-150 active:scale-95 cursor-pointer"
                                title="Conectar aplicativo do Bling para sincronizar notas, clientes e produtos"
                              >
                                <Sparkles className="w-3 h-3 text-amber-300" />
                                <span>⚡ Ativar Bling</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação Secundária (Sincronizar & Excluir) */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {empresa.blingAccessToken && onSyncEmpresa && (
                          <button
                            onClick={(e) => handleSync(e, empresa)}
                            disabled={isSyncing}
                            className="p-2 rounded-xl text-slate-400 hover:text-[#11d493] hover:bg-emerald-500/10 transition active:scale-95"
                            title="Atualizar dados cadastrais via API do Bling"
                          >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#11d493]' : ''}`} />
                          </button>
                        )}

                        {empresas.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Deseja remover a empresa "${empresa.nomeFantasia || empresa.razaoSocial}" deste dispositivo?`)) {
                                onDeleteEmpresa(empresa.id);
                              }
                            }}
                            className="p-2 rounded-xl text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 transition active:scale-95"
                            title="Remover esta empresa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadados: CNPJ, Localidade e Bancos */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#1a382e]/80">
                      {/* CNPJ com Cópia Rápida */}
                      <div
                        onClick={(e) => handleCopyCnpj(e, empresa.id, empresa.cnpj)}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#162f27]/50 hover:bg-slate-100 dark:hover:bg-[#162f27] transition border border-slate-200/60 dark:border-[#214739] cursor-pointer flex items-center justify-between"
                        title="Clique para copiar o CNPJ"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                            CNPJ (Bling ERP)
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-xs truncate block">
                            {empresa.cnpj || 'Importando do Bling...'}
                          </span>
                        </div>
                        <div className="pl-2 shrink-0">
                          {isCopied ? (
                            <span className="text-[#11d493] text-[10px] font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Copiado!
                            </span>
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
                          )}
                        </div>
                      </div>

                      {/* Localidade e Bancos (Clicável) */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Localidade */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#162f27]/50 border border-slate-200/60 dark:border-[#214739]">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                            Localidade
                          </span>
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {empresa.cidade ? `${empresa.cidade}/${empresa.uf || 'SP'}` : 'Brasil'}
                            </span>
                          </div>
                        </div>

                        {/* Bancos (Clickável para abrir lista de contas) */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmpresaForBanks(empresa);
                          }}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#162f27]/50 hover:bg-emerald-500/10 dark:hover:bg-[#162f27] border border-slate-200/60 dark:border-[#214739] cursor-pointer transition group/bank flex items-center justify-between"
                          title="Clique para ver os bancos cadastrados nesta empresa"
                        >
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                              Bancos
                            </span>
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                              <span className="text-xs">{banco.logoIcon}</span>
                              <span className="truncate group-hover/bank:text-[#11d493]">{banco.name}</span>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-[#11d493] bg-emerald-500/10 px-1.5 py-0.5 rounded-md shrink-0 ml-1">
                            Ver ▾
                          </span>
                        </div>
                      </div>

                      {/* Novos Blocos: Situação Cadastral & Apontamentos em Órgãos de Crédito */}
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        {/* Situação Cadastral */}
                        <div className="p-2.5 rounded-xl bg-emerald-500/5 dark:bg-[#162f27]/30 border border-emerald-500/20 dark:border-[#214739]">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                            Situação Cadastral
                          </span>
                          <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-[#11d493] text-[11px] truncate">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#11d493] shrink-0" />
                            <span className="truncate">
                              {empresa.situacaoCadastral || (empresa.cnpj ? 'Ativa na Receita' : 'Pendente Bling')}
                            </span>
                          </div>
                        </div>

                        {/* Apontamentos em Órgãos de Crédito */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#162f27]/30 border border-slate-200/60 dark:border-[#214739]">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
                            Órgãos de Crédito
                          </span>
                          <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200 text-[11px] truncate">
                            <span className="text-[10px]">🛡️</span>
                            <span className="truncate">
                              {empresa.apontamentosCredito?.mensagem || (empresa.cnpj ? 'Sem Apontamentos' : 'Aguardando API')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status de Sincronização Progressiva com Bling */}
                      {empresa.statusSincronizacao?.emAndamento ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 animate-pulse"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 truncate">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-500" />
                              <span className="truncate">A empresa está sendo atualizada...</span>
                            </span>
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0 ml-1">
                              {empresa.statusSincronizacao.progresso || 20}%
                            </span>
                          </div>

                          <div className="w-full bg-slate-200 dark:bg-[#162f27] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-300 rounded-full"
                              style={{ width: `${empresa.statusSincronizacao.progresso || 20}%` }}
                            />
                          </div>

                          <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium truncate">
                            {empresa.statusSincronizacao.etapaAtual || 'Processando dados por etapas no Bling...'}
                          </p>
                        </div>
                      ) : empresa.isBlingConectado ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2.5 px-3 py-2 rounded-xl bg-emerald-500/5 dark:bg-[#162f27]/40 border border-emerald-500/20 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Check className="w-3.5 h-3.5 text-[#11d493] shrink-0" />
                            <span className="text-slate-600 dark:text-slate-300 font-medium text-[11px] truncate">
                              {empresa.statusSincronizacao?.totalProdutos !== undefined
                                ? `${empresa.statusSincronizacao.totalProdutos} produtos • ${empresa.statusSincronizacao.totalClientes || 0} clientes`
                                : 'Dados do Bling salvos no app'}
                            </span>
                          </div>
                          {onSyncEmpresa && (
                            <button
                              type="button"
                              disabled={isSyncing}
                              onClick={(e) => handleSync(e, empresa)}
                              className="text-[10px] font-bold text-[#11d493] hover:underline shrink-0 ml-2 cursor-pointer flex items-center gap-1"
                              title="Atualizar dados do Bling em segundo plano"
                            >
                              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                              <span>Atualizar</span>
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Botão de Acesso Estilo BT Business */}
                  <div className="px-5 pb-5 pt-1">
                    <button
                      onClick={() => onSelectEmpresa(empresa)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs text-slate-950 bg-[#11d493] hover:bg-[#0eb880] shadow-md shadow-emerald-500/10 transition-all duration-200 active:scale-[0.99]"
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-slate-950" />
                        <span>Acessar Painel desta Empresa</span>
                      </span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Lista de Bancos Cadastrados da Empresa */}
      {selectedEmpresaForBanks && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-[#214739] space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#11d493]" />
                  <h3 className="text-base font-black text-gray-900 dark:text-white">
                    Bancos Cadastrados
                  </h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {selectedEmpresaForBanks.nomeFantasia || selectedEmpresaForBanks.razaoSocial}
                </p>
              </div>
              <button
                onClick={() => setSelectedEmpresaForBanks(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Selecione o Banco Emissor Padrão
              </span>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {Object.values(BANKS).map((b) => {
                  const isSelected = selectedEmpresaForBanks.bancoPadrao === b.id;

                  return (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBanco(selectedEmpresaForBanks.id, b.id as BankProvider)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-500/10 border-[#11d493] text-gray-900 dark:text-white ring-1 ring-[#11d493]'
                          : 'bg-gray-50 dark:bg-[#10221c] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{b.logoIcon}</span>
                        <div>
                          <span className="text-xs font-bold block leading-tight">
                            {b.name}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Cód: {b.code} • Boletos e Pix
                          </span>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#11d493] text-slate-950">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Ativo</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 hover:text-white font-medium">
                          Selecionar
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-[#214739]">
              <button
                onClick={() => setSelectedEmpresaForBanks(null)}
                className="px-4 py-2 text-xs font-bold bg-[#11d493] text-slate-950 rounded-xl hover:bg-[#0eb880]"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rápido de Ativação do Bling para Empresa Existente */}
      {empresaParaAtivarBling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#10221c] text-slate-900 dark:text-white w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#1a382e] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-inner">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold leading-tight">Ativar Bling na Empresa</h2>
                  <p className="text-[11px] text-emerald-100/90 leading-tight">
                    {empresaParaAtivarBling.nomeFantasia || empresaParaAtivarBling.razaoSocial}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEmpresaParaAtivarBling(null)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmarConexaoBling} className="p-5 space-y-4">
              <div className="bg-slate-50 dark:bg-[#162f27] rounded-xl p-4 border border-slate-200/90 dark:border-[#214739] space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Link de convite do Bling <span className="text-emerald-600 font-normal">(ou Client ID)</span>
                  </label>
                  <input
                    type="text"
                    value={linkOuCidModal}
                    onChange={(e) => setLinkOuCidModal(e.target.value)}
                    placeholder="Cole aqui o Link de convite do Bling..."
                    required
                    className="w-full text-xs font-mono bg-white dark:bg-[#10221c] text-slate-800 dark:text-slate-100 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#214739] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Client Secret
                    </label>
                    <span className="text-[10px] text-slate-400">Senha secreta do aplicativo</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showSecretModal ? 'text' : 'password'}
                      value={secretModal}
                      onChange={(e) => setSecretModal(e.target.value)}
                      placeholder="Cole aqui o Client Secret do Bling..."
                      required
                      className="w-full text-xs font-mono bg-white dark:bg-[#10221c] text-slate-800 dark:text-slate-100 px-3 py-2 pr-9 rounded-xl border border-slate-200 dark:border-[#214739] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretModal(!showSecretModal)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showSecretModal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  💡 O sistema abrirá a página oficial de autorização do Bling para esta empresa e vinculará o token automaticamente!
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

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-[#214739]">
                <button
                  type="button"
                  onClick={() => setEmpresaParaAtivarBling(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 rounded-xl shadow-md shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Conectar e Autorizar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Chaves de API (Google Gemini & IA) */}
      <ApiKeysModal
        isOpen={isApiKeysOpen}
        onClose={() => setIsApiKeysOpen(false)}
      />

      {/* Rodapé Executivo */}
      <footer className="text-center py-4 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-[#1a382e] bg-white dark:bg-[#10221c]">
        <p>BT Business Suite • Integração Direta com API v3 do Bling ERP</p>
      </footer>
    </div>
  );
};
