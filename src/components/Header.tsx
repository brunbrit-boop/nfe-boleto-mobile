import React from 'react';
import { Volume2, VolumeX, Settings, Sparkles, ArrowLeft } from 'lucide-react';
import type { BankProvider } from '../types';
import { BANKS } from '../utils/financeEngine';

interface HeaderProps {
  bancoAtual: BankProvider;
  onSelectBanco: (banco: BankProvider) => void;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  onOpenSettings: () => void;
  empresaNome: string;
  isBlingConnected: boolean;
  onVoltarEmpresas?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  bancoAtual,
  onSelectBanco,
  ttsEnabled,
  onToggleTts,
  onOpenSettings,
  empresaNome,
  isBlingConnected,
  onVoltarEmpresas,
}) => {
  const bankConfig = BANKS[bancoAtual];

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 py-2.5 shadow-sm">
      <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
        {/* Robô Avatar & Status */}
        <div className="flex items-center gap-2">
          {onVoltarEmpresas && (
            <button
              onClick={onVoltarEmpresas}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 flex items-center gap-1 font-bold text-xs"
              title="Voltar para a lista de empresas (Hub)"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Empresas</span>
            </button>
          )}

          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shadow-md shadow-blue-500/20 ring-2 ring-blue-100">
              <Sparkles className="w-4 h-4 text-white stroke-[2.5]" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-extrabold text-slate-900 tracking-tight leading-none">
                Gestão & Robô Fiscal
              </h1>
              <button
                onClick={onOpenSettings}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition flex items-center gap-1 ${
                  isBlingConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 animate-pulse'
                }`}
                title={isBlingConnected ? 'Bling ERP Conectado! Clique para ver configurações.' : 'Bling Desconectado! Clique para conectar.'}
              >
                <span>{isBlingConnected ? '🟢' : '🟡'}</span>
                <span>{isBlingConnected ? 'Bling Ativo' : 'Conectar Bling'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 truncate max-w-[140px] sm:max-w-[200px] leading-tight mt-0.5 font-medium">
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
              className="appearance-none text-xs font-bold pl-6 pr-5 py-1.5 rounded-xl bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer"
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
            className={`p-2 rounded-xl border transition ${
              ttsEnabled
                ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
            }`}
            title={ttsEnabled ? 'Voz ativada (o robô fala)' : 'Voz desativada (mudo)'}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Botão Configurações */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Configurações da Empresa, Certificado A1 e Bling ERP"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
