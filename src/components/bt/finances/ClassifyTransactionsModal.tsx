import React, { useState } from 'react';
import type { FinanceTransaction } from '../pages/FinancesView';

export interface ClassificationRule {
  id: string;
  keyword: string;
  category: string;
  unit: string;
  active: boolean;
}

interface ClassifyTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: FinanceTransaction[];
  categories: string[];
  units: string[];
  onApplyClassification: (updatedTransactions: FinanceTransaction[]) => void;
}

export const ClassifyTransactionsModal: React.FC<ClassifyTransactionsModalProps> = ({
  isOpen,
  onClose,
  transactions,
  categories,
  units,
  onApplyClassification,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'rules'>('pending');
  const [filterMissing, setFilterMissing] = useState<'all' | 'category' | 'unit'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Regras automáticas salvas (com padrões iniciais inteligentes pré-carregados)
  const [rules, setRules] = useState<ClassificationRule[]>(() => {
    const saved = localStorage.getItem('bt_finance_rules');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return [
      { id: 'rule-1', keyword: 'ENEL', category: 'Utilidades', unit: 'Galpão 01', active: true },
      { id: 'rule-2', keyword: 'SABESP', category: 'Utilidades', unit: 'Matriz', active: true },
      { id: 'rule-3', keyword: 'FOLHA', category: 'RH / Folha', unit: 'Matriz', active: true },
      { id: 'rule-4', keyword: 'TAR', category: 'Tarifas Bancárias', unit: 'Matriz', active: true },
      { id: 'rule-5', keyword: 'COMBUSTIVEL', category: 'Logística', unit: 'Frota', active: true },
    ];
  });

  // Formulário de Nova Regra
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState(categories[0] || 'Operacional / Insumos');
  const [newUnit, setNewUnit] = useState(units[0] || 'Matriz');

  // Seleção em massa para classificação rápida
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState(categories[0] || '');
  const [bulkUnit, setBulkUnit] = useState(units[0] || '');

  if (!isOpen) return null;

  const saveRules = (newRules: ClassificationRule[]) => {
    setRules(newRules);
    localStorage.setItem('bt_finance_rules', JSON.stringify(newRules));
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    const newRule: ClassificationRule = {
      id: `rule-${Date.now()}`,
      keyword: newKeyword.trim().toUpperCase(),
      category: newCategory,
      unit: newUnit,
      active: true,
    };

    const updated = [...rules, newRule];
    saveRules(updated);
    setNewKeyword('');
  };

  const handleDeleteRule = (id: string) => {
    saveRules(rules.filter((r) => r.id !== id));
  };

  const handleToggleRule = (id: string) => {
    saveRules(
      rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  };

  // Aplicação de regras em lote a todas as transações
  const handleExecuteAllRules = () => {
    let appliedCount = 0;
    const activeRules = rules.filter((r) => r.active);

    const updated = transactions.map((tx) => {
      let matchedCategory = tx.category;
      let matchedUnit = tx.unit;
      let changed = false;

      for (const rule of activeRules) {
        const textToSearch = `${tx.description} ${tx.entity}`.toUpperCase();
        if (textToSearch.includes(rule.keyword)) {
          matchedCategory = rule.category;
          matchedUnit = rule.unit;
          changed = true;
          break;
        }
      }

      if (changed) {
        appliedCount++;
        return { ...tx, category: matchedCategory, unit: matchedUnit };
      }
      return tx;
    });

    onApplyClassification(updated);
    alert(`Sucesso! ${appliedCount} transações foram reclassificadas automaticamente.`);
  };

  // Classificação em lote dos selecionados
  const handleApplyBulk = () => {
    if (selectedIds.size === 0) return;

    const updated = transactions.map((tx) => {
      if (selectedIds.has(tx.id)) {
        return {
          ...tx,
          category: bulkCategory || tx.category,
          unit: bulkUnit || tx.unit,
        };
      }
      return tx;
    });

    onApplyClassification(updated);
    setSelectedIds(new Set());
    alert(`${selectedIds.size} transações classificadas com sucesso!`);
  };

  // Filtragem de pendências
  const pendingTransactions = transactions.filter((tx) => {
    const isMissingCategory =
      !tx.category ||
      tx.category === 'Sem Categoria' ||
      tx.category === 'Operacional / Insumos';
    const isMissingUnit = !tx.unit || tx.unit === 'Sem Unidade';

    if (filterMissing === 'category' && !isMissingCategory) return false;
    if (filterMissing === 'unit' && !isMissingUnit) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        tx.description.toLowerCase().includes(q) ||
        tx.entity.toLowerCase().includes(q) ||
        tx.bankName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingTransactions.map((t) => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#10221c] border border-gray-200 dark:border-gray-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header com Abas */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a2e28]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#11d493]/15 text-[#11d493] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">auto_fix_high</span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Classificação Inteligente de Extratos
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Categorização assistida e automação de regras para conciliação bancária
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-200/70 dark:bg-gray-800 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'pending'
                    ? 'bg-white dark:bg-[#10221c] text-[#11d493] shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                }`}
              >
                Pendências ({pendingTransactions.length})
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'rules'
                    ? 'bg-white dark:bg-[#10221c] text-[#11d493] shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                }`}
              >
                Regras de Automação ({rules.length})
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ml-2"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Classificação de Pendências */}
        {activeTab === 'pending' && (
          <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
            {/* Barra de Filtros e Busca */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar na descrição..."
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2e28] text-gray-800 dark:text-gray-200 w-56 focus:outline-none focus:border-[#11d493]"
                />
                <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    onClick={() => setFilterMissing('all')}
                    className={`px-2 py-1 rounded ${filterMissing === 'all' ? 'bg-white dark:bg-[#10221c] text-[#11d493] shadow-xs' : 'text-gray-500'}`}
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setFilterMissing('category')}
                    className={`px-2 py-1 rounded ${filterMissing === 'category' ? 'bg-white dark:bg-[#10221c] text-[#11d493] shadow-xs' : 'text-gray-500'}`}
                  >
                    Sem Categoria
                  </button>
                  <button
                    onClick={() => setFilterMissing('unit')}
                    className={`px-2 py-1 rounded ${filterMissing === 'unit' ? 'bg-white dark:bg-[#10221c] text-[#11d493] shadow-xs' : 'text-gray-500'}`}
                  >
                    Sem Unidade
                  </button>
                </div>
              </div>

              {/* Ação em Lote Flutuante / Barra de Ação */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-[#11d493]/10 border border-[#11d493]/30 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-[#11d493]">
                    {selectedIds.size} selecionados:
                  </span>
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    className="text-xs p-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2e28] text-gray-800 dark:text-gray-200"
                  >
                    <option value="">Manter categoria atual</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    value={bulkUnit}
                    onChange={(e) => setBulkUnit(e.target.value)}
                    className="text-xs p-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2e28] text-gray-800 dark:text-gray-200"
                  >
                    <option value="">Manter unidade atual</option>
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleApplyBulk}
                    className="px-2.5 py-1 bg-[#11d493] hover:bg-[#0eb87f] text-gray-950 font-bold text-xs rounded-lg shadow-sm"
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>

            {/* Tabela de Transações */}
            <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-[#1a2e28] text-gray-600 dark:text-gray-300 font-bold sticky top-0 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="p-2.5 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={
                          pendingTransactions.length > 0 &&
                          selectedIds.size === pendingTransactions.length
                        }
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-[#11d493] focus:ring-[#11d493] accent-[#11d493]"
                      />
                    </th>
                    <th className="p-2.5 w-20">Data</th>
                    <th className="p-2.5">Descrição / Entidade</th>
                    <th className="p-2.5 w-28 text-right">Valor</th>
                    <th className="p-2.5 w-36">Categoria</th>
                    <th className="p-2.5 w-32">Unidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {pendingTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${
                        selectedIds.has(tx.id) ? 'bg-emerald-50/40 dark:bg-[#11d493]/10' : ''
                      }`}
                    >
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tx.id)}
                          onChange={() => toggleSelect(tx.id)}
                          className="rounded border-gray-300 text-[#11d493] focus:ring-[#11d493] accent-[#11d493]"
                        />
                      </td>
                      <td className="p-2.5 font-mono">{tx.displayDate}</td>
                      <td className="p-2.5">
                        <div className="font-bold text-gray-900 dark:text-white truncate max-w-[280px]">
                          {tx.description}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          {tx.entity} • {tx.bankName}
                        </div>
                      </td>
                      <td
                        className={`p-2.5 text-right font-bold ${
                          tx.type === 'receivable'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-500'
                        }`}
                      >
                        {formatBRL(tx.amount)}
                      </td>
                      <td className="p-2.5">
                        <select
                          value={tx.category}
                          onChange={(e) => {
                            const newCat = e.target.value;
                            const updated = transactions.map((t) =>
                              t.id === tx.id ? { ...t, category: newCat } : t
                            );
                            onApplyClassification(updated);
                          }}
                          className="w-full text-xs p-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2e28] text-gray-800 dark:text-gray-200"
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2.5">
                        <select
                          value={tx.unit}
                          onChange={(e) => {
                            const newU = e.target.value;
                            const updated = transactions.map((t) =>
                              t.id === tx.id ? { ...t, unit: newU } : t
                            );
                            onApplyClassification(updated);
                          }}
                          className="w-full text-xs p-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2e28] text-gray-800 dark:text-gray-200"
                        >
                          {units.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}

                  {pendingTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400 text-xs italic">
                        Nenhuma transação pendente com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Regras de Automação */}
        {activeTab === 'rules' && (
          <div className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
            {/* Formulário para criar nova regra */}
            <form
              onSubmit={handleAddRule}
              className="p-3 bg-gray-50 dark:bg-[#1a2e28] rounded-xl border border-gray-200 dark:border-gray-700 space-y-3"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-[#11d493]">add_circle</span>
                <span className="text-xs font-extrabold text-gray-900 dark:text-white uppercase">
                  Nova Regra de Conciliação Automática
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Se a descrição contiver o texto:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: ENEL, FOLHA, POSTO..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white uppercase font-bold focus:outline-none focus:border-[#11d493]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Definir Categoria:
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white font-bold"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Definir Unidade:
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white font-bold"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#11d493] hover:bg-[#0eb87f] text-gray-950 font-extrabold text-xs rounded-lg shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  Salvar Regra
                </button>
              </div>
            </form>

            {/* Lista de Regras Existentes */}
            <div className="flex-1 flex flex-col border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="p-2.5 bg-gray-50 dark:bg-[#1a2e28] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Regras Ativas ({rules.length})
                </span>
                <button
                  onClick={handleExecuteAllRules}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                  Executar Regras em Todas as Transações
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {rules.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={r.active}
                        onChange={() => handleToggleRule(r.id)}
                        className="rounded border-gray-300 text-[#11d493] focus:ring-[#11d493] accent-[#11d493]"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <span>Se contém:</span>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-400 font-mono text-[11px]">
                            {r.keyword}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                          → Categoria: <strong className="text-emerald-500">{r.category}</strong> • Unidade: <strong className="text-blue-400">{r.unit}</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRule(r.id)}
                      className="text-gray-400 hover:text-red-500 p-1 rounded-lg"
                      title="Excluir Regra"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a2e28]/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
