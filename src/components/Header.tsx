import React from 'react';
import { Volume2, VolumeX, Settings, Sparkles } from 'lucide-react';
import type { BankProvider } from '../types';
import { BANKS } from '../utils/financeEngine';

interface HeaderProps {
  bancoAtual: BankProvider;
  onSelectBanco: (banco: BankProvider) => void;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  onOpenSettings: () => void;
  empresaNome: string;
}

export const Header: React.FC<HeaderProps> = ({
  bancoAtual,
  onSelectBanco,
  ttsEnabled,
  onToggleTts,
  onOpenSettings,
  empresaNome,
}) => {
  const bankConfig = BANKS[bancoAtual];

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
        {/* Robô Avatar & Status */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-brand-500/20 ring-2 ring-brand-400/30">
              <Sparkles className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-slate-950 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold text-slate-100 tracking-tight leading-none">
                Robô Fiscal & Boletos
              </h1>
              <span className="text-[10px] font-semibold bg-brand-500/20 text-brand-300 px-1.5 py-0.5 rounded border border-brand-500/30">
                IA 2.5
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[140px] sm:max-w-[180px] leading-tight mt-0.5">
              {empresaNome || 'Sua Empresa'}
            </p>
          </div>
        </div>

        {/* Controles: Seletor de Banco, Som e Configurações */}
        <div className="flex items-center gap-1.5">
          {/* Seletor Rápido de Banco */}
          <div className="relative">
            <select
              value={bancoAtual}
              onChange={(e) => onSelectBanco(e.target.value as BankProvider)}
              className="appearance-none text-xs font-semibold pl-6 pr-5 py-1.5 rounded-lg bg-slate-800/90 text-slate-200 border border-slate-700/80 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-400 transition cursor-pointer"
              title="Banco padrão para registro dos boletos"
            >
              {Object.values(BANKS).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none">
              {bankConfig.logoIcon}
            </span>
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">
              ▼
            </span>
          </div>

          {/* Botão de Som / Voz */}
          <button
            onClick={onToggleTts}
            className={`p-2 rounded-lg border transition ${
              ttsEnabled
                ? 'bg-brand-500/10 text-brand-400 border-brand-500/30 hover:bg-brand-500/20'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
            }`}
            title={ttsEnabled ? 'Voz ativada (o robô fala)' : 'Voz desativada (mudo)'}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Botão Configurações */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:text-slate-200 hover:border-slate-600 transition"
            title="Configurações da Empresa e Certificado A1"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
