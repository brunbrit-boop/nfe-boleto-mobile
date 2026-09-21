import React, { useState } from 'react';
import type { EmpresaTenant } from '../../../types';

interface RegistrationViewProps {
  empresaAtiva: EmpresaTenant;
  empresas: EmpresaTenant[];
}

export const RegistrationView: React.FC<RegistrationViewProps> = ({
  empresaAtiva,
  empresas,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = empresas.filter(
    (e) =>
      e.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.nomeFantasia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.cnpj.includes(searchTerm)
  );

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] p-4 md:p-8 overflow-y-auto font-['Manrope',sans-serif]">
      {/* Header idêntico ao BT Business */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Cadastro de Empresas
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Gerencie os dados cadastrais e entidades do seu grupo empresarial
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          search
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar empresa por razão social, fantasia ou CNPJ..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#162f27] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#11d493]"
        />
      </div>

      {/* Grid de Empresas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((emp) => {
          const isCurrent = emp.id === empresaAtiva.id;

          return (
            <div
              key={emp.id}
              className={`bg-white dark:bg-[#162f27] rounded-2xl p-5 border shadow-sm space-y-4 ${
                isCurrent
                  ? 'border-[#11d493] ring-1 ring-[#11d493]/50'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {emp.nomeFantasia || emp.razaoSocial}
                  </h3>
                  <p className="text-xs text-gray-400 truncate max-w-[200px]">
                    {emp.razaoSocial}
                  </p>
                </div>
                {isCurrent ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#11d493]/20 text-[#11d493] border border-[#11d493]/30 uppercase">
                    Ativa
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase">
                    Conectada
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">CNPJ:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {emp.cnpj || 'Não informado'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Banco Padrão:</span>
                  <span className="font-bold uppercase text-[#11d493]">
                    {emp.bancoPadrao}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Integração Bling:</span>
                  <span
                    className={`font-semibold ${
                      emp.isBlingConectado ? 'text-emerald-500' : 'text-amber-500'
                    }`}
                  >
                    {emp.isBlingConectado ? '🟢 Conectado' : '🟡 Pendente'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
