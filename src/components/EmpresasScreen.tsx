import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Sparkles,
  ArrowRight,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Search,
  X,
  MapPin,
  Copy,
  Check,
  Layers,
} from 'lucide-react';
import type { EmpresaTenant } from '../types';
import { BANKS } from '../utils/financeEngine';

interface EmpresasScreenProps {
  empresas: EmpresaTenant[];
  onSelectEmpresa: (empresa: EmpresaTenant) => void;
  onOpenAddEmpresa: () => void;
  onDeleteEmpresa: (empresaId: string) => void;
  onSyncEmpresa?: (empresa: EmpresaTenant) => Promise<void>;
}

export const EmpresasScreen: React.FC<EmpresasScreenProps> = ({
  empresas,
  onSelectEmpresa,
  onOpenAddEmpresa,
  onDeleteEmpresa,
  onSyncEmpresa,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [copiedCnpjId, setCopiedCnpjId] = useState<string | null>(null);

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
        {/* Esquerda: Logo BT Business + Título do Hub */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#11d493] ring-2 ring-white dark:ring-[#10221c] animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">
                BT Business Hub
              </h1>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-[#11d493] border border-emerald-500/20">
                Multi-Empresas
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
              Gestão Financeira & Robô Fiscal Bling ERP
            </p>
          </div>
        </div>

        {/* Direita: Botão de Ação + Status Geral */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAddEmpresa}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#11d493] hover:bg-[#0eb880] active:scale-95 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.8]" />
            <span>Adicionar Empresa</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal em Largura Ampla (Desktop & Tablet & Mobile) */}
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

                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            {empresa.isBlingConectado ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#11d493] border border-emerald-500/20 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#11d493] animate-pulse" />
                                <span>Bling Ativo</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                <span>Configurar</span>
                              </span>
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

                    {/* Metadados: CNPJ, Localidade e Banco Emissor */}
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

                      {/* Localidade e Banco Emissor */}
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

                        {/* Banco Emissor */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#162f27]/50 border border-slate-200/60 dark:border-[#214739]">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                            Banco Emissor
                          </span>
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                            <span className="text-xs">{banco.logoIcon}</span>
                            <span className="truncate">{banco.name}</span>
                          </div>
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

      {/* Rodapé Executivo */}
      <footer className="text-center py-4 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-[#1a382e] bg-white dark:bg-[#10221c]">
        <p>BT Business Suite • Integração Direta com API v3 do Bling ERP</p>
      </footer>
    </div>
  );
};
