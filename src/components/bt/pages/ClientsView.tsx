import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Building2,
  CheckSquare,
  Square,
  MinusSquare,
  Loader2,
  FileSearch,
  Globe,
  DollarSign,
  Briefcase,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import {
  consultarCnpjReceita,
  mesclarDadosCartaoNoCliente,
  salvarCacheClientesEnriquecidos,
  obterCacheClientesEnriquecidos,
  formatarCNPJ,
  formatarDataBr,
} from '../../../services/cnpjService';

interface ClientsViewProps {
  empresaId?: string;
  clientesBling?: BlingCliente[];
  contasReceber?: BlingContaReceber[];
  carregando?: boolean;
  onRefreshBling?: () => void;
  onEmitirParaCliente?: (cliente: BlingCliente) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  empresaId = 'default',
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

  // Seleção e Consulta em Lote
  const [selectedClientIds, setSelectedClientIds] = useState<Set<number>>(new Set());
  const [isConsultandoLote, setIsConsultandoLote] = useState(false);
  const [progressoLote, setProgressoLote] = useState<{
    atual: number;
    total: number;
    clienteNome: string;
    mensagem: string;
  } | null>(null);
  const [singleConsultandoId, setSingleConsultandoId] = useState<number | null>(null);
  const [consultaErro, setConsultaErro] = useState<string | null>(null);
  const [showSecundariosModal, setShowSecundariosModal] = useState(false);
  const cancelarLoteRef = useRef<boolean>(false);

  // Cache de dados da Receita Federal persistidos
  const [enriquecimentoMap, setEnriquecimentoMap] = useState<Record<string, Partial<BlingCliente>>>(() => {
    return obterCacheClientesEnriquecidos(empresaId);
  });

  // Atualiza cache ao trocar de empresa
  useEffect(() => {
    setEnriquecimentoMap(obterCacheClientesEnriquecidos(empresaId));
  }, [empresaId]);

  // Modal Novo Cliente
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

  // Combina clientes do Bling + locais e mescla os dados enriquecidos da Receita
  const allClients = useMemo(() => {
    const base = [...localClients, ...clientesBling];
    return base.map((c) => {
      const docLimpo = (c.numeroDocumento || '').replace(/\D/g, '');
      const enriquecido = docLimpo ? enriquecimentoMap[docLimpo] : undefined;
      if (enriquecido) {
        return {
          ...c,
          ...enriquecido,
          endereco: {
            ...c.endereco,
            geral: {
              ...c.endereco?.geral,
              ...enriquecido.endereco?.geral,
            },
          },
        };
      }
      return c;
    });
  }, [localClients, clientesBling, enriquecimentoMap]);

