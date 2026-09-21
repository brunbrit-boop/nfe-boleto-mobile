import React, { useState } from 'react';

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  assignee: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
}

export const TasksView: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: 't-1',
      title: 'Conferência de Notas Fiscais Bling',
      description: 'Checar lotes emitidos na semana contra o SEFAZ.',
      assignee: 'Você',
      status: 'in_progress',
      priority: 'high',
      dueDate: 'Hoje',
    },
    {
      id: 't-2',
      title: 'Conciliação de Extratos Inter & Itaú',
      description: 'Bater extrato bancário de julho.',
      assignee: 'Financeiro',
      status: 'todo',
      priority: 'medium',
      dueDate: 'Amanhã',
    },
    {
      id: 't-3',
      title: 'Fechamento de Comissões Vendedores',
      description: 'Cálculo de repasse sobre vendas faturadas.',
      assignee: 'Diretoria',
      status: 'todo',
      priority: 'high',
      dueDate: 'Sexta',
    },
    {
      id: 't-4',
      title: 'Renovação Certificado Digital A1',
      description: 'Certificado vence em 15 dias.',
      assignee: 'Você',
      status: 'done',
      priority: 'low',
      dueDate: 'Ontem',
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: newTitle,
      assignee: 'Você',
      status: 'todo',
      priority: newPriority,
      dueDate: 'Em breve',
    };

    setTasks([...tasks, newTask]);
    setNewTitle('');
    setShowAddModal(false);
  };

  const moveTask = (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => {
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Alta</span>;
      case 'medium':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">Média</span>;
      default:
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">Baixa</span>;
    }
  };

  const columns: { id: 'todo' | 'in_progress' | 'done'; label: string; icon: string; color: string }[] = [
    { id: 'todo', label: 'A Fazer', icon: 'pending', color: 'text-amber-500' },
    { id: 'in_progress', label: 'Em Progresso', icon: 'autorenew', color: 'text-blue-500' },
    { id: 'done', label: 'Concluído', icon: 'check_circle', color: 'text-emerald-500' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] overflow-y-auto font-['Manrope',sans-serif]">
      {/* Header idêntico ao BT Business */}
      <div className="p-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Quadro de Tarefas & Rotinas</h1>
            <p className="text-gray-500 dark:text-gray-400">Acompanhe as rotinas fiscais, bancárias e operacionais</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#11d493] text-gray-950 rounded-lg font-bold hover:bg-[#0fc487] transition-all shadow-lg shadow-[#11d493]/20"
          >
            <span className="material-symbols-outlined">add_task</span>
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="px-8 pb-8 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="bg-white/80 dark:bg-[#162f27] rounded-2xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col h-fit min-h-[450px]">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
                  <span className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[20px] ${col.color}`}>{col.icon}</span>
                    {col.label}
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-sm space-y-2 hover:border-[#11d493]/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                          {t.title}
                        </h4>
                        {getPriorityBadge(t.priority)}
                      </div>

                      {t.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {t.description}
                        </p>
                      )}

                      <div className="pt-2 flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-700">
                        <span>👤 {t.assignee}</span>
                        <div className="flex gap-1">
                          {col.id !== 'todo' && (
                            <button
                              onClick={() => moveTask(t.id, col.id === 'done' ? 'in_progress' : 'todo')}
                              className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300"
                              title="Voltar etapa"
                            >
                              ◀
                            </button>
                          )}
                          {col.id !== 'done' && (
                            <button
                              onClick={() => moveTask(t.id, col.id === 'todo' ? 'in_progress' : 'done')}
                              className="px-1.5 py-0.5 rounded bg-[#11d493]/20 hover:bg-[#11d493]/30 text-[#11d493] font-bold"
                              title="Avançar etapa"
                            >
                              ▶
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Nova Tarefa */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nova Tarefa</h3>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Título da Tarefa
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Conciliação bancária"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Prioridade
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-[#11d493] text-gray-950 rounded-lg hover:bg-[#0fc487]"
                >
                  Criar Tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
