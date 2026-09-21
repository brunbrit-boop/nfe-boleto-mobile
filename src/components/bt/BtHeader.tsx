import React from 'react';
import type { EmpresaTenant } from '../../types';
import type { BtMenuOption } from './BtSidebar';
import { Menu, RefreshCw, Building, ArrowLeft, Landmark } from 'lucide-react';

interface BtHeaderProps {
  empresa: EmpresaTenant;
  activeMenu: BtMenuOption;
  onOpenMobile: () => void;
  onBackToEmpresas: () => void;
  onRefreshBling: () => void;
  carregando: boolean;
}

const TITULOS_MENU: Record<BtMenuOption, { titulo: string; sub: string }> = {
  dashboard: { titulo: 'Visão Geral & Fluxo de Caixa', sub: 'Métricas e indicadores consolidados do Bling ERP' },
  pagar: { titulo: 'Contas a Pagar', sub: 'Despesas e títulos a liquidar no Bling' },
  receber: { titulo: 'Contas a Receber', sub: 'Cobranças, recebimentos e boletos emitidos' },
  conciliacao: { titulo: 'Conciliação Financeira', sub: 'Conferência bancária e cruzamento com extrato' },
  clientes: { titulo: 'Clientes & Parceiros', sub: 'Base cadastral e contatos sincronizados' },
  robo: { titulo: 'Robô Fiscal & Comandos por Voz', sub: 'Emissão rápida de NF-e e boletos bancários' },
  config: { titulo: 'Configurações da Empresa', sub: 'Parâmetros de conexão do Bling e dados bancários' },
};

export const BtHeader: React.FC<BtHeaderProps> = ({
  empresa,
  activeMenu,
  onOpenMobile,
  onBackToEmpresas,
  onRefreshBling,
  carregando,
}) => {
  const info = TITULOS_MENU[activeMenu] || TITULOS_MENU.dashboard;

  return (
    <header className="h-16 px-4 md:px-6 bg-white dark:bg-[#10221c] border-b border-slate-200 dark:border-[#1a382e] flex items-center justify-between sticky top-0 z-30">
      {/* Esquerda: Botão Menu (mobile) + Breadcrumbs / Título */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#162f27] transition-colors"
          title="Abrir Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
            <Building className="w-3.5 h-3.5 text-[#11d493]" />
            {empresa.nomeFantasia || empresa.razaoSocial}
          </span>
          <span>/</span>
          <span className="text-slate-900 dark:text-white font-medium">{info.titulo}</span>
        </div>

        <div className="sm:hidden">
          <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
            {info.titulo}
          </h1>
        </div>
      </div>

      {/* Direita: Ações Rápidas */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Banco Emissor Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#162f27] border border-slate-200 dark:border-[#1e4236] text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <Landmark className="w-3.5 h-3.5 text-[#11d493]" />
          <span>Banco: {empresa.bancoPadrao ? empresa.bancoPadrao.toUpperCase() : 'INTER'}</span>
        </div>

        {/* Botão Sincronizar com Bling */}
        <button
          onClick={onRefreshBling}
          disabled={carregando}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-[#11d493] border border-emerald-500/30 text-xs font-semibold transition-all disabled:opacity-50"
          title="Atualizar dados da API do Bling"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{carregando ? 'Sincronizando...' : 'Atualizar Bling'}</span>
        </button>

        {/* Botão Voltar para Lista de Empresas */}
        <button
          onClick={onBackToEmpresas}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#162f27] dark:hover:bg-[#1d3d32] text-slate-700 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-[#214739]"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#11d493]" />
          <span className="hidden sm:inline">Trocar Empresa</span>
          <span className="sm:hidden">Empresas</span>
        </button>
      </div>
    </header>
  );
};
