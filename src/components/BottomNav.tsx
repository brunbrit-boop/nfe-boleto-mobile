import React from 'react';
import { Bot, Users, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import type { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  badgeCounts?: {
    clientes?: number;
    pagar?: number;
    receber?: number;
  };
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  badgeCounts,
}) => {
  const tabs = [
    {
      id: 'robo' as ActiveTab,
      label: 'Robô',
      icon: Bot,
      badge: undefined,
    },
    {
      id: 'clientes' as ActiveTab,
      label: 'Clientes',
      icon: Users,
      badge: badgeCounts?.clientes,
    },
    {
      id: 'pagar' as ActiveTab,
      label: 'A Pagar',
      icon: ArrowDownCircle,
      badge: badgeCounts?.pagar,
      badgeColor: 'bg-rose-500',
    },
    {
      id: 'receber' as ActiveTab,
      label: 'A Receber',
      icon: ArrowUpCircle,
      badge: badgeCounts?.receber,
      badgeColor: 'bg-emerald-500',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-nav pb-safe">
      <div className="max-w-xl mx-auto px-3 py-1.5 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-200 active:scale-90 ${
                isActive
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              {/* Ícone com Indicador */}
              <div className="relative">
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-transparent text-slate-500'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                </div>

                {/* Badge se houver */}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`absolute -top-1 -right-1.5 text-[9px] font-bold text-white px-1.5 py-0.2 rounded-full ring-2 ring-white ${
                      tab.badgeColor || 'bg-blue-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              {/* Label da Aba */}
              <span className={`text-[11px] tracking-tight mt-0.5 ${isActive ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
                {tab.label}
              </span>

              {/* Dot Indicador Inferior */}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
