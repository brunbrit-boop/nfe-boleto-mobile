import React, { useState } from 'react';
import type { BlingFornecedor, BlingContaPagar } from '../../../types';

interface SuppliersViewProps {
  fornecedores?: BlingFornecedor[];
  contasPagar?: BlingContaPagar[];
  carregando?: boolean;
  onRefreshBling?: () => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  fornecedores = [],
  contasPagar = [],
  carregando = false,
  onRefreshBling,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [showModal, setShowModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierCnpj, setNewSupplierCnpj] = useState('');
  const [newSupplierCategory, setNewSupplierCategory] = useState('Matéria Prima');
  const [localSuppliers, setLocalSuppliers] = useState<BlingFornecedor[]>([]);

  // Fornecedores combinados (Bling + criados localmente nesta sessão)
  const allSuppliers = [...localSuppliers, ...fornecedores];

  // Mapeia contas a pagar por fornecedor (por id ou nome ou documento)
  const openBillsBySupplier = React.useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();

    contasPagar.forEach((cp) => {
      const isAberto = cp.situacao === 1 || (cp.saldo ?? cp.valor) > 0;
      if (!isAberto) return;

      const valor = Number(cp.saldo ?? cp.valor) || 0;
      const keys: string[] = [];

      if (cp.contato?.id) keys.push(String(cp.contato.id));
      if (cp.contato?.numeroDocumento) keys.push(cp.contato.numeroDocumento.replace(/\D/g, ''));
      if (cp.contato?.nome) keys.push(cp.contato.nome.toLowerCase().trim());

      keys.forEach((k) => {
        const current = map.get(k) || { total: 0, count: 0 };
        map.set(k, {
          total: current.total + valor,
          count: current.count + 1,
        });
      });
    });

