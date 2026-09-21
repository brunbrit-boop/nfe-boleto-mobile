import React, { useState } from 'react';
import { Building2, Plus, Sparkles, ArrowRight, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
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
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const getGradientByCor = (cor?: string) => {
    switch (cor) {
      case 'emerald':
        return 'from-emerald-600 to-teal-600';
      case 'indigo':
        return 'from-indigo-600 to-blue-600';
      case 'purple':
        return 'from-purple-600 to-pink-600';
      case 'amber':
        return 'from-amber-500 to-orange-600';
      case 'rose':
        return 'from-rose-500 to-red-600';
      default:
        return 'from-blue-600 to-cyan-600';
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header Executivo */}
      <header className="w-full bg-white border-b border-slate-200/90 px-4 py-3.5 shadow-sm sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shadow-md shadow-blue-500/20 ring-2 ring-blue-100">
              <Sparkles className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-none">
                Hub Multi-Empresas
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5 font-medium">
                Conecte e gerencie múltiplos Blings em um só lugar
              </p>
            </div>
          </div>

          <button
            onClick={onOpenAddEmpresa}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Empresa</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
        {/* Banner de Boas-vindas & Resumo */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 rounded-2xl p-4 text-white shadow-card flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 block mb-1">
              Plataforma Multi-Bling
            </span>
            <h2 className="text-base sm:text-lg font-black leading-snug">
              {empresas.length === 1
                ? '1 Empresa Conectada'
                : `${empresas.length} Empresas Conectadas`}
            </h2>
            <p className="text-xs text-blue-100 mt-0.5">
              Clique no card da empresa para abrir o Robô Fiscal, Clientes e Financeiro.
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Lista de Cards de Empresas */}
        {empresas.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-sm space-y-3 my-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Nenhuma empresa conectada ainda
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Conecte seu primeiro Bling ERP informando suas credenciais. O sistema puxará automaticamente a Razão Social e CNPJ.
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
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {empresas.map((empresa) => {
              const banco = BANKS[empresa.bancoPadrao] || BANKS.inter;
              const gradiente = getGradientByCor(empresa.corAvatar);
              const iniciais = getIniciais(empresa.nomeFantasia || empresa.razaoSocial);
              const isSyncing = syncingId === empresa.id;

              return (
                <div
                  key={empresa.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-card hover:shadow-card-hover transition overflow-hidden group"
                >
                  {/* Card Content */}
                  <div className="p-4 sm:p-5 space-y-3.5">
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div
                          className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${gradiente} flex items-center justify-center text-white font-black text-sm shadow-md ring-2 ring-white shrink-0`}
                        >
                          {iniciais}
                        </div>

                        {/* Títulos */}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                              {empresa.nomeFantasia || empresa.razaoSocial}
                            </h3>
                            {empresa.isBlingConectado ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>Bling Ativo</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                <span>Configurar</span>
                              </span>
                            )}

                            {/* Botão de Puxar/Atualizar Dados do Bling */}
                            {empresa.blingAccessToken && onSyncEmpresa && (
                              <button
                                onClick={(e) => handleSync(e, empresa)}
                                disabled={isSyncing}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition shrink-0 active:scale-95"
                                title="Importar Nome e CNPJ reais diretamente da API do Bling"
                              >
                                <RefreshCw className={`w-3 h-3 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
                                <span>{isSyncing ? 'Buscando...' : 'Importar do Bling'}</span>
                              </button>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-medium">
                            {empresa.razaoSocial}
                          </p>
                        </div>
                      </div>

                      {/* Botão de Excluir */}
                      {empresas.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Tem certeza que deseja remover ${empresa.nomeFantasia || empresa.razaoSocial}?`)) {
                              onDeleteEmpresa(empresa.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Remover esta empresa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Metadados: CNPJ, Localização e Banco */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs border-t border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          CNPJ
                        </span>
                        <span className="font-semibold text-slate-700 font-mono">
                          {empresa.cnpj || 'Importando do Bling...'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Localidade
                        </span>
                        <span className="font-semibold text-slate-700">
                          {empresa.cidade ? `${empresa.cidade}/${empresa.uf}` : 'Brasil'}
                        </span>
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Banco Emissor
                        </span>
                        <span className="font-semibold text-slate-700 inline-flex items-center gap-1">
                          <span>{banco.logoIcon}</span>
                          <span>{banco.name}</span>
                        </span>
                      </div>
                    </div>

                    {/* Botão de Acesso Principal */}
                    <button
                      onClick={() => onSelectEmpresa(empresa)}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-blue-600 text-white shadow-sm transition group-hover:bg-blue-600 active:scale-[0.99]"
                    >
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
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

      {/* Rodapé Informativo */}
      <footer className="text-center py-4 text-xs text-slate-400 border-t border-slate-200/80 bg-white">
        <p>Hub Multi-Empresas • Integrado à API v3 do Bling ERP</p>
      </footer>
    </div>
  );
};