  // Mapeia contas a receber por cliente
  const openReceivablesByClient = useMemo(() => {
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
  const segmentosUnicos = useMemo(() => {
    const set = new Set<string>();
    allClients.forEach((c) => {
      if (c.segmento) set.add(c.segmento);
    });
    return Array.from(set);
  }, [allClients]);

  // Filtragem dos clientes na tabela
  const filteredClients = useMemo(() => {
    return allClients.filter((c) => {
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
  }, [allClients, searchTerm, filterTipo, filterSegmento, filterStatus, openReceivablesByClient]);

  // Gerenciamento de Seleção
  const toggleSelectClient = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllVisibleSelected =
    filteredClients.length > 0 && filteredClients.every((c) => selectedClientIds.has(c.id));
  const isSomeVisibleSelected =
    filteredClients.some((c) => selectedClientIds.has(c.id)) && !isAllVisibleSelected;

  const handleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(filteredClients.map((c) => c.id)));
    }
  };

  // Consulta Individual
  const handleConsultarIndividual = async (cliente: BlingCliente) => {
    const docLimpo = (cliente.numeroDocumento || '').replace(/\D/g, '');
    if (docLimpo.length !== 14) {
      setConsultaErro('Apenas clientes PJ com CNPJ de 14 dígitos podem ser consultados na Receita.');
      setTimeout(() => setConsultaErro(null), 4000);
      return;
    }

    setSingleConsultandoId(cliente.id);
    setConsultaErro(null);

    try {
      const dados = await consultarCnpjReceita(docLimpo);
      const atualizado = mesclarDadosCartaoNoCliente(cliente, dados);

      const novoCacheItem: Partial<BlingCliente> = {
        nome: atualizado.nome,
        fantasia: atualizado.fantasia,
        situacaoCadastral: atualizado.situacaoCadastral,
        dataSituacaoCadastral: atualizado.dataSituacaoCadastral,
        motivoSituacaoCadastral: atualizado.motivoSituacaoCadastral,
        dataAbertura: atualizado.dataAbertura,
        naturezaJuridica: atualizado.naturezaJuridica,
        porte: atualizado.porte,
        capitalSocial: atualizado.capitalSocial,
        cnaePrincipal: atualizado.cnaePrincipal,
        cnaesSecundarios: atualizado.cnaesSecundarios,
        qsa: atualizado.qsa,
        consultadoEm: atualizado.consultadoEm,
        endereco: atualizado.endereco,
      };

      const novoMapa = {
        ...enriquecimentoMap,
        [docLimpo]: novoCacheItem,
      };

      setEnriquecimentoMap(novoMapa);
      salvarCacheClientesEnriquecidos(empresaId, novoMapa);

      if (selectedClientModal && selectedClientModal.id === cliente.id) {
        setSelectedClientModal(atualizado);
      }
    } catch (err: any) {
      setConsultaErro(err.message || 'Erro ao consultar Receita Federal.');
      setTimeout(() => setConsultaErro(null), 4500);
    } finally {
      setSingleConsultandoId(null);
    }
  };

  // Consulta em Lote com Pacing Anti-Bloqueio
  const handleConsultarEmLote = async () => {
    const selecionados = filteredClients.filter((c) => selectedClientIds.has(c.id));
    const candidatos = selecionados.filter((c) => {
      const doc = (c.numeroDocumento || '').replace(/\D/g, '');
      return doc.length === 14;
    });

    if (candidatos.length === 0) {
      setConsultaErro('Nenhum cliente PJ com CNPJ de 14 dígitos está selecionado.');
      setTimeout(() => setConsultaErro(null), 4000);
      return;
    }

    setIsConsultandoLote(true);
    cancelarLoteRef.current = false;
    setConsultaErro(null);

    const novoMapa = { ...enriquecimentoMap };

    for (let i = 0; i < candidatos.length; i++) {
      if (cancelarLoteRef.current) break;

      const cliente = candidatos[i];
      const docLimpo = cliente.numeroDocumento!.replace(/\D/g, '');
      const nomeExibicao = cliente.fantasia || cliente.nome || formatarCNPJ(docLimpo);

      setProgressoLote({
        atual: i + 1,
        total: candidatos.length,
        clienteNome: nomeExibicao,
        mensagem: `Consultando (${i + 1} de ${candidatos.length})...`,
      });

      try {
        const dados = await consultarCnpjReceita(docLimpo);
        const atualizado = mesclarDadosCartaoNoCliente(cliente, dados);

        novoMapa[docLimpo] = {
          nome: atualizado.nome,
          fantasia: atualizado.fantasia,
          situacaoCadastral: atualizado.situacaoCadastral,
          dataSituacaoCadastral: atualizado.dataSituacaoCadastral,
          motivoSituacaoCadastral: atualizado.motivoSituacaoCadastral,
          dataAbertura: atualizado.dataAbertura,
          naturezaJuridica: atualizado.naturezaJuridica,
          porte: atualizado.porte,
          capitalSocial: atualizado.capitalSocial,
          cnaePrincipal: atualizado.cnaePrincipal,
          cnaesSecundarios: atualizado.cnaesSecundarios,
          qsa: atualizado.qsa,
          consultadoEm: atualizado.consultadoEm,
          endereco: atualizado.endereco,
        };

        setEnriquecimentoMap({ ...novoMapa });
        salvarCacheClientesEnriquecidos(empresaId, novoMapa);
      } catch (err: any) {
        console.warn(`[Lote] Falha ao consultar CNPJ ${docLimpo}:`, err);
      }

      // Intervalo de segurança (1.3s) entre requisições para evitar rate limit
      if (i < candidatos.length - 1 && !cancelarLoteRef.current) {
        await new Promise((res) => setTimeout(res, 1300));
      }
    }

    setIsConsultandoLote(false);
    setProgressoLote(null);
  };

  const handleCancelarLote = () => {
    cancelarLoteRef.current = true;
    setIsConsultandoLote(false);
    setProgressoLote(null);
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

  // Cliente atualmente inspecionado no modal
  const activeClientInModal = useMemo(() => {
    if (!selectedClientModal) return null;
    const docLimpo = (selectedClientModal.numeroDocumento || '').replace(/\D/g, '');
    const enriquecido = docLimpo ? enriquecimentoMap[docLimpo] : undefined;
    if (enriquecido) {
      return {
        ...selectedClientModal,
        ...enriquecido,
        endereco: {
          ...selectedClientModal.endereco,
          geral: {
            ...selectedClientModal.endereco?.geral,
            ...enriquecido.endereco?.geral,
          },
        },
      };
    }
    return selectedClientModal;
  }, [selectedClientModal, enriquecimentoMap]);

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
              Base oficial com Cartão CNPJ Receita Federal, Sintegra e limites financeiros.
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
                <span>{carregando ? 'Buscando...' : 'Sincronizar Bling'}</span>
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

        {/* 3 KPI Cards */}
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

        {/* Notificação de Erro / Alerta Temporário */}
        {consultaErro && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{consultaErro}</span>
            </div>
            <button
              onClick={() => setConsultaErro(null)}
              className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Barra de Busca e Filtros */}
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
              Exibindo <strong className="text-gray-900 dark:text-white">{filteredClients.length}</strong> de{' '}
              <strong className="text-gray-900 dark:text-white">{allClients.length}</strong> clientes
            </span>

            {(searchTerm || filterTipo !== 'todos' || filterSegmento !== 'todos') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterTipo('todos');
                  setFilterSegmento('todos');
                }}
                className="text-xs font-bold text-[#11d493] hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE AÇÃO EM LOTE (Aparece quando há seleção) */}
        {selectedClientIds.size > 0 && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/15 border border-[#11d493]/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-[#11d493] text-gray-950 font-black text-xs flex items-center justify-center shadow-sm">
                {selectedClientIds.size}
              </span>
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  {selectedClientIds.size} cliente{selectedClientIds.size > 1 ? 's' : ''} selecionado{selectedClientIds.size > 1 ? 's' : ''}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Consulta de dados oficiais na Receita Federal e Sintegra
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {isConsultandoLote ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#11d493]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progressoLote?.mensagem || 'Consultando...'}</span>
                  </div>
                  <button
                    onClick={handleCancelarLote}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleConsultarEmLote}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#11d493] text-gray-950 font-black rounded-xl text-xs hover:bg-[#0eb880] transition shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  >
                    <FileSearch className="w-4 h-4 stroke-[2.4]" />
                    <span>Consultar Cartão CNPJ</span>
                  </button>

                  <button
                    onClick={() => setSelectedClientIds(new Set())}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-white/10 transition cursor-pointer"
                  >
                    Desmarcar
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* A TABELA DE CLIENTES */}
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#11d493] text-gray-950 font-bold rounded-xl text-xs hover:bg-[#0eb880] shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Buscar no Bling</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300 border-collapse min-w-[1050px]">
                <thead className="bg-gray-50 dark:bg-[#10221c]/90 text-[11px] uppercase font-extrabold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#214739] sticky top-0 z-10">
                  <tr>
                    {/* Checkbox em Lote */}
                    <th className="w-10 px-3 py-3.5 text-center">
                      <button
                        onClick={handleSelectAllVisible}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
                        title={isAllVisibleSelected ? 'Desmarcar todos' : 'Selecionar todos os visíveis'}
                      >
                        {isAllVisibleSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#11d493]" />
                        ) : isSomeVisibleSelected ? (
                          <MinusSquare className="w-4 h-4 text-[#11d493]" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-3.5">Cód / Cliente</th>
                    <th className="px-3 py-3.5">CNPJ / CPF</th>
                    <th className="px-3 py-3.5">Cartão CNPJ / Situação</th>
                    <th className="px-3 py-3.5">Localidade</th>
                    <th className="px-3 py-3.5">Contato & WhatsApp</th>
                    <th className="px-3 py-3.5">Condição / Regime</th>
                    <th className="px-3 py-3.5">Saldo em Aberto</th>
                    <th className="px-3 py-3.5">Status</th>
                    <th className="px-3 py-3.5 text-right">Ações Fiscais</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200/80 dark:divide-[#214739]">
                  {filteredClients.map((c) => {
                    const balance = getClientReceivables(c);
                    const isCopied = copiedDocId === c.id;
                    const iniciais = getIniciais(c.fantasia || c.nome);
                    const fone = c.telefone || c.celular;
                    const isSelected = selectedClientIds.has(c.id);
                    const isConsulting = singleConsultandoId === c.id;
                    const docLimpo = (c.numeroDocumento || '').replace(/\D/g, '');
                    const isPJ = docLimpo.length === 14;

                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedClientModal(c)}
                        className={`transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/20'
                            : 'hover:bg-emerald-50/40 dark:hover:bg-white/5'
                        }`}
                      >
                        {/* 0. Checkbox Seleção */}
                        <td
                          className="w-10 px-3 py-3.5 text-center"
                          onClick={(e) => toggleSelectClient(c.id, e)}
                        >
                          <button
                            type="button"
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#11d493]" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </td>

                        {/* 1. Cód & Nome do Cliente */}
                        <td className="px-3 py-3.5">
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
                        <td className="px-3 py-3.5">
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

                        {/* 3. Situação Cadastral Receita Federal / Cartão CNPJ */}
                        <td className="px-3 py-3.5">
                          {c.situacaoCadastral ? (
                            <div className="flex flex-col gap-0.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold w-fit ${
                                  c.situacaoCadastral === 'ATIVA'
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    c.situacaoCadastral === 'ATIVA' ? 'bg-[#11d493]' : 'bg-rose-500'
                                  }`}
                                />
                                {c.situacaoCadastral}
                              </span>
                              {c.cnaePrincipal?.codigo && (
                                <span
                                  className="text-[10px] text-gray-400 truncate max-w-[170px]"
                                  title={`${c.cnaePrincipal.codigo} - ${c.cnaePrincipal.descricao}`}
                                >
                                  CNAE: {c.cnaePrincipal.codigo}
                                </span>
                              )}
                            </div>
                          ) : isPJ ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConsultarIndividual(c);
                              }}
                              disabled={isConsulting}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-[#11d493] border border-emerald-500/20 transition cursor-pointer"
                              title="Consultar Cartão CNPJ e Sintegra na Receita Federal"
                            >
                              {isConsulting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <FileSearch className="w-3 h-3" />
                              )}
                              <span>{isConsulting ? 'Consultando...' : 'Consultar CNPJ'}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400">Pessoa Física</span>
                          )}
                        </td>

                        {/* 4. Localidade */}
                        <td className="px-3 py-3.5">
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
                        <td className="px-3 py-3.5">
                          <div className="space-y-1">
                            {fone ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-gray-800 dark:text-gray-200 font-medium">
                                  {fone}
                                </span>
                                <button
                                  onClick={(e) => handleWhatsApp(e, fone)}
                                  className="p-1 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-[#11d493] transition cursor-pointer"
                                  title="Abrir WhatsApp"
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
                        <td className="px-3 py-3.5 text-[11px] text-gray-600 dark:text-gray-300">
                          <div className="font-semibold">{c.condicaoPagamento || 'A Combinar'}</div>
                          <div className="text-[10px] text-gray-400">{c.regimeTributario || 'Simples Nacional'}</div>
                        </td>

                        {/* 7. Saldo em Aberto */}
                        <td className="px-3 py-3.5">
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
                        <td className="px-3 py-3.5">
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
                        <td className="px-3 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          {onEmitirParaCliente ? (
                            <button
                              onClick={() => onEmitirParaCliente(c)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#11d493] text-gray-950 hover:bg-[#0eb880] font-black rounded-xl text-xs transition shadow-sm active:scale-95 cursor-pointer"
                              title="Emitir NF-e ou Boleto"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Emitir</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedClientModal(c)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
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

      {/* MODAL COMPLETO: CARTÃO CNPJ & SINTEGRA */}
      {activeClientInModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#162f27] rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-gray-200 dark:border-[#214739] space-y-5 my-8 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            {/* Header com Emblema e Fechar */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100 dark:border-[#214739]">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-slate-950 font-black text-lg flex items-center justify-center shadow-md shrink-0">
                  <Building2 className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-[#11d493] border border-emerald-500/20">
                      Cartão CNPJ & Sintegra
                    </span>
                    {activeClientInModal.situacaoCadastral && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          activeClientInModal.situacaoCadastral === 'ATIVA'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            activeClientInModal.situacaoCadastral === 'ATIVA' ? 'bg-[#11d493]' : 'bg-rose-500'
                          }`}
                        />
                        {activeClientInModal.situacaoCadastral}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white truncate mt-1">
                    {activeClientInModal.fantasia || activeClientInModal.nome}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
                    {activeClientInModal.nome}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedClientModal(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Documentos Fiscais: CNPJ e Inscrição Estadual (Sintegra) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/70 dark:border-gray-700/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                    CNPJ / Documento
                  </span>
                  <span className="font-mono font-black text-sm text-gray-900 dark:text-white">
                    {formatarCNPJ(activeClientInModal.numeroDocumento || '')}
                  </span>
                </div>
                <button
                  onClick={(e) => handleCopyDoc(e, activeClientInModal.id, activeClientInModal.numeroDocumento)}
                  className="p-2 rounded-xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-700 hover:border-[#11d493] text-gray-600 dark:text-gray-300 transition cursor-pointer"
                  title="Copiar CNPJ"
                >
                  {copiedDocId === activeClientInModal.id ? (
                    <Check className="w-4 h-4 text-[#11d493]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/70 dark:border-gray-700/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                    Inscrição Estadual (Sintegra)
                  </span>
                  <span className="font-mono font-bold text-xs text-gray-800 dark:text-gray-200">
                    {activeClientInModal.ie || 'Não informada'}
                  </span>
                </div>
                <a
                  href="http://www.sintegra.gov.br/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-700 hover:border-[#11d493] text-[11px] font-bold text-[#11d493] transition cursor-pointer"
                  title="Consultar Sintegra Estadual"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Sintegra</span>
                </a>
              </div>
            </div>

            {/* Quadro Cadastral Completo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700/50">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-gray-400" /> Abertura
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {formatarDataBr(activeClientInModal.dataAbertura)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700/50">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-gray-400" /> Porte
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-200 truncate block">
                  {activeClientInModal.porte || 'Demais'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700/50">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-gray-400" /> Capital Social
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {typeof activeClientInModal.capitalSocial === 'number'
                    ? activeClientInModal.capitalSocial.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })
                    : '-'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700/50">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-gray-400" /> Situação
                </span>
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {formatarDataBr(activeClientInModal.dataSituacaoCadastral)}
                </span>
              </div>
            </div>

            {/* Natureza Jurídica */}
            {activeClientInModal.naturezaJuridica && (
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700/50 text-xs">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                  Natureza Jurídica
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {activeClientInModal.naturezaJuridica}
                </span>
              </div>
            )}

            {/* Atividades Econômicas (CNAEs) */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700/50 space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#11d493]" />
                Atividade Econômica Principal (CNAE)
              </span>

              {activeClientInModal.cnaePrincipal?.codigo ? (
                <div className="text-xs">
                  <span className="font-mono font-black text-[#11d493] bg-emerald-500/10 px-2 py-0.5 rounded-md mr-2">
                    {activeClientInModal.cnaePrincipal.codigo}
                  </span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {activeClientInModal.cnaePrincipal.descricao}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  {activeClientInModal.segmento || 'Não informado pela base'}
                </p>
              )}

              {/* CNAEs Secundários Colapsáveis */}
              {activeClientInModal.cnaesSecundarios && activeClientInModal.cnaesSecundarios.length > 0 && (
                <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700/50">
                  <button
                    onClick={() => setShowSecundariosModal(!showSecundariosModal)}
                    className="flex items-center justify-between w-full text-[11px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                  >
                    <span>{activeClientInModal.cnaesSecundarios.length} Atividades Secundárias</span>
                    {showSecundariosModal ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {showSecundariosModal && (
                    <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {activeClientInModal.cnaesSecundarios.map((cnae, idx) => (
                        <div key={idx} className="text-[11px] flex items-start gap-1.5">
                          <span className="font-mono font-bold text-gray-500 dark:text-gray-400 shrink-0">
                            {cnae.codigo}
                          </span>
                          <span className="text-gray-700 dark:text-gray-300">{cnae.descricao}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quadro de Sócios e Administradores (QSA) */}
            {activeClientInModal.qsa && activeClientInModal.qsa.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700/50 space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  Quadro de Sócios e Administradores (QSA)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeClientInModal.qsa.map((socio, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-white dark:bg-[#162f27] border border-gray-200/60 dark:border-gray-700/50 text-xs"
                    >
                      <p className="font-bold text-gray-900 dark:text-white truncate">{socio.nome}</p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {socio.qual || 'Sócio'} {socio.faixaEtaria ? `• ${socio.faixaEtaria}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Endereço Fiscal Completo com link Google Maps */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#11d493]" /> Endereço Fiscal Cadastrado
                </span>
                <p className="font-semibold text-gray-800 dark:text-gray-200 leading-snug">
                  {[
                    activeClientInModal.endereco?.geral?.endereco,
                    activeClientInModal.endereco?.geral?.numero,
                    activeClientInModal.endereco?.geral?.complemento,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'Endereço não cadastrado'}
                </p>
                <p className="text-[11px] text-gray-400">
                  {[
                    activeClientInModal.endereco?.geral?.bairro,
                    activeClientInModal.endereco?.geral?.municipio,
                    activeClientInModal.endereco?.geral?.uf,
                    activeClientInModal.endereco?.geral?.cep,
                  ]
                    .filter(Boolean)
                    .join(' - ')}
                </p>
              </div>

              {activeClientInModal.endereco?.geral?.municipio && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${activeClientInModal.endereco.geral.endereco || ''} ${
                      activeClientInModal.endereco.geral.numero || ''
                    }, ${activeClientInModal.endereco.geral.municipio || ''} - ${
                      activeClientInModal.endereco.geral.uf || ''
                    }`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-gray-700 hover:border-[#11d493] text-gray-700 dark:text-gray-200 text-xs font-bold transition shrink-0 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#11d493]" />
                  <span>Ver no Maps</span>
                </a>
              )}
            </div>

            {/* Rodapé com Ações do Modal */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-[#214739]">
              <span className="text-[10px] text-gray-400">
                {activeClientInModal.consultadoEm
                  ? `Atualizado em ${formatarDataBr(activeClientInModal.consultadoEm)}`
                  : 'Nenhuma consulta efetuada ainda'}
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {/* Botão Consultar Receita Agora */}
                <button
                  onClick={() => handleConsultarIndividual(activeClientInModal)}
                  disabled={singleConsultandoId === activeClientInModal.id}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#214739] text-gray-700 dark:text-gray-200 hover:border-[#11d493] hover:text-[#11d493] text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  title="Atualizar dados cadastrais via Receita Federal"
                >
                  {singleConsultandoId === activeClientInModal.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#11d493]" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-[#11d493]" />
                  )}
                  <span>
                    {singleConsultandoId === activeClientInModal.id ? 'Consultando...' : 'Atualizar Dados'}
                  </span>
                </button>

                {onEmitirParaCliente && (
                  <button
                    onClick={() => {
                      const c = activeClientInModal;
                      setSelectedClientModal(null);
                      onEmitirParaCliente(c);
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-black bg-[#11d493] text-gray-950 rounded-xl hover:bg-[#0eb880] shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Emitir NF-e</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Cliente */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-[#214739] space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#11d493]" />
                <span>Novo Cliente Bling</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white cursor-pointer"
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
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 cursor-pointer"
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
