import React from 'react';
import type { EmpresaTenant } from '../../types';
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Users,
  Mic,
  Settings,
  Building2,
  ArrowLeft,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export type BtMenuOption =
  | 'dashboard'
  | 'pagar'
  | 'receber'
  | 'conciliacao'
  | 'clientes'
  | 'robo'
  | 'config';

interface BtSidebarProps {
  empresa: EmpresaTenant;
  activeMenu: BtMenuOption;
  onSelectMenu: (menu: BtMenuOption) => void;
  onBackToEmpresas: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  totalPagarAberto?: number;
  totalReceberAberto?: number;
}

export const BtSidebar: React.FC<BtSidebarProps> = ({
  empresa,
  activeMenu,
  onSelectMenu,
  onBackToEmpresas,
  mobileOpen,
  onCloseMobile,
  totalPagarAberto = 0,
  totalReceberAberto = 0,
}) => {
  const menuItems: {
    id: BtMenuOption;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Visão Geral',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'pagar',
      label: 'Contas a Pagar',
      icon: <ArrowDownCircle className="w-5 h-5 text-rose-500" />,
      badge: totalPagarAberto > 0 ? `R$ ${Math.round(totalPagarAberto).toLocaleString('pt-BR')}` : undefined,
      badgeColor: 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
    },
    {
      id: 'receber',
      label: 'Contas a Receber',
      icon: <ArrowUpCircle className="w-5 h-5 text-[#11d493]" />,
      badge: totalReceberAberto > 0 ? `R$ ${Math.round(totalReceberAberto).toLocaleString('pt-BR')}` : undefined,
      badgeColor: 'bg-emerald-500/10 text-[#11d493] border border-emerald-500/20',
    },
    {
      id: 'conciliacao',
      label: 'Conciliação & Extrato',
      icon: <RefreshCw className="w-5 h-5 text-blue-500" />,
    },
    {
      id: 'clientes',
      label: 'Clientes & Parceiros',
      icon: <Users className="w-5 h-5 text-amber-500" />,
    },
    {
      id: 'robo',
      label: 'Robô Fiscal & Voz',
      icon: <Mic className="w-5 h-5 text-purple-400 animate-pulse" />,
      badge: 'IA',
      badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold',
    },
    {
      id: 'config',
      label: 'Configurações Bling',
      icon: <Settings className="w-5 h-5 text-slate-400" />,
    },
  ];

  return (
    <>
      {/* Backdrop para mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-white dark:bg-[#10221c] border-r border-slate-200 dark:border-[#1a382e]
          z-50 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:static lg:z-auto
        `}
      >
        {/* Header do BT Business com Logo */}
        <div className="h-16 px-5 border-b border-slate-100 dark:border-[#1a382e] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#11d493] to-emerald-700 flex items-center justify-center shadow-md shadow-[#11d493]/20">
              <span className="font-extrabold text-slate-950 text-base tracking-tight">BT</span>
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight flex items-center gap-1.5">
                BT Business
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-[#11d493]/20 text-[#11d493]">
                  ERP
                </span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Gestão & Conciliação</p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#162f27]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card da Empresa Ativa */}
        <div className="p-3 mx-3 mt-3 rounded-xl bg-slate-50 dark:bg-[#162f27]/70 border border-slate-200/80 dark:border-[#1e4236]">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-[#11d493] border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {empresa.nomeFantasia || empresa.razaoSocial}
              </p>
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                {empresa.cnpj || 'CNPJ não informado'}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {empresa.isBlingConectado ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-[#11d493]">
                    <CheckCircle2 className="w-3 h-3" />
                    Bling Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500">
                    <AlertCircle className="w-3 h-3" />
                    Bling Pendente
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Links de Navegação */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Módulos Financeiros
          </p>
          {menuItems.map((item) => {
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectMenu(item.id);
                  onCloseMobile();
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all
                  ${
                    isActive
                      ? 'bg-[#11d493]/15 text-slate-900 dark:text-[#11d493] shadow-sm border border-[#11d493]/30'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#162f27]'
                  }
                `}
              >
                <div className="flex items-center gap-3 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Rodapé: Botão Voltar para Empresas */}
        <div className="p-3 border-t border-slate-100 dark:border-[#1a382e] space-y-2">
          <button
            onClick={onBackToEmpresas}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#162f27] hover:bg-slate-200 dark:hover:bg-[#1d3d32] transition-colors border border-slate-200 dark:border-[#214739]"
          >
            <ArrowLeft className="w-4 h-4 text-[#11d493]" />
            <span>← Trocar de Empresa</span>
          </button>
        </div>
      </aside>
    </>
  );
};