    return map;
  }, [contasPagar]);

  const getSupplierOpenBalance = (s: BlingFornecedor) => {
    const idKey = String(s.id);
    const docKey = s.numeroDocumento ? s.numeroDocumento.replace(/\D/g, '') : '';
    const nameKey = (s.nome || s.fantasia || '').toLowerCase().trim();

    return openBillsBySupplier.get(idKey) ||
      (docKey ? openBillsBySupplier.get(docKey) : undefined) ||
      (nameKey ? openBillsBySupplier.get(nameKey) : undefined) ||
      { total: 0, count: 0 };
  };

  // KPIs
  const totalFornecedores = allSuppliers.length;
  const fornecedoresAtivos = allSuppliers.filter((s) => s.situacao !== 'I').length;
  const totalAPagarAberto = contasPagar
    .filter((cp) => cp.situacao === 1 || (cp.saldo ?? cp.valor) > 0)
    .reduce((acc, curr) => acc + (Number(curr.saldo ?? curr.valor) || 0), 0);

  // Lista de categorias únicas para filtro
  const categorias = React.useMemo(() => {
    const cats = new Set<string>();
    allSuppliers.forEach((s) => {
      if (s.categoria) cats.add(s.categoria);
    });
    return Array.from(cats);
  }, [allSuppliers]);

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;

    const novo: BlingFornecedor = {
      id: Date.now(),
      nome: newSupplierName,
      fantasia: newSupplierName,
      numeroDocumento: newSupplierCnpj || '00.000.000/0001-00',
      tipoPessoa: (newSupplierCnpj && newSupplierCnpj.length > 14) ? 'J' : 'F',
      categoria: newSupplierCategory,
      situacao: 'A',
    };

    setLocalSuppliers([novo, ...localSuppliers]);
    setNewSupplierName('');
    setNewSupplierCnpj('');
    setShowModal(false);
  };

  const filteredSuppliers = allSuppliers.filter((s) => {
    const matchesSearch =
      (s.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.fantasia || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.numeroDocumento || '').includes(searchTerm) ||
      (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.categoria || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'todos' || s.categoria === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] overflow-y-auto font-['Manrope',sans-serif]">
      {/* Header com Integração Bling */}
      <div className="p-6 md:p-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Fornecedores</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Bling ERP
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Gerencie seus fornecedores, compras e compromissos sincronizados em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onRefreshBling && (
              <button
                onClick={onRefreshBling}
                disabled={carregando}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 hover:border-[#11d493] hover:text-[#11d493] transition-all shadow-sm disabled:opacity-50"
                title="Recarregar fornecedores do Bling"
              >
                <span className={`material-symbols-outlined text-[18px] ${carregando ? 'animate-spin' : ''}`}>
                  sync
                </span>
                {carregando ? 'Sincronizando...' : 'Atualizar Bling'}
              </button>
            )}

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#11d493] text-gray-950 rounded-lg font-bold hover:bg-[#0fc487] transition-all shadow-lg shadow-[#11d493]/20"
            >
              <span className="material-symbols-outlined">add</span>
              Novo Fornecedor
            </button>
          </div>
        </div>

        {/* 3 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-[#11d493] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">local_shipping</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total de Fornecedores</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{totalFornecedores}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total a Pagar em Aberto</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {totalAPagarAberto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">verified</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Fornecedores Ativos</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{fornecedoresAtivos}</p>
            </div>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Razão Social, CNPJ ou categoria..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#162f27] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#11d493]"
            />
          </div>

          {categorias.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#162f27] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#11d493]"
            >
              <option value="todos">Todas as Categorias</option>
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Tabela de Fornecedores */}
      <div className="px-6 md:px-8 pb-8">
        <div className="bg-white dark:bg-[#162f27] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-5xl text-gray-400 mb-3">
                inventory_2
              </span>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                Nenhum fornecedor encontrado
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
                {searchTerm
                  ? 'Nenhum fornecedor corresponde à pesquisa atual.'
                  : 'Os fornecedores cadastrados no Bling ERP ou em Contas a Pagar aparecerão automaticamente aqui.'}
              </p>
              {onRefreshBling && (
                <button
                  onClick={onRefreshBling}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#11d493] text-gray-950 font-bold rounded-lg text-sm hover:bg-[#0fc487]"
                >
                  <span className="material-symbols-outlined text-[18px]">sync</span>
                  Buscar no Bling Agora
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-6 py-4">Razão Social / Nome</th>
                    <th className="px-6 py-4">CNPJ / CPF</th>
                    <th className="px-6 py-4">Categoria</th>
                    <th className="px-6 py-4">Saldo em Aberto</th>
                    <th className="px-6 py-4">Contato</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredSuppliers.map((s) => {
                    const balance = getSupplierOpenBalance(s);

                    return (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span>{s.nome || s.fantasia || 'Fornecedor'}</span>
                            {s.fantasia && s.fantasia !== s.nome && (
                              <span className="text-xs text-gray-400 font-normal">({s.fantasia})</span>
                            )}
                          </div>
                          {s.email && (
                            <span className="block text-xs font-normal text-gray-400">{s.email}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {s.numeroDocumento || 'Não informado'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            {s.categoria || 'Geral'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {balance.total > 0 ? (
                            <div>
                              <span className="font-bold text-amber-600 dark:text-amber-400">
                                {balance.total.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </span>
                              <span className="block text-[11px] text-gray-400">
                                {balance.count} conta{balance.count > 1 ? 's' : ''} em aberto
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                              Sem débitos pendentes
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {s.telefone || s.celular ? (
                            <span className="text-gray-700 dark:text-gray-300">
                              {s.telefone || s.celular}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              s.situacao !== 'I'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                s.situacao !== 'I' ? 'bg-emerald-500' : 'bg-gray-400'
                              }`}
                            />
                            {s.situacao !== 'I' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="Ver opções do fornecedor"
                          >
                            <span className="material-symbols-outlined text-[20px]">more_vert</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
                  placeholder="Ex: Distribuidora Nacional Ltda"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  CNPJ ou CPF
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
                  <option value="Utilidades">Utilidades (Energia, Água)</option>
                  <option value="Software & Cloud">Software & Cloud</option>
                  <option value="Aluguel">Aluguel & Imóveis</option>
                  <option value="Serviços">Serviços Terceirizados</option>
                  <option value="Operacional / Insumos">Operacional / Insumos</option>
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
