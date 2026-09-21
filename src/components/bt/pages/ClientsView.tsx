import React, { useState } from 'react';
import type { BlingCliente, BlingContaReceber } from '../../../types';
import {
  Search,
  Plus,
  RefreshCw,
  Users,
  MessageSquare,
  Mail,
  MapPin,
  Check,
  Copy,
  Receipt,
  X,
  ExternalLink,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';

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
  const [filterTipo, setFilterTipo] = useState<'todos' | 'J' | 'F'>('todos');
  const [filterSegmento, setFilterSegmento] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'com_debito'>('todos');
  const [copiedDocId, setCopiedDocId] = useState<number | null>(null);
  const [selectedClientModal, setSelectedClientModal] = useState<BlingCliente | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFantasia, setNewFantasia] = useState('');
  const [newCpfCnpj, setNewCpfCnpj] = useState('');
  const [newSegmento, setNewSegmento] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCidade, setNewCidade] = useState('');
  const [newUf, setNewUf] = useState('SP');
  const [localClients, setLocalClients] = useState<BlingCliente[]>([]);

  // Combina clientes do Bling com novos cadastrados nesta sessão
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

    const rec =
      openReceivablesByClient.get(idKey) ||
      (docKey ? openReceivablesByClient.get(docKey) : undefined) ||
      (nameKey ? openReceivablesByClient.get(nameKey) : undefined);

    if (rec && rec.total > 0) return rec;

    // Fallback caso o cliente tenha saldoDevedor anotado
    if (c.saldoDevedor && c.saldoDevedor > 0) {
      return { total: c.saldoDevedor, count: 1 };
    }

    return { total: 0, count: 0 };
  };

  const handleCopyDoc = (e: React.MouseEvent, clientId: number, doc?: string) => {
    e.stopPropagation();
    if (!doc) return;
    navigator.clipboard.writeText(doc);
    setCopiedDocId(clientId);
    setTimeout(() => setCopiedDocId(null), 1800);
  };

  const handleWhatsApp = (e: React.MouseEvent, tel?: string) => {
    e.stopPropagation();
    if (!tel) return;
    const numLimpo = tel.replace(/\D/g, '');
    const numComDdi = numLimpo.startsWith('55') ? numLimpo : `55${numLimpo}`;
    window.open(`https://api.whatsapp.com/send?phone=${numComDdi}`, '_blank');
  };

  // Lista de segmentos únicos para o filtro
  const segmentosUnicos = React.useMemo(() => {
    const set = new Set<string>();
    allClients.forEach((c) => {
      if (c.segmento) set.add(c.segmento);
    });
    return Array.from(set);
  }, [allClients]);

  // Filtragem dos clientes na tabela
  const filteredClients = allClients.filter((c) => {
    const term = searchTerm.toLowerCase();
    const nome = (c.nome || '').toLowerCase();
    const fantasia = (c.fantasia || '').toLowerCase();
    const doc = (c.numeroDocumento || '').replace(/\D/g, '');
    const email = (c.email || '').toLowerCase();
    const fone = (c.telefone || c.celular || '').replace(/\D/g, '');
    const cidade = (c.endereco?.geral?.municipio || '').toLowerCase();
    const segmento = (c.segmento || '').toLowerCase();
    const cod = (c.codigo || '').toLowerCase();

    const matchesSearch =
      nome.includes(term) ||
      fantasia.includes(term) ||
      doc.includes(term.replace(/\D/g, '')) ||
      email.includes(term) ||
      fone.includes(term.replace(/\D/g, '')) ||
      cidade.includes(term) ||
      segmento.includes(term) ||
      cod.includes(term);

    const matchesTipo = filterTipo === 'todos' || c.tipoPessoa === filterTipo;
    const matchesSegmento = filterSegmento === 'todos' || c.segmento === filterSegmento;

    const balance = getClientReceivables(c);
    const matchesStatus =
      filterStatus === 'todos' ||
      (filterStatus === 'ativo' && c.situacao !== 'I') ||
      (filterStatus === 'com_debito' && balance.total > 0);

    return matchesSearch && matchesTipo && matchesSegmento && matchesStatus;
  });

  // KPIs
  const totalClientes = allClients.length;
  const clientesAtivos = allClients.filter((c) => c.situacao !== 'I').length;
  const totalAReceberAberto = contasReceber
    .filter((cr) => cr.situacao === 1 || (cr.saldo ?? cr.valor) > 0)
    .reduce((acc, curr) => acc + (Number(curr.saldo ?? curr.valor) || 0), 0);

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const isPJ = newCpfCnpj ? newCpfCnpj.replace(/\D/g, '').length > 11 : true;
    const novo: BlingCliente = {
      id: Date.now(),
      codigo: `CLI-${String(allClients.length + 1).padStart(3, '0')}`,
      nome: newName.trim(),
      fantasia: newFantasia.trim() || newName.trim(),
      numeroDocumento: newCpfCnpj || '00.000.000/0000-00',
      tipoPessoa: isPJ ? 'J' : 'F',
      email: newEmail.trim(),
      telefone: newPhone.trim(),
      celular: newPhone.trim(),
      situacao: 'A',
      segmento: newSegmento.trim() || 'Geral',
      tipoContato: 'Cliente',
      condicaoPagamento: 'A Combinar',
      regimeTributario: 'Simples Nacional',
      endereco: {
        geral: {
          endereco: '',
          numero: '',
          bairro: '',
          cep: '',
          municipio: newCidade.trim() || 'São Paulo',
          uf: newUf || 'SP',
        },
      },
      saldoDevedor: 0,
      limiteCredito: 30000,
    };

    setLocalClients([novo, ...localClients]);
    setNewName('');
    setNewFantasia('');
    setNewCpfCnpj('');
    setNewSegmento('');
    setNewEmail('');
    setNewPhone('');
    setNewCidade('');
    setShowAddModal(false);
  };

  const getIniciais = (nome: string) => {
    if (!nome) return 'CL';
    const partes = nome.trim().split(' ');
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  };

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] overflow-y-auto font-['Manrope',sans-serif] transition-colors">
      {/* Top Banner & Header de Ações */}
      <div className="p-6 md:p-8 pb-4 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Carteira de Clientes
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-[#11d493] animate-pulse" />
                Bling ERP v3
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">
              Base oficial sincronizada de contatos, dados fiscais, faturamento e contas a receber.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onRefreshBling && (
              <button
                onClick={onRefreshBling}
                disabled={carregando}
                className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-[#214739] text-gray-700 dark:text-gray-200 hover:border-[#11d493] hover:text-[#11d493] transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Sincronizar base de contatos com a API do Bling"
              >
                <RefreshCw className={`w-4 h-4 text-[#11d493] ${carregando ? 'animate-spin' : ''}`} />
                <span>{carregando ? 'Buscando no Bling...' : 'Sincronizar Bling'}</span>
              </button>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#11d493] text-gray-950 rounded-xl font-black text-xs hover:bg-[#0eb880] active:scale-95 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.8]" />
              <span>Novo Cliente</span>
            </button>
          </div>
        </div>

        {/* 3 KPI Cards de Alta Performance */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-[#214739] shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-[#11d493] flex items-center justify-center font-bold border border-emerald-500/20 shrink-0">
              <Users className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
                Total de Clientes
              </p>
              <p className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                {totalClientes}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-[#214739] shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/20 shrink-0">
              <CreditCard className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
                A Receber em Aberto
              </p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                {totalAReceberAberto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-[#214739] shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center font-bold border border-blue-500/20 shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-400">
                Clientes Ativos
              </p>
              <p className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                {clientesAtivos}
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Busca e Filtros Avançados */}
        <div className="bg-white dark:bg-[#162f27] rounded-2xl p-3.5 border border-gray-200 dark:border-[#214739] shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Input de Busca */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por Nome, Fantasia, CNPJ, Cidade, Segmento, E-mail ou Fone..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-[#214739] bg-gray-50/50 dark:bg-[#10221c] text-gray-900 dark:text-white text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#11d493]/30 focus:border-[#11d493] transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtros em Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro PJ / PF */}
              <div className="flex items-center bg-gray-100 dark:bg-[#10221c] p-1 rounded-xl border border-gray-200 dark:border-[#214739] text-xs font-bold">
                <button
                  onClick={() => setFilterTipo('todos')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filterTipo === 'todos'
                      ? 'bg-white dark:bg-[#162f27] text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilterTipo('J')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filterTipo === 'J'
                      ? 'bg-white dark:bg-[#162f27] text-[#11d493] shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  PJ
                </button>
                <button
                  onClick={() => setFilterTipo('F')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filterTipo === 'F'
                      ? 'bg-white dark:bg-[#162f27] text-blue-500 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  PF
                </button>
              </div>

              {/* Filtro por Status / Débito */}
              <div className="flex items-center bg-gray-100 dark:bg-[#10221c] p-1 rounded-xl border border-gray-200 dark:border-[#214739] text-xs font-bold">
                <button
                  onClick={() => setFilterStatus('todos')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filterStatus === 'todos'
                      ? 'bg-white dark:bg-[#162f27] text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  Status: Todos
                </button>
                <button
                  onClick={() => setFilterStatus('com_debito')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filterStatus === 'com_debito'
                      ? 'bg-white dark:bg-[#162f27] text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  Com Títulos
                </button>
              </div>

              {/* Filtro por Segmento */}
              {segmentosUnicos.length > 0 && (
                <select
                  value={filterSegmento}
                  onChange={(e) => setFilterSegmento(e.target.value)}
                  className="text-xs font-bold px-3 py-2 rounded-xl bg-gray-100 dark:bg-[#10221c] border border-gray-200 dark:border-[#214739] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#11d493]/30 cursor-pointer"
                >
                  <option value="todos">Todos os Segmentos</option>
                  {segmentosUnicos.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-[#214739]">
            <span>
              Exibindo <strong className="text-gray-900 dark:text-white">{filteredClients.length}</strong> de <strong className="text-gray-900 dark:text-white">{allClients.length}</strong> clientes
            </span>

            {(searchTerm || filterTipo !== 'todos' || filterSegmento !== 'todos') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterTipo('todos');
                  setFilterSegmento('todos');
                }}
                className="text-xs font-bold text-[#11d493] hover:underline"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* A TABELA MODELO GIGANTONA DE CLIENTES */}
      <div className="px-6 md:px-8 pb-10 flex-1">
        <div className="bg-white dark:bg-[#162f27] rounded-2xl border border-gray-200 dark:border-[#214739] shadow-sm overflow-hidden">
          {filteredClients.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Users className="w-12 h-12 text-gray-400 mx-auto stroke-[1.5]" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Nenhum cliente encontrado
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                {searchTerm
                  ? 'Nenhum cliente corresponde aos filtros aplicados.'
                  : 'Sincronize com o Bling ERP para importar automaticamente todos os contatos do tipo Cliente.'}
              </p>
              {onRefreshBling && (
                <button
                  onClick={onRefreshBling}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#11d493] text-gray-950 font-bold rounded-xl text-xs hover:bg-[#0eb880] shadow-md shadow-emerald-500/20"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Buscar no Bling Agora</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300 border-collapse min-w-[1000px]">
                <thead className="bg-gray-50 dark:bg-[#10221c]/90 text-[11px] uppercase font-extrabold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#214739] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3.5">Cód / Cliente</th>
                    <th className="px-4 py-3.5">CNPJ / CPF</th>
                    <th className="px-4 py-3.5">Segmento</th>
                    <th className="px-4 py-3.5">Localidade</th>
                    <th className="px-4 py-3.5">Contato & WhatsApp</th>
                    <th className="px-4 py-3.5">Condição / Regime</th>
                    <th className="px-4 py-3.5">Saldo em Aberto</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Ações Fiscais</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200/80 dark:divide-[#214739]">
                  {filteredClients.map((c) => {
                    const balance = getClientReceivables(c);
                    const isCopied = copiedDocId === c.id;
                    const iniciais = getIniciais(c.fantasia || c.nome);
                    const fone = c.telefone || c.celular;

                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedClientModal(c)}
                        className="hover:bg-emerald-50/40 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        {/* 1. Cód & Nome do Cliente */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm shrink-0">
                              {iniciais}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {c.codigo && (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                    {c.codigo}
                                  </span>
                                )}
                                <span className="font-extrabold text-gray-900 dark:text-white truncate group-hover:text-[#11d493] transition-colors">
                                  {c.fantasia || c.nome}
                                </span>
                              </div>
                              <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-xs font-medium">
                                {c.nome}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. CNPJ / CPF com Cópia Rápida */}
                        <td className="px-4 py-3.5">
                          <div
                            onClick={(e) => handleCopyDoc(e, c.id, c.numeroDocumento)}
                            className="inline-flex items-center gap-1.5 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200/60 dark:border-gray-700 transition cursor-pointer"
                            title="Clique para copiar o documento"
                          >
                            <span
                              className={`text-[9px] font-bold px-1 py-0.2 rounded uppercase ${
                                c.tipoPessoa === 'J'
                                  ? 'bg-emerald-500/10 text-[#11d493]'
                                  : 'bg-blue-500/10 text-blue-500'
                              }`}
                            >
                              {c.tipoPessoa === 'J' ? 'PJ' : 'PF'}
                            </span>
                            <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                              {c.numeroDocumento || 'Não informado'}
                            </span>
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-[#11d493]" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                            )}
                          </div>
                        </td>

                        {/* 3. Segmento */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-[#10221c] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                            {c.segmento || 'Geral'}
                          </span>
                        </td>

                        {/* 4. Localidade */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>
                              {c.endereco?.geral?.municipio
                                ? `${c.endereco.geral.municipio}/${c.endereco.geral.uf || 'SP'}`
                                : 'São Paulo/SP'}
                            </span>
                          </div>
                        </td>

                        {/* 5. Contato & WhatsApp */}
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            {fone ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-gray-800 dark:text-gray-200 font-medium">
                                  {fone}
                                </span>
                                <button
                                  onClick={(e) => handleWhatsApp(e, fone)}
                                  className="p-1 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-[#11d493] transition"
                                  title="Abrir conversa no WhatsApp"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}

                            {c.email && (
                              <a
                                href={`mailto:${c.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-[#11d493] truncate max-w-[180px]"
                              >
                                <Mail className="w-3 h-3 shrink-0" />
                                <span className="truncate">{c.email}</span>
                              </a>
                            )}
                          </div>
                        </td>

                        {/* 6. Condição & Regime */}
                        <td className="px-4 py-3.5 text-[11px] text-gray-600 dark:text-gray-300">
                          <div className="font-semibold">{c.condicaoPagamento || 'A Combinar'}</div>
                          <div className="text-[10px] text-gray-400">{c.regimeTributario || 'Simples Nacional'}</div>
                        </td>

                        {/* 7. Saldo em Aberto */}
                        <td className="px-4 py-3.5">
                          {balance.total > 0 ? (
                            <div>
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
                                {balance.total.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </span>
                              <span className="block text-[10px] text-gray-400">
                                {balance.count} boleto{balance.count > 1 ? 's' : ''} pendente
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[11px] font-medium">
                              R$ 0,00 (Quitado)
                            </span>
                          )}
                        </td>

                        {/* 8. Status */}
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              c.situacao !== 'I'
                                ? 'bg-emerald-500/10 text-[#11d493] border border-emerald-500/20'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                c.situacao !== 'I' ? 'bg-[#11d493]' : 'bg-gray-400'
                              }`}
                            />
                            {c.situacao !== 'I' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>

                        {/* 9. Ações Fiscais */}
                        <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          {onEmitirParaCliente ? (
                            <button
                              onClick={() => onEmitirParaCliente(c)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#11d493] text-gray-950 hover:bg-[#0eb880] font-black rounded-xl text-xs transition shadow-sm active:scale-95 cursor-pointer"
                              title="Emitir NF-e ou Boleto com Pix para este cliente"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Emitir</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedClientModal(c)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
                            >
                              <ExternalLink className="w-4 h-4" />
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

      {/* Modal / Prontuário Completo do Cliente */}
      {selectedClientModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-[#214739] space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-slate-950 font-black text-base flex items-center justify-center shadow-md">
                  {getIniciais(selectedClientModal.fantasia || selectedClientModal.nome)}
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">
                    {selectedClientModal.fantasia || selectedClientModal.nome}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {selectedClientModal.nome}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClientModal(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-gray-100 dark:border-[#214739]">
              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  CNPJ / CPF
                </span>
                <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                  {selectedClientModal.numeroDocumento}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Segmento
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {selectedClientModal.segmento || 'Geral'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Localidade
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {selectedClientModal.endereco?.geral?.municipio || 'São Paulo'} / {selectedClientModal.endereco?.geral?.uf || 'SP'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Condição de Pagamento
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {selectedClientModal.condicaoPagamento || 'A Combinar'}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-[#214739]">
              {onEmitirParaCliente && (
                <button
                  onClick={() => {
                    const c = selectedClientModal;
                    setSelectedClientModal(null);
                    onEmitirParaCliente(c);
                  }}
                  className="px-4 py-2.5 text-xs font-black bg-[#11d493] text-gray-950 rounded-xl hover:bg-[#0eb880] shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Emitir NF-e / Boleto</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Cliente */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-[#214739] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#11d493]" />
                <span>Novo Cliente Bling</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddClient} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: NFS CONSTRUCOES LTDA"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    value={newFantasia}
                    onChange={(e) => setNewFantasia(e.target.value)}
                    placeholder="Ex: NFS CONSTRUCOES"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">
                    CNPJ ou CPF
                  </label>
                  <input
                    type="text"
                    value={newCpfCnpj}
                    onChange={(e) => setNewCpfCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Segmento
                  </label>
                  <input
                    type="text"
                    value={newSegmento}
                    onChange={(e) => setNewSegmento(e.target.value)}
                    placeholder="Ex: Construtora, Varejista..."
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Cidade / UF
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCidade}
                      onChange={(e) => setNewCidade(e.target.value)}
                      placeholder="Cidade"
                      className="flex-1 px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newUf}
                      onChange={(e) => setNewUf(e.target.value.toUpperCase())}
                      placeholder="UF"
                      maxLength={2}
                      className="w-12 text-center px-2 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none font-bold uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="contato@cliente.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Telefone / Celular
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-[#214739]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black bg-[#11d493] text-gray-950 rounded-xl hover:bg-[#0eb880] shadow-md shadow-emerald-500/20 cursor-pointer"
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
