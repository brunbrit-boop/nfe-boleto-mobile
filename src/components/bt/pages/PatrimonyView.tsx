import React from 'react';

export const PatrimonyView: React.FC = () => {
  const ASSETS = [
    // Veículos
    { id: 1, name: 'Frota Comercial (5 Carros)', category: 'Veículos', value: 350000, icon: 'directions_car' },
    { id: 2, name: 'Caminhão de Entrega VUC', category: 'Veículos', value: 180000, icon: 'local_shipping' },

    // Máquinas e Equipamentos
    { id: 5, name: 'Maquinário de Corte', category: 'Máquinas e Equipamentos', value: 120000, icon: 'precision_manufacturing' },
    { id: 6, name: 'Empilhadeira Elétrica', category: 'Máquinas e Equipamentos', value: 45000, icon: 'forklift' },
    { id: 7, name: 'Computadores e Servidores', category: 'Máquinas e Equipamentos', value: 35000, icon: 'dns' },

    // Estoque
    { id: 3, name: 'Estoque Central - Matriz', category: 'Estoque', value: 450000, icon: 'inventory_2' },
    { id: 4, name: 'Estoque de Insumos - Filial', category: 'Estoque', value: 125000, icon: 'inventory' },

    // Imóveis
    { id: 8, name: 'Galpão Industrial SP', category: 'Imóveis', value: 1200000, icon: 'warehouse' },
    { id: 9, name: 'Loja Matriz (Prédio Próprio)', category: 'Imóveis', value: 850000, icon: 'storefront' },
  ];

  const CATEGORIES = [
    { id: 'Veículos', label: 'Veículos', icon: 'local_shipping', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    { id: 'Máquinas e Equipamentos', label: 'Máquinas e Equipamentos', icon: 'precision_manufacturing', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
    { id: 'Estoque', label: 'Estoque', icon: 'inventory_2', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { id: 'Imóveis', label: 'Imóveis', icon: 'apartment', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  ];

  const totalValue = ASSETS.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] p-4 md:p-8 overflow-y-auto font-['Manrope',sans-serif]">
      {/* Header idêntico ao BT Business */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">diamond</span>
            Gestão de Patrimônio
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Controle de Veículos, Máquinas, Estoque e Imóveis.
          </p>
        </div>
        <div className="bg-white dark:bg-[#162f27] px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <span className="text-xs text-gray-400 uppercase font-bold block">Valor Total Acumulado</span>
          <p className="text-2xl font-bold text-[#11d493]">
            {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      {/* 4 Grandes Cartões por Categoria */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {CATEGORIES.map((cat) => {
          const catAssets = ASSETS.filter((a) => a.category === cat.id);
          const catTotal = catAssets.reduce((sum, a) => sum + a.value, 0);

          return (
            <div
              key={cat.id}
              className="bg-white dark:bg-[#162f27] rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${cat.color}`}>
                    <span className="material-symbols-outlined text-[24px]">{cat.icon}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-400">
                    {catAssets.length} itens
                  </span>
                </div>

                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                  {cat.label}
                </h3>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white mb-4">
                  {catTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>

                <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  {catAssets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-300 truncate max-w-[150px]">
                        {asset.name}
                      </span>
                      <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                        {asset.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
