import React, { useState } from 'react';

interface PurchaseRequest {
  id: string;
  item: string;
  type: 'product' | 'service';
  description: string;
  requester: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  estimatedValue?: number;
}

export const PurchasesView: React.FC = () => {
  const [requests, setRequests] = useState<PurchaseRequest[]>([
    {
      id: 'r1',
      item: 'Notebook Dell XPS',
      type: 'product',
      description: 'Para o novo designer.',
      requester: 'João Silva',
      date: '26/07/2026',
      status: 'pending',
      estimatedValue: 8500,
    },
    {
      id: 'r2',
      item: 'Limpeza Ar Condicionado',
      type: 'service',
      description: 'Manutenção semestral.',
      requester: 'Ana Souza',
      date: '25/07/2026',
      status: 'approved',
      estimatedValue: 450,
    },
    {
      id: 'r3',
      item: 'Cadeiras Ergonômicas (x5)',
      type: 'product',
      description: 'Renovação setor administrativo.',
      requester: 'Carlos Gerente',
      date: '24/07/2026',
      status: 'completed',
      estimatedValue: 3200,
    },
    {
      id: 'r4',
      item: 'Consultoria Fiscal',
      type: 'service',
      description: 'Revisão tributária.',
      requester: 'Maria Diretora',
      date: '27/07/2026',
      status: 'pending',
      estimatedValue: 12000,
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newType, setNewType] = useState<'product' | 'service'>('product');
  const [newDesc, setNewDesc] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;

    const newReq: PurchaseRequest = {
      id: `req-${Date.now()}`,
      item: newItem,
      type: newType,
      description: newDesc,
      requester: 'Você',
      date: new Date().toLocaleDateString('pt-BR'),
      status: 'pending',
      estimatedValue: parseFloat(newValue) || 0,
    };

    setRequests([newReq, ...requests]);
    setShowModal(false);
    setNewItem('');
    setNewDesc('');
    setNewValue('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            Aprovado
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            Rejeitado
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            Concluído
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] overflow-y-auto font-['Manrope',sans-serif]">
      {/* Header idêntico ao BT Business */}
      <div className="p-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Compras & Requisições</h1>
            <p className="text-gray-500 dark:text-gray-400">Solicite e aprove compras de produtos e serviços</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#11d493] text-gray-950 rounded-lg font-bold hover:bg-[#0fc487] transition-all shadow-lg shadow-[#11d493]/20"
          >
            <span className="material-symbols-outlined">add_shopping_cart</span>
            Nova Solicitação
          </button>
        </div>
      </div>

      {/* Lista de Requisições de Compras */}
      <div className="px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white dark:bg-[#162f27] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm space-y-4 hover:border-[#11d493]/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {req.type === 'product' ? '📦 Produto' : '🛠️ Serviço'}
                  </span>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                    {req.item}
                  </h3>
                </div>
                {getStatusBadge(req.status)}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                {req.description}
              </p>

              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-400 text-[11px] block">Solicitante:</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-200">{req.requester}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 text-[11px] block">Valor Estimado:</span>
                  <span className="font-bold text-[#11d493]">
                    {req.estimatedValue
                      ? req.estimatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : 'A cotar'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Nova Requisição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nova Solicitação de Compra</h3>
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Item ou Serviço Solicitado
                </label>
                <input
                  type="text"
                  required
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Ex: Licença de Software"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Tipo
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                  >
                    <option value="product">Produto</option>
                    <option value="service">Serviço</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="number"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Justificativa / Descrição
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Descreva o motivo da compra..."
                  rows={3}
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
                  Enviar Solicitação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
