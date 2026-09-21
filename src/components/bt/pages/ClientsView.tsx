import React, { useState } from 'react';
import type { BlingCliente } from '../../../types';

interface ClientItem {
  id: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  category?: string;
  status: 'Ativo' | 'Inativo';
}

interface ClientsViewProps {
  clientesBling?: BlingCliente[];
  onEmitirParaCliente?: (cliente: BlingCliente) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clientesBling = [],
  onEmitirParaCliente,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCpfCnpj, setNewCpfCnpj] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Transforma clientes do Bling + base de fallback
  const clientsList: ClientItem[] = clientesBling.length > 0
    ? clientesBling.map((c) => ({
        id: String(c.id),
        name: c.nome || c.fantasia || 'Cliente',
        cpfCnpj: c.numeroDocumento,
        email: c.email,
        phone: c.telefone || c.celular,
        category: 'Cliente Faturado',
        status: c.situacao === 'A' ? 'Ativo' : 'Inativo',
      }))
    : [
        {
          id: 'cli-1',
          name: 'Mercado Bom Preço Ltda',
          cpfCnpj: '23.456.789/0001-01',
          email: 'financeiro@bompreco.com.br',
          phone: '(11) 98765-4321',
          category: 'Atacado',
          status: 'Ativo',
        },
        {
          id: 'cli-2',
          name: 'Distribuidora Silva & Filhos',
          cpfCnpj: '34.567.890/0001-12',
          email: 'compras@silvadistribuidora.com.br',
          phone: '(11) 91234-5678',
          category: 'Varejo',
          status: 'Ativo',
        },
        {
          id: 'cli-3',
          name: 'Cliente Balcão Diversos',
          cpfCnpj: '00.000.000/0000-00',
          category: 'Consumidor Final',
          status: 'Ativo',
        },
      ];

  const filteredClients = clientsList.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cpfCnpj?.includes(searchTerm) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] overflow-y-auto font-['Manrope',sans-serif]">
      {/* Header idêntico ao BT Business */}
      <div className="p-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Clientes e Classificação
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Gerencie a origem das suas receitas (Sincronizado com Bling ERP)
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#11d493] text-gray-950 rounded-lg font-bold hover:bg-[#0fc487] transition-all shadow-lg shadow-[#11d493]/20"
          >
            <span className="material-symbols-outlined">add</span>
            Novo Cliente
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar cliente por nome, CPF/CNPJ ou e-mail..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#162f27] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#11d493]"
          />
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="px-8 pb-8">
        <div className="bg-white dark:bg-[#162f27] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-4">Nome do Cliente</th>
                  <th className="px-6 py-4">CPF / CNPJ</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">Classificação</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredClients.map((c) => {
                  const clienteBlingMatch = clientesBling.find((cb) => String(cb.id) === c.id);

                  return (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                        {c.name}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{c.cpfCnpj || 'Não informado'}</td>
                      <td className="px-6 py-4 text-xs">
                        {c.email && <div className="text-gray-900 dark:text-white">{c.email}</div>}
                        {c.phone && <div className="text-gray-400">{c.phone}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          {c.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {clienteBlingMatch && onEmitirParaCliente ? (
                          <button
                            onClick={() => onEmitirParaCliente(clienteBlingMatch)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#11d493]/15 text-[#11d493] hover:bg-[#11d493]/25 font-bold rounded-lg text-xs transition-all border border-[#11d493]/30"
                          >
                            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                            Emitir NF-e / Boleto
                          </button>
                        ) : (
                          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1">
                            <span className="material-symbols-outlined text-[20px]">more_vert</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Adicionar Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Novo Cliente</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowModal(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Nome / Razão Social
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome do Cliente"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  CPF ou CNPJ
                </label>
                <input
                  type="text"
                  value={newCpfCnpj}
                  onChange={(e) => setNewCpfCnpj(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-[#11d493] text-gray-950 rounded-lg hover:bg-[#0fc487]"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
