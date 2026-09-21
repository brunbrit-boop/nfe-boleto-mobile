import React, { useState } from 'react';
import type { BlingCliente, BlingContaReceber } from '../../../types';

interface ClientsViewProps {
  clientesBling?: BlingCliente[];
  contasReceber?: BlingContaReceber[];
  carregando?: boolean;
  onRefreshBling?: () => void;
  onEmitirParaCliente?: (cliente: BlingCliente) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clientesBling = [],
  contasReceber = [],
  carregando = false,
  onRefreshBling,
  onEmitirParaCliente,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCpfCnpj, setNewCpfCnpj] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [localClients, setLocalClients] = useState<BlingCliente[]>([]);

  // Clientes combinados (Bling + criados localmente nesta sessão)
  const allClients = [...localClients, ...clientesBling];

  // Mapeia contas a receber por cliente (por id ou documento ou nome)
  const openReceivablesByClient = React.useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();

    contasReceber.forEach((cr) => {
      const isAberto = cr.situacao === 1 || (cr.saldo ?? cr.valor) > 0;
      if (!isAberto) return;

      const valor = Number(cr.saldo ?? cr.valor) || 0;
      const keys: string[] = [];

      if (cr.contato?.id) keys.push(String(cr.contato.id));
      if (cr.contato?.numeroDocumento) keys.push(cr.contato.numeroDocumento.replace(/\D/g, ''));
      if (cr.contato?.nome) keys.push(cr.contato.nome.toLowerCase().trim());

      keys.forEach((k) => {
        const current = map.get(k) || { total: 0, count: 0 };
        map.set(k, {
          total: current.total + valor,
          count: current.count + 1,
        });
      });
    });

    return map;
  }, [contasReceber]);

  const getClientReceivables = (c: BlingCliente) => {
    const idKey = String(c.id);
    const docKey = c.numeroDocumento ? c.numeroDocumento.replace(/\D/g, '') : '';
    const nameKey = (c.nome || c.fantasia || '').toLowerCase().trim();

    return openReceivablesByClient.get(idKey) ||
      (docKey ? openReceivablesByClient.get(docKey) : undefined) ||
      (nameKey ? openReceivablesByClient.get(nameKey) : undefined) ||
      { total: 0, count: 0 };
  };

  // KPIs
  const totalClientes = allClients.length;
  const clientesAtivos = allClients.filter((c) => c.situacao !== 'I').length;
  const totalAReceberAberto = contasReceber
    .filter((cr) => cr.situacao === 1 || (cr.saldo ?? cr.valor) > 0)
    .reduce((acc, curr) => acc + (Number(curr.saldo ?? curr.valor) || 0), 0);

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const novo: BlingCliente = {
      id: Date.now(),
      nome: newName,
      fantasia: newName,
      numeroDocumento: newCpfCnpj || '000.000.000-00',
      tipoPessoa: (newCpfCnpj && newCpfCnpj.length > 14) ? 'J' : 'F',
      email: newEmail,
      telefone: newPhone,
      situacao: 'A',
    };

    setLocalClients([novo, ...localClients]);
    setNewName('');
    setNewCpfCnpj('');
    setNewEmail('');
    setNewPhone('');
    setShowModal(false);
  };

  const filteredClients = allClients.filter((c) => {
    return (
      (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.fantasia || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.numeroDocumento || '').includes(searchTerm) ||
      (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.telefone || '').includes(searchTerm) ||
      (c.celular || '').includes(searchTerm)
    );
  });

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] overflow-y-auto font-['Manrope',sans-serif]">
      {/* Header com Integração Bling */}
      <div className="p-6 md:p-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clientes</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Bling ERP
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Gerencie sua carteira de clientes e faturamento direto com o Bling ERP.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onRefreshBling && (
              <button
                onClick={onRefreshBling}
                disabled={carregando}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 hover:border-[#11d493] hover:text-[#11d493] transition-all shadow-sm disabled:opacity-50"
                title="Recarregar clientes do Bling"
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
              Novo Cliente
            </button>
          </div>
        </div>

        {/* 3 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-[#11d493] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">groups</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total de Clientes</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{totalClientes}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total a Receber em Aberto</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {totalAReceberAberto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">verified</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Clientes Ativos</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{clientesAtivos}</p>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="relative max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#162f27] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#11d493]"
          />
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="px-6 md:px-8 pb-8">
        <div className="bg-white dark:bg-[#162f27] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {filteredClients.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-5xl text-gray-400 mb-3">
                people_outline
              </span>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                Nenhum cliente encontrado
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
                {searchTerm
                  ? 'Nenhum cliente corresponde à pesquisa atual.'
                  : 'Os clientes cadastrados no Bling ERP ou em Contas a Receber aparecerão automaticamente aqui.'}
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
                    <th className="px-6 py-4">Nome do Cliente</th>
                    <th className="px-6 py-4">CPF / CNPJ</th>
                    <th className="px-6 py-4">Contato</th>
                    <th className="px-6 py-4">Saldo a Receber</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ação Rápida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredClients.map((c) => {
                    const balance = getClientReceivables(c);

                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span>{c.nome || c.fantasia || 'Cliente'}</span>
                            {c.fantasia && c.fantasia !== c.nome && (
                              <span className="text-xs text-gray-400 font-normal">({c.fantasia})</span>
                            )}
                          </div>
                          {c.email && (
                            <span className="block text-xs font-normal text-gray-400">{c.email}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {c.numeroDocumento || 'Não informado'}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {c.telefone || c.celular ? (
                            <span className="text-gray-700 dark:text-gray-300">
                              {c.telefone || c.celular}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {balance.total > 0 ? (
                            <div>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {balance.total.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </span>
                              <span className="block text-[11px] text-gray-400">
                                {balance.count} boleto{balance.count > 1 ? 's' : ''} em aberto
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">
                              Nenhum boleto pendente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              c.situacao !== 'I'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                c.situacao !== 'I' ? 'bg-emerald-500' : 'bg-gray-400'
                              }`}
                            />
                            {c.situacao !== 'I' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {onEmitirParaCliente ? (
                            <button
                              onClick={() => onEmitirParaCliente(c)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#11d493]/15 text-[#11d493] hover:bg-[#11d493] hover:text-gray-950 font-bold rounded-lg text-xs transition-all border border-[#11d493]/30 shadow-sm"
                              title="Emitir NF-e ou Boleto Bancário para este cliente"
                            >
                              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                              Emitir NF-e / Boleto
                            </button>
                          ) : (
                            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
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
          )}
        </div>
      </div>

      {/* Modal Adicionar Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Novo Cliente</h3>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Nome / Razão Social
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome do Cliente ou Razão Social"
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
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
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
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Telefone / Celular
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
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
