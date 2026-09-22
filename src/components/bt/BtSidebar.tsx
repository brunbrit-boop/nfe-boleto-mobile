import React from 'react';
import type { EmpresaTenant } from '../../types';

export type BtMenuOption =
  | 'finances'
  | 'sales'
  | 'suppliers'
  | 'clients'
  | 'purchases'
  | 'tasks'
  | 'patrimony'
  | 'registration'
  | 'notifications'
  | 'settings'
  | 'robo';

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
}) => {
  // Menus idênticos aos do BT Business original + Vendas & IA
  const links: {
    id: BtMenuOption;
    icon: string;
    label: string;
    badge?: string;
    badgeColor?: string;
  }[] = [
    { id: 'finances', icon: 'account_balance', label: 'Financeiro' },
    { id: 'sales', icon: 'point_of_sale', label: 'Vendas', badge: 'IA', badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    { id: 'suppliers', icon: 'domain', label: 'Fornecedores' },
    { id: 'clients', icon: 'groups', label: 'Clientes' },
    { id: 'purchases', icon: 'shopping_cart', label: 'Compras' },
    { id: 'tasks', icon: 'check_circle', label: 'Tarefas' },
    { id: 'patrimony', icon: 'diamond', label: 'Patrimônio' },
    { id: 'registration', icon: 'folder_shared', label: 'Cadastro' },
    { id: 'notifications', icon: 'notifications', label: 'Notificações', badge: '3', badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    { id: 'settings', icon: 'settings', label: 'Configurações' },
    { id: 'robo', icon: 'mic', label: 'Robô Fiscal & Voz', badge: 'IA', badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar - Cópia 1:1 do BT Business */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#10221c] border-r border-gray-200 dark:border-gray-800
          z-50 transform transition-transform duration-300 ease-in-out flex flex-col font-['Manrope',sans-serif]
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static
        `}
      >
        {/* Logo BT Business */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-gray-200 dark:border-gray-800">
          <span className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <img
              src="/bt-logo.jpg"
              alt="Logo"
              className="w-8 h-8 rounded-full object-cover shadow-sm"
              onError={(e) => {
                // Fallback para elemento estilizado caso a imagem não carregue
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            BT Business
          </span>
          <button
            onClick={onCloseMobile}
            className="md:hidden text-gray-400 hover:text-gray-600"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Card de Usuário / Empresa Ativa */}
        <div className="p-4 bg-gray-50 dark:bg-white/5 mx-4 mt-4 rounded-lg">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Empresa Ativa</p>
          <p className="font-bold text-gray-800 dark:text-white truncate">
            {empresa.nomeFantasia || empresa.razaoSocial}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold bg-[#11d493]/15 text-[#11d493] border-[#11d493]/30">
              {empresa.cnpj ? empresa.cnpj.slice(0, 18) : 'CNPJ NÃO INFORMADO'}
            </span>
          </div>
        </div>

        {/* Menus de Navegação com Nomes Idênticos ao BT Business */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {links.map((link) => {
            const isActive = activeMenu === link.id;
            return (
              <button
                key={link.id}
                onClick={() => {
                  onSelectMenu(link.id);
                  onCloseMobile();
                }}
                className={`
                  w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left
                  ${
                    isActive
                      ? 'bg-[#11d493]/15 text-[#11d493] font-bold shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[22px]">{link.icon}</span>
                  <span>{link.label}</span>
                </div>
                {link.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${link.badgeColor}`}>
                    {link.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Botão Sair / Trocar Empresa no rodapé */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onBackToEmpresas}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>← Trocar Empresa</span>
          </button>
        </div>
      </aside>
    </>
  );
};
