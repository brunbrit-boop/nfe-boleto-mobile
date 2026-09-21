import React, { useState } from 'react';
import type { BlingCliente } from '../../../types';

interface SupplierItem {
  id: string;
  name: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  category?: string;
  status: 'Ativo' | 'Inativo';
  paymentMethods?: string[];
}

interface SuppliersViewProps {
  clientesBling?: BlingCliente[];
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ clientesBling = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierCnpj, setNewSupplierCnpj] = useState('');
  const [newSupplierCategory, setNewSupplierCategory] = useState('Matéria Prima');

  // Fornecedores iniciais baseados no BT Business original + contatos do Bling
  const [suppliers, setSuppliers] = useState<SupplierItem[]>(() => {
    const defaultList: SupplierItem[] = [
      {
        id: 'sup-1',
        name: 'Eginox Indústria e Comércio',
        cnpj: '12.345.678/0001-90',
        email: 'vendas@eginox.com.br',
        phone: '(11) 3456-7890',
        category: 'Matéria Prima',
        status: 'Ativo',
        paymentMethods: ['Boleto 30d', 'PIX'],
      },
      {
        id: 'sup-2',
        name: 'Enel Distribuição SP',
        cnpj: '61.695.227/0001-93',
        email: 'atendimento@enel.com.br',
        phone: '0800 72 72 120',
        category: 'Utilidades',
        status: 'Ativo',
        paymentMethods: ['Débito Automático'],
      },
      {
        id: 'sup-3',
        name: 'Adobe Systems Brasil',
        cnpj: '02.502.834/0001-34',
        email: 'billing@adobe.com',
        phone: '(11) 3003-0000',
        category: 'Software & Cloud',
        status: 'Ativo',
        paymentMethods: ['Cartão Corporativo'],
      },
      {
        id: 'sup-4',
        name: 'Imobiliária Central Santo Amaro',
        cnpj: '45.678.901/0001-12',
        email: 'locacao@imobcentral.com.br',
        phone: '(11) 5521-4321',
        category: 'Aluguel',
        status: 'Ativo',
        paymentMethods: ['Boleto Bancário'],
      },
    ];

    if (clientesBling && clientesBling.length > 0) {
      const fromBling: SupplierItem[] = clientesBling.slice(0, 4).map((c) => ({
        id: `bling-${c.id}`,
        name: c.nome || c.fantasia || 'Fornecedor Parceiro',
        cnpj: c.numeroDocumento,
        email: c.email,
        phone: c.telefone || c.celular,
        category: 'Parceiro Comercial',
        status: c.situacao === 'A' ? 'Ativo' : 'Inativo',
        paymentMethods: ['Boleto', 'PIX'],
      }));
      return [...defaultList, ...fromBling];
    }

    return defaultList;
  });

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;

    const novo: SupplierItem = {
      id: `sup-${Date.now()}`,
      name: newSupplierName,
      cnpj: newSupplierCnpj || '00.000.000/0001-00',
      category: newSupplierCategory,
      status: 'Ativo',
      paymentMethods: ['Boleto', 'PIX'],
    };

    setSuppliers([novo, ...suppliers]);
    setNewSupplierName('');
    setNewSupplierCnpj('');
    setShowModal(false);
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.cnpj?.includes(searchTerm) ||
      s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] overflow-y-auto font-['Manrope',sans-serif]">
      {/* Header idêntico ao BT Business */}
      <div className="p-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Fornecedores</h1>
            <p className="text-gray-500 dark:text-gray-400">Gerencie seus parceiros e contatos comerciais</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#11d493] text-gray-950 rounded-lg font-bold hover:bg-[#0fc487] transition-all shadow-lg shadow-[#11d493]/20"
          >
            <span className="material-symbols-outlined">add</span>
            Novo Fornecedor
          </button>
        </div>

        {/* Search Input */}
        <div className="relative max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou categoria..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#162f27] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#11d493]"
          />
        </div>
      </div>

      {/* Tabela de Fornecedores */}
      <div className="px-8 pb-8">
        <div className="bg-white dark:bg-[#162f27] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-4">Razão Social / Nome</th>
                  <th className="px-6 py-4">CNPJ / Documento</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Formas de Pagamento</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                      {s.name}
                      {s.email && <span className="block text-xs font-normal text-gray-400">{s.email}</span>}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{s.cnpj}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {s.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {s.paymentMethods?.map((pm) => (
                          <span
                            key={pm}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          >
                            {pm}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1">
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Adicionar Fornecedor */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Novo Fornecedor</h3>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Nome / Razão Social
                </label>
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Ex: Ambev Distribuidora"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={newSupplierCnpj}
                  onChange={(e) => setNewSupplierCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Categoria
                </label>
                <select
                  value={newSupplierCategory}
                  onChange={(e) => setNewSupplierCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                >
                  <option value="Matéria Prima">Matéria Prima</option>
                  <option value="Utilidades">Utilidades</option>
                  <option value="Software & Cloud">Software & Cloud</option>
                  <option value="Aluguel">Aluguel</option>
                  <option value="Serviços">Serviços</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-[#11d493] text-gray-950 rounded-lg hover:bg-[#0fc487]"
                >
                  Salvar Fornecedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
