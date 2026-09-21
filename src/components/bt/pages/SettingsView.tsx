import React, { useState } from 'react';
import type { EmpresaTenant, BankProvider } from '../../../types';

interface SettingsViewProps {
  empresa: EmpresaTenant;
  bancoAtual: BankProvider;
  onSelectBanco: (banco: BankProvider) => void;
  onOpenModalSettings: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  empresa,
  bancoAtual,
  onSelectBanco,
  onOpenModalSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'integrations' | 'bank' | 'general'>('integrations');

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] p-4 md:p-8 overflow-y-auto font-['Manrope',sans-serif]">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header idêntico ao BT Business */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Configurações
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Gerencie as integrações da API, contas bancárias e parâmetros do sistema
          </p>
        </div>

        {/* Abas idênticas ao BT Business */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6 gap-6 text-sm font-bold">
          <button
            onClick={() => setActiveTab('integrations')}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'integrations'
                ? 'border-[#11d493] text-[#11d493]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            🔌 Integrações & Bling ERP
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'bank'
                ? 'border-[#11d493] text-[#11d493]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            🏦 Banco Emissor de Boletos
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-3 border-b-2 transition-all ${
              activeTab === 'general'
                ? 'border-[#11d493] text-[#11d493]'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            ⚙️ Dados Gerais da Empresa
          </button>
        </div>

        {/* Conteúdo Aba 1: Integrações */}
        {activeTab === 'integrations' && (
          <div className="bg-white dark:bg-[#162f27] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-[#11d493] flex items-center justify-center font-extrabold text-sm">
                  BL
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Bling ERP (API v3 / OAuth 2.0)
                  </h3>
                  <p className="text-xs text-gray-400">
                    Sincronização de clientes, contas a pagar e contas a receber
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                empresa.isBlingConectado
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
                {empresa.isBlingConectado ? 'Conectado' : 'Pendente'}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-gray-400 block mb-1">Token de Acesso Atual:</span>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg font-mono truncate text-gray-700 dark:text-gray-300">
                  {empresa.blingAccessToken ? `${empresa.blingAccessToken.slice(0, 30)}...` : 'Nenhum token configurado'}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onOpenModalSettings}
                  className="px-4 py-2.5 rounded-lg bg-[#11d493] text-gray-950 font-bold hover:bg-[#0fc487] transition-all"
                >
                  Editar Token e Credenciais do Bling
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo Aba 2: Banco Emissor */}
        {activeTab === 'bank' && (
          <div className="bg-white dark:bg-[#162f27] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
              Selecione o Banco Padrão para Boletos e Bolepix
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { id: 'inter', name: 'Banco Inter', color: 'border-orange-500' },
                { id: 'itau', name: 'Banco Itaú', color: 'border-amber-600' },
                { id: 'bradesco', name: 'Bradesco', color: 'border-red-600' },
                { id: 'cora', name: 'Cora Bank', color: 'border-pink-600' },
                { id: 'asaas', name: 'Asaas', color: 'border-blue-600' },
                { id: 'sicoob', name: 'Sicoob', color: 'border-teal-600' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => onSelectBanco(b.id as BankProvider)}
                  className={`p-4 rounded-xl border text-left font-bold text-xs transition-all ${
                    bancoAtual === b.id
                      ? 'border-[#11d493] bg-[#11d493]/10 text-gray-900 dark:text-white ring-2 ring-[#11d493]/30'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                  }`}
                >
                  <span className="block text-sm mb-1">{b.name}</span>
                  <span className="text-[10px] text-gray-400 font-normal">
                    {bancoAtual === b.id ? '✓ Banco Ativo' : 'Clique para selecionar'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conteúdo Aba 3: Dados Gerais */}
        {activeTab === 'general' && (
          <div className="bg-white dark:bg-[#162f27] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-gray-400 block mb-1">Razão Social:</span>
                <p className="font-bold text-sm text-gray-900 dark:text-white">
                  {empresa.razaoSocial}
                </p>
              </div>
              <div>
                <span className="text-gray-400 block mb-1">Nome Fantasia:</span>
                <p className="font-bold text-sm text-gray-900 dark:text-white">
                  {empresa.nomeFantasia || 'Não informado'}
                </p>
              </div>
              <div>
                <span className="text-gray-400 block mb-1">CNPJ:</span>
                <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                  {empresa.cnpj || 'Não informado'}
                </p>
              </div>
              <div>
                <span className="text-gray-400 block mb-1">Cidade / UF:</span>
                <p className="font-bold text-sm text-gray-900 dark:text-white">
                  {empresa.cidade || 'São Paulo'} - {empresa.uf || 'SP'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
