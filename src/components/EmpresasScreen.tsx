import React, { useState } from 'react';
import { Building2, Plus, Sparkles, ArrowRight, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Search, X, MapPin, Copy, Check } from 'lucide-react';
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
        return 'from-emerald-500 to-teal-600 text-white';
      case 'indigo':
        return 'from-indigo-500 to-blue-600 text-white';
      case 'purple':
        return 'from-purple-500 to-pink-600 text-white';
      case 'amber':
        return 'from-amber-400 to-orange-500 text-white';
      case 'rose':
        return 'from-rose-500 to-red-600 text-white';
      default:
        return 'from-blue-500 to-cyan-600 text-white';
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header Harmonizado com o Resto do App */}
      <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 py-2.5 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          {/* Robô Avatar & Identidade do Hub */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shadow-md shadow-blue-500/20 ring-2 ring-blue-100">
                <Sparkles className="w-4 h-4 text-white stroke-[2.5]" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-extrabold text-slate-900 tracking-tight leading-none">
                  Hub Multi-Empresas
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {empresas.length} {empresas.length === 1 ? 'Empresa' : 'Empresas'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5 font-medium truncate max-w-[170px] sm:max-w-xs">
                Gestão & Robô Fiscal Bling ERP
              </p>
            </div>
          </div>

          {/* Botão de Adicionar Empresa */}
          <button
            onClick={onOpenAddEmpresa}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/20 transition shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Adicionar Empresa</span>
            <span className="sm:hidden">Nova</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-4 space-y-3.5 pb-12">
        {/* Mini Painel de Métricas & Boas-Vindas */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Building2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Cadastradas
              </span>
              <span className="text-sm font-black text-slate-800 leading-none">
                {empresas.length} {empresas.length === 1 ? 'Empresa' : 'Empresas'}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Bling Ativo
              </span>
              <span className="text-sm font-black text-emerald-700 leading-none">
                {blingsAtivos} {blingsAtivos === 1 ? 'Conectada' : 'Conectadas'}
              </span>
            </div>
          </div>
        </div>

        {/* Barra de Busca Rápida */}
        {empresas.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Nome, Fantasia, CNPJ ou Cidade..."
              className="w-full bg-white text-slate-800 placeholder-slate-400 text-xs pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Lista de Cards de Empresas */}
        {empresas.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 sm:p-10 text-center border border-slate-200 shadow-sm space-y-3.5 my-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100/80 shadow-sm">
              <Building2 className="w-7 h-7 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Nenhuma empresa conectada ainda
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Conecte seu Bling ERP para emitir Notas Fiscais, gerar Boletos com Pix e gerenciar Clientes em universos isolados.
              </p>
            </div>
            <button
              onClick={onOpenAddEmpresa}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Conectar Primeira Empresa</span>
            </button>
          </div>
        ) : empresasFiltradas.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm space-y-2">
            <Search className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-xs font-bold text-slate-700">Nenhuma empresa encontrada</h4>
            <p className="text-[11px] text-slate-400">
              Não encontramos resultados para "{searchTerm}".
            </p>
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs font-semibold text-blue-600 hover:underline pt-1"
            >
              Limpar busca
            </button>
          </div>
        ) : (
          <div className="space-y-3">
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
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 overflow-hidden cursor-pointer group"
                >
                  <div className="p-4 space-y-3">
                    {/* Header do Card com Avatar, Nomes e Ações */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar Squircle */}
                        <div
                          className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${gradiente} flex items-center justify-center font-black text-sm shadow-sm ring-2 ring-slate-100 shrink-0`}
                        >
                          {iniciais}
                        </div>

                        {/* Nomes e Status */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug truncate">
                              {empresa.nomeFantasia || empresa.razaoSocial}
                            </h3>

                            {empresa.isBlingConectado ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Bling Ativo</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                <span>Configurar</span>
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-500 truncate font-medium mt-0.5">
                            {empresa.razaoSocial || 'Razão Social não informada'}
                          </p>
                        </div>
                      </div>

                      {/* Ações Secundárias (Sincronizar & Excluir) */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {empresa.blingAccessToken && onSyncEmpresa && (
                          <button
                            onClick={(e) => handleSync(e, empresa)}
                            disabled={isSyncing}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition active:scale-95"
                            title="Atualizar dados cadastrais diretamente do Bling"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
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
                            className="p-1.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition active:scale-95"
                            title="Remover esta empresa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Linha de Metadados: CNPJ, Localidade e Banco Emissor */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs border-t border-slate-100">
                      {/* CNPJ com Cópia Rápida */}
                      <div
                        onClick={(e) => handleCopyCnpj(e, empresa.id, empresa.cnpj)}
                        className="p-2 rounded-xl bg-slate-50/80 hover:bg-slate-100 transition border border-slate-100 cursor-pointer"
                        title="Clique para copiar o CNPJ"
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                          <span>CNPJ</span>
                          {isCopied ? (
                            <span className="text-emerald-600 text-[9px] font-bold flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Copiado!
                            </span>
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                        <span className="font-semibold text-slate-800 font-mono text-[11px] block truncate">
                          {empresa.cnpj || 'Não configurado'}
                        </span>
                      </div>

                      {/* Localidade */}
                      <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Localidade
                        </span>
                        <div className="flex items-center gap-1 font-semibold text-slate-800 text-[11px] truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {empresa.cidade ? `${empresa.cidade}/${empresa.uf}` : 'Brasil'}
                          </span>
                        </div>
                      </div>

                      {/* Banco Emissor */}
                      <div className="col-span-2 sm:col-span-1 p-2 rounded-xl bg-slate-50/80 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Banco Emissor
                        </span>
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-[11px] truncate">
                          <span className="text-xs">{banco.logoIcon}</span>
                          <span className="truncate">{banco.name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Botão de Acesso Principal Harmonizado */}
                    <button
                      onClick={() => onSelectEmpresa(empresa)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/10 transition-all duration-200 active:scale-[0.99]"
                    >
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-100" />
                        <span>Acessar Painel desta Empresa</span>
                      </span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Rodapé Harmonizado */}
      <footer className="text-center py-3 text-[11px] text-slate-400 border-t border-slate-200/80 bg-white">
        <p>Plataforma Multi-Bling ERP • Universos & Contas 100% Isolados</p>
      </footer>
    </div>
  );
};
