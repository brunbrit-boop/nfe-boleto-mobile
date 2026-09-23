import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Sparkles,
  Trash2,
  Play,
  CheckCircle2,
  RefreshCw,
  Search,
  X,
  FileText,
  Eye,
  CreditCard,
  AlertCircle,
  Minus,
  Package,
  Layers,
  Target,
} from 'lucide-react';
import type {
  EmpresaTenant,
  BlingCliente,
  CompanyProfile,
  BankProvider,
  GrupoClientes,
  GrupoClienteItem,
  GrupoProdutos,
  NFeData,
  Installment,
} from '../../../types';
import type { CatalogoProduto, OfertaGeradaResult } from '../../../utils/salesOptimizer';
import { formatCurrency } from '../../../utils/financeEngine';
import {
  obterGruposCacheLocal,
  salvarGruposCacheLocal,
  criarNovoGrupo,
  obterGruposProdutosCacheLocal,
  salvarGruposProdutosCacheLocal,
  criarNovoGrupoProdutos,
  gerarOfertaParaItem,
  emitirNFeItemGrupo,
  distribuirMetaEscalonada,
} from '../../../services/gruposService';

interface GruposClientesViewProps {
  empresa: EmpresaTenant;
  company: CompanyProfile;
  bancoAtual: BankProvider;
  clientes: BlingCliente[];
  catalogoProdutos: CatalogoProduto[];
  onViewDanfe?: (nfe: NFeData) => void;
  onViewBoleto?: (parcela: Installment, nfe: NFeData) => void;
  onEmitirNFe?: (nfe: NFeData) => void;
}

export const GruposClientesView: React.FC<GruposClientesViewProps> = ({
  empresa,
  company,
  bancoAtual,
  clientes,
  catalogoProdutos,
  onViewDanfe,
  onViewBoleto,
  onEmitirNFe,
}) => {
  // Lista de grupos salvos no cache local para esta empresa
  const [grupos, setGrupos] = useState<GrupoClientes[]>(() => {
    const salvos = obterGruposCacheLocal(empresa.id);
    if (salvos.length > 0) return salvos;

    // Se não tiver nenhum, cria um inicial de exemplo com os primeiros clientes da base
    const primeirosClientes = clientes.slice(0, 6);
    const inicial = criarNovoGrupo(empresa.id, 'Grupo Principal de Vendas', primeirosClientes, 5000, '');
    salvarGruposCacheLocal(empresa.id, [inicial]);
    return [inicial];
  });

  const [grupoAtivoId, setGrupoAtivoId] = useState<string>(() => grupos[0]?.id || '');
  const grupoAtivo = grupos.find((g) => g.id === grupoAtivoId) || grupos[0];

  // Controles em Massa
  const [valorMassa, setValorMassa] = useState<number>(grupoAtivo?.valorPadrao || 5000);
  const [filtroMassa, setFiltroMassa] = useState<string>(grupoAtivo?.filtroPadrao || '');
  const [metaTotalGrupo, setMetaTotalGrupo] = useState<number>(() => {
    if (grupoAtivo && grupoAtivo.clientes.length > 0) {
      const soma = grupoAtivo.clientes.reduce((acc, c) => acc + (c.valorAlvo || 5000), 0);
      return soma > 0 ? soma : 15000;
    }
    return 15000;
  });
  const [feedbackMetaDistribuida, setFeedbackMetaDistribuida] = useState<string | null>(null);
  const [isGerandoLote, setIsGerandoLote] = useState<boolean>(false);
  const [progressoLote, setProgressoLote] = useState<{ atual: number; total: number }>({ atual: 0, total: 0 });

  // Modais
  const [isNovoGrupoModalOpen, setIsNovoGrupoModalOpen] = useState(false);
  const [nomeNovoGrupo, setNomeNovoGrupo] = useState('');
  const [isAddClientesModalOpen, setIsAddClientesModalOpen] = useState(false);
  const [buscaClienteModal, setBuscaClienteModal] = useState('');
  const [clientesSelecionadosModal, setClientesSelecionadosModal] = useState<number[]>([]);
  const [itemVisualizandoOferta, setItemVisualizandoOferta] = useState<GrupoClienteItem | null>(null);
  const [itemEmitindoNFeId, setItemEmitindoNFeId] = useState<number | null>(null);

  // Sub-aba ativa: Grupos de Clientes vs Grupos de Produtos
  const [subAbaAtiva, setSubAbaAtiva] = useState<'clientes' | 'produtos'>('clientes');

  // Lista de grupos de produtos salvos no cache local
  const [gruposProdutos, setGruposProdutos] = useState<GrupoProdutos[]>(() => {
    return obterGruposProdutosCacheLocal(empresa.id);
  });
  const [grupoProdutoSelecionadoId, setGrupoProdutoSelecionadoId] = useState<string>(() => gruposProdutos[0]?.id || '');

  // Modais de Grupos de Produtos
  const [isNovoGrupoProdutoModalOpen, setIsNovoGrupoProdutoModalOpen] = useState(false);
  const [nomeNovoGrupoProduto, setNomeNovoGrupoProduto] = useState('');
  const [descNovoGrupoProduto, setDescNovoGrupoProduto] = useState('');
  const [isAddProdutosModalOpen, setIsAddProdutosModalOpen] = useState(false);
  const [buscaProdutoModal, setBuscaProdutoModal] = useState('');
  const [produtosSelecionadosModal, setProdutosSelecionadosModal] = useState<string[]>([]);

  // Atualiza cache de grupos de produtos
  const atualizarGruposProdutos = (novos: GrupoProdutos[]) => {
    setGruposProdutos(novos);
    salvarGruposProdutosCacheLocal(empresa.id, novos);
  };

  // Sincroniza estado de clientes com localStorage
  const atualizarGrupo = (grupoAtualizado: GrupoClientes) => {
    const atualizados = grupos.map((g) => (g.id === grupoAtualizado.id ? grupoAtualizado : g));
    setGrupos(atualizados);
    salvarGruposCacheLocal(empresa.id, atualizados);
  };

  // Ao trocar de empresa, recarrega grupos de clientes e grupos de produtos
  useEffect(() => {
    const salvos = obterGruposCacheLocal(empresa.id);
    if (salvos.length > 0) {
      setGrupos(salvos);
      setGrupoAtivoId(salvos[0].id);
    } else {
      const inicial = criarNovoGrupo(empresa.id, 'Grupo Principal', clientes.slice(0, 5), 5000, '');
      setGrupos([inicial]);
      setGrupoAtivoId(inicial.id);
      salvarGruposCacheLocal(empresa.id, [inicial]);
    }

    const prods = obterGruposProdutosCacheLocal(empresa.id);
    setGruposProdutos(prods);
    if (prods.length > 0) {
      setGrupoProdutoSelecionadoId(prods[0].id);
    }
  }, [empresa.id]);

  // Atualiza controles em massa quando o grupo ativo muda
  useEffect(() => {
    if (grupoAtivo) {
      setValorMassa(grupoAtivo.valorPadrao || 5000);
      setFiltroMassa(grupoAtivo.filtroPadrao || '');
      const soma = grupoAtivo.clientes.reduce((acc, c) => acc + (c.valorAlvo || 5000), 0);
      if (soma > 0) {
        setMetaTotalGrupo(soma);
      }
    }
  }, [grupoAtivoId]);

  // Distribuição de Meta Total Escalonada (Critério 1: Mix Comercial)
  const handleDistribuirMetaEscalonada = () => {
    if (!grupoAtivo || grupoAtivo.clientes.length === 0) return;
    const meta = Number(metaTotalGrupo);
    if (meta <= 0) return;

    const valoresDistribuidos = distribuirMetaEscalonada(meta, grupoAtivo.clientes.length);

    const atualizado: GrupoClientes = {
      ...grupoAtivo,
      clientes: grupoAtivo.clientes.map((c, idx) => ({
        ...c,
        valorAlvo: valoresDistribuidos[idx] || c.valorAlvo,
        ofertaGerada: undefined, // reinicia a oferta para ser recalculada de acordo com o novo alvo
      })),
    };

    atualizarGrupo(atualizado);

    const resumo = valoresDistribuidos.map((v) => formatCurrency(v)).join(' / ');
    setFeedbackMetaDistribuida(
      `Meta de ${formatCurrency(meta)} distribuída com sucesso entre os ${grupoAtivo.clientes.length} clientes (${resumo}). Clique em "⚡ Gerar Orçamentos com IA (Todos)" para compor os produtos!`
    );
    setTimeout(() => setFeedbackMetaDistribuida(null), 9000);
  };

  // Ações em Massa
  const handleAplicarValorParaTodos = () => {
    if (!grupoAtivo) return;
    const valor = Number(valorMassa) || 1000;
    const atualizado: GrupoClientes = {
      ...grupoAtivo,
      valorPadrao: valor,
      clientes: grupoAtivo.clientes.map((c) => ({ ...c, valorAlvo: valor })),
    };
    atualizarGrupo(atualizado);
  };

  const handleAplicarFiltroParaTodos = () => {
    if (!grupoAtivo) return;
    const filtro = filtroMassa.trim();
    const atualizado: GrupoClientes = {
      ...grupoAtivo,
      filtroPadrao: filtro,
      clientes: grupoAtivo.clientes.map((c) => ({ ...c, filtroFoco: filtro })),
    };
    atualizarGrupo(atualizado);
  };

  // Alterar valor ou foco individualmente na linha
  const handleUpdateItemValor = (clienteId: number, novoValor: number) => {
    if (!grupoAtivo) return;
    const atualizado: GrupoClientes = {
      ...grupoAtivo,
      clientes: grupoAtivo.clientes.map((c) =>
        c.clienteId === clienteId ? { ...c, valorAlvo: novoValor } : c
      ),
    };
    atualizarGrupo(atualizado);
  };

  const handleUpdateItemFoco = (clienteId: number, novoFoco: string) => {
    if (!grupoAtivo) return;
    const atualizado: GrupoClientes = {
      ...grupoAtivo,
      clientes: grupoAtivo.clientes.map((c) =>
        c.clienteId === clienteId ? { ...c, filtroFoco: novoFoco } : c
      ),
    };
    atualizarGrupo(atualizado);
  };

  const handleRemoverCliente = (clienteId: number) => {
    if (!grupoAtivo) return;
    const atualizado: GrupoClientes = {
      ...grupoAtivo,
      clientes: grupoAtivo.clientes.filter((c) => c.clienteId !== clienteId),
    };
    atualizarGrupo(atualizado);
  };

  // Executa IA para um item individual
  const handleGerarItemIndividual = async (clienteId: number) => {
    if (!grupoAtivo) return;
    const item = grupoAtivo.clientes.find((c) => c.clienteId === clienteId);
    if (!item) return;

    // Marca como gerando
    let atualizado: GrupoClientes = {
      ...grupoAtivo,
      clientes: grupoAtivo.clientes.map((c) =>
        c.clienteId === clienteId ? { ...c, status: 'gerando' } : c
      ),
    };
    atualizarGrupo(atualizado);

    try {
      const oferta = await gerarOfertaParaItem(item, catalogoProdutos, 0.05, gruposProdutos);
      atualizado = {
        ...grupoAtivo,
        clientes: grupoAtivo.clientes.map((c) =>
          c.clienteId === clienteId ? { ...c, status: 'gerado', ofertaGerada: oferta, erro: undefined } : c
        ),
      };
    } catch (err: any) {
      atualizado = {
        ...grupoAtivo,
        clientes: grupoAtivo.clientes.map((c) =>
          c.clienteId === clienteId ? { ...c, status: 'erro', erro: err.message || 'Falha ao gerar.' } : c
        ),
      };
    }
    atualizarGrupo(atualizado);
  };

  // Executa Geração em Lote de Todo o Grupo com IA
  const handleGerarTodosLote = async () => {
    if (!grupoAtivo || grupoAtivo.clientes.length === 0 || isGerandoLote) return;

    setIsGerandoLote(true);
    setProgressoLote({ atual: 0, total: grupoAtivo.clientes.length });

    try {
      let grupoEmProcessamento = { ...grupoAtivo };
      for (let i = 0; i < grupoAtivo.clientes.length; i++) {
        const item = grupoAtivo.clientes[i];
        setProgressoLote({ atual: i + 1, total: grupoAtivo.clientes.length });

        // Atualiza status para gerando
        grupoEmProcessamento = {
          ...grupoEmProcessamento,
          clientes: grupoEmProcessamento.clientes.map((c) =>
            c.clienteId === item.clienteId ? { ...c, status: 'gerando' } : c
          ),
        };
        atualizarGrupo(grupoEmProcessamento);

        try {
          const oferta = await gerarOfertaParaItem(item, catalogoProdutos, 0.05, gruposProdutos);
          grupoEmProcessamento = {
            ...grupoEmProcessamento,
            clientes: grupoEmProcessamento.clientes.map((c) =>
              c.clienteId === item.clienteId
                ? { ...c, status: 'gerado', ofertaGerada: oferta, erro: undefined }
                : c
            ),
          };
        } catch (err: any) {
          grupoEmProcessamento = {
            ...grupoEmProcessamento,
            clientes: grupoEmProcessamento.clientes.map((c) =>
              c.clienteId === item.clienteId
                ? { ...c, status: 'erro', erro: err.message || 'Falha na IA' }
                : c
            ),
          };
        }
        atualizarGrupo(grupoEmProcessamento);
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      setIsGerandoLote(false);
    }
  };

  // Emite NF-e e Boleto direto de uma linha gerada de forma 100% dinâmica (sem popups e sem abrir DANFE forçado)
  const handleEmitirLinha = async (item: GrupoClienteItem) => {
    if (!item.ofertaGerada) return;
    setItemEmitindoNFeId(item.clienteId);

    try {
      const res = await emitirNFeItemGrupo(item, empresa, company, bancoAtual);
      if (res.sucesso && res.nfe) {
        // Atualiza o item com a NF-e emitida e remove eventuais erros anteriores
        if (grupoAtivo) {
          const atualizado: GrupoClientes = {
            ...grupoAtivo,
            clientes: grupoAtivo.clientes.map((c) =>
              c.clienteId === item.clienteId ? { ...c, nfeEmitida: res.nfe, erro: undefined } : c
            ),
          };
          atualizarGrupo(atualizado);
        }

        if (onEmitirNFe) {
          onEmitirNFe(res.nfe);
        }
      } else {
        // Registra o erro na própria linha para feedback dinâmico imediato
        if (grupoAtivo) {
          const atualizado: GrupoClientes = {
            ...grupoAtivo,
            clientes: grupoAtivo.clientes.map((c) =>
              c.clienteId === item.clienteId ? { ...c, erro: res.erro || 'Falha ao registrar rascunho no Bling.' } : c
            ),
          };
          atualizarGrupo(atualizado);
        }
      }
    } catch (err: any) {
      if (grupoAtivo) {
        const atualizado: GrupoClientes = {
          ...grupoAtivo,
          clientes: grupoAtivo.clientes.map((c) =>
            c.clienteId === item.clienteId ? { ...c, erro: err.message || 'Erro durante a emissão.' } : c
          ),
        };
        atualizarGrupo(atualizado);
      }
    } finally {
      setItemEmitindoNFeId(null);
    }
  };

  // Modifica a quantidade de um produto específico na proposta visualizada com recálculo em tempo real
  const handleAlterarQuantidadeItemOferta = (itemIndex: number, delta: number) => {
    if (!itemVisualizandoOferta || !itemVisualizandoOferta.ofertaGerada) return;

    const itensAtuais = [...itemVisualizandoOferta.ofertaGerada.itens];
    const target = itensAtuais[itemIndex];
    if (!target) return;

    const novaQtd = Math.max(1, (target.quantidade || 1) + delta);
    const novoValorTotalItem = Number((novaQtd * target.valorUnitario).toFixed(2));

    itensAtuais[itemIndex] = {
      ...target,
      quantidade: novaQtd,
      valorTotal: novoValorTotalItem,
    };

    const novoTotalGeral = Number(itensAtuais.reduce((acc: number, it: any) => acc + (it.valorTotal || 0), 0).toFixed(2));

    const novaOferta: OfertaGeradaResult = {
      ...itemVisualizandoOferta.ofertaGerada,
      itens: itensAtuais,
      valorTotal: novoTotalGeral,
    };

    const itemAtualizado: GrupoClienteItem = {
      ...itemVisualizandoOferta,
      ofertaGerada: novaOferta,
    };

    setItemVisualizandoOferta(itemAtualizado);

    if (grupoAtivo) {
      const atualizado: GrupoClientes = {
        ...grupoAtivo,
        clientes: grupoAtivo.clientes.map((c) =>
          c.clienteId === itemVisualizandoOferta.clienteId ? itemAtualizado : c
        ),
      };
      atualizarGrupo(atualizado);
    }
  };

  // Remove um produto da proposta visualizada com recálculo em tempo real
  const handleRemoverItemOferta = (itemIndex: number) => {
    if (!itemVisualizandoOferta || !itemVisualizandoOferta.ofertaGerada) return;

    const itensAtuais = itemVisualizandoOferta.ofertaGerada.itens.filter((_: any, idx: number) => idx !== itemIndex);
    if (itensAtuais.length === 0) return; // Mantém pelo menos 1 item na proposta

    const novoTotalGeral = Number(itensAtuais.reduce((acc: number, it: any) => acc + (it.valorTotal || 0), 0).toFixed(2));

    const novaOferta: OfertaGeradaResult = {
      ...itemVisualizandoOferta.ofertaGerada,
      itens: itensAtuais,
      valorTotal: novoTotalGeral,
    };

    const itemAtualizado: GrupoClienteItem = {
      ...itemVisualizandoOferta,
      ofertaGerada: novaOferta,
    };

    setItemVisualizandoOferta(itemAtualizado);

    if (grupoAtivo) {
      const atualizado: GrupoClientes = {
        ...grupoAtivo,
        clientes: grupoAtivo.clientes.map((c) =>
          c.clienteId === itemVisualizandoOferta.clienteId ? itemAtualizado : c
        ),
      };
      atualizarGrupo(atualizado);
    }
  };

  // Criação de Novo Grupo
  const handleCriarGrupo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovoGrupo.trim()) return;

    const novo = criarNovoGrupo(empresa.id, nomeNovoGrupo, [], 5000, '');
    const atualizados = [...grupos, novo];
    setGrupos(atualizados);
    setGrupoAtivoId(novo.id);
    salvarGruposCacheLocal(empresa.id, atualizados);

    setNomeNovoGrupo('');
    setIsNovoGrupoModalOpen(false);
    setIsAddClientesModalOpen(true); // Abre direto para selecionar clientes
  };

  // Confirmação de Adição de Clientes da Modal
  const handleConfirmarAddClientes = () => {
    if (!grupoAtivo) return;

    const selecionadosObj = clientes.filter((c) => clientesSelecionadosModal.includes(c.id));
    const existentesIds = new Set(grupoAtivo.clientes.map((c) => c.clienteId));

    const novosItens: GrupoClienteItem[] = selecionadosObj
      .filter((c) => !existentesIds.has(c.id))
      .map((c) => ({
        clienteId: c.id,
        nome: c.nome,
        fantasia: c.fantasia,
        numeroDocumento: c.numeroDocumento,
        cidade: c.endereco?.geral?.municipio,
        uf: c.endereco?.geral?.uf,
        telefone: c.telefone || c.celular,
        email: c.email,
        valorAlvo: grupoAtivo.valorPadrao || 5000,
        filtroFoco: grupoAtivo.filtroPadrao || undefined,
        status: 'pendente',
      }));

    const atualizado: GrupoClientes = {
      ...grupoAtivo,
      clientes: [...grupoAtivo.clientes, ...novosItens],
    };

    atualizarGrupo(atualizado);
    setIsAddClientesModalOpen(false);
    setClientesSelecionadosModal([]);
  };

  // Excluir Grupo de Clientes
  const handleExcluirGrupo = () => {
    if (!grupoAtivo || grupos.length <= 1) {
      alert('Você deve manter pelo menos um grupo ativo.');
      return;
    }
    if (confirm(`Deseja realmente excluir o grupo "${grupoAtivo.nome}"?`)) {
      const restantes = grupos.filter((g) => g.id !== grupoAtivo.id);
      setGrupos(restantes);
      setGrupoAtivoId(restantes[0].id);
      salvarGruposCacheLocal(empresa.id, restantes);
    }
  };

  // Funções de Gestão de Grupos de Produtos
  const grupoProdutoSelecionado = gruposProdutos.find((g) => g.id === grupoProdutoSelecionadoId) || gruposProdutos[0];

  const handleCriarGrupoProdutos = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovoGrupoProduto.trim()) return;

    const novo = criarNovoGrupoProdutos(empresa.id, nomeNovoGrupoProduto, [], descNovoGrupoProduto);
    const atualizados = [...gruposProdutos, novo];
    atualizarGruposProdutos(atualizados);
    setGrupoProdutoSelecionadoId(novo.id);

    setNomeNovoGrupoProduto('');
    setDescNovoGrupoProduto('');
    setIsNovoGrupoProdutoModalOpen(false);
  };

  const handleExcluirGrupoProdutos = (id: string) => {
    if (gruposProdutos.length <= 1) {
      alert('Você deve manter pelo menos um grupo de produtos cadastrado.');
      return;
    }
    const gp = gruposProdutos.find((g) => g.id === id);
    if (confirm(`Deseja realmente excluir o grupo de produtos "${gp?.nome}"?`)) {
      const restantes = gruposProdutos.filter((g) => g.id !== id);
      atualizarGruposProdutos(restantes);
      setGrupoProdutoSelecionadoId(restantes[0]?.id || '');
    }
  };

  const handleRemoverProdutoDoGrupo = (grupoId: string, codigoProd: string) => {
    const atualizados = gruposProdutos.map((g) => {
      if (g.id === grupoId) {
        return {
          ...g,
          produtosCodigos: g.produtosCodigos.filter((c) => c !== codigoProd),
          atualizadoEm: new Date().toISOString(),
        };
      }
      return g;
    });
    atualizarGruposProdutos(atualizados);
  };

  const handleConfirmarAddProdutosAoGrupo = () => {
    if (!grupoProdutoSelecionadoId) return;
    const atualizados = gruposProdutos.map((g) => {
      if (g.id === grupoProdutoSelecionadoId) {
        const novosCodigos = Array.from(new Set([...g.produtosCodigos, ...produtosSelecionadosModal]));
        return {
          ...g,
          produtosCodigos: novosCodigos,
          atualizadoEm: new Date().toISOString(),
        };
      }
      return g;
    });
    atualizarGruposProdutos(atualizados);
    setIsAddProdutosModalOpen(false);
    setProdutosSelecionadosModal([]);
  };

  const handleAplicarGrupoProdutoParaTodos = (gpId: string) => {
    if (!grupoAtivo) return;
    const gp = gruposProdutos.find((g) => g.id === gpId);
    const atualizado: GrupoClientes = {
      ...grupoAtivo,
      grupoProdutoPadraoId: gpId || undefined,
      filtroPadrao: gp ? gp.nome : grupoAtivo.filtroPadrao,
      clientes: grupoAtivo.clientes.map((c) => ({
        ...c,
        grupoProdutoId: gpId || undefined,
        filtroFoco: gp ? gp.nome : c.filtroFoco,
      })),
    };
    atualizarGrupo(atualizado);
  };

  const clientesFiltradosModal = clientes.filter((c) => {
    const t = buscaClienteModal.toLowerCase();
    return (
      c.nome.toLowerCase().includes(t) ||
      (c.fantasia && c.fantasia.toLowerCase().includes(t)) ||
      c.numeroDocumento.includes(t)
    );
  });

  const produtosFiltradosModal = useMemo(() => {
    const t = buscaProdutoModal.toLowerCase().trim();
    if (!t) return catalogoProdutos;
    return catalogoProdutos.filter(
      (p: any) =>
        p.descricao.toLowerCase().includes(t) ||
        (p.codigo && p.codigo.toLowerCase().includes(t)) ||
        (p.categoria && p.categoria.toLowerCase().includes(t))
    );
  }, [catalogoProdutos, buscaProdutoModal]);

  // Lista de códigos atualmente visíveis no filtro da modal
  const codigosVisiveisModal = useMemo(
    () => produtosFiltradosModal.map((p: any) => String(p.codigo || p.id)),
    [produtosFiltradosModal]
  );

  // Verifica se todos os produtos atualmente visíveis estão selecionados
  const todosVisiveisSelecionados = useMemo(
    () =>
      codigosVisiveisModal.length > 0 &&
      codigosVisiveisModal.every((c: string) => produtosSelecionadosModal.includes(c)),
    [codigosVisiveisModal, produtosSelecionadosModal]
  );

  // Verifica se apenas parte dos produtos visíveis está selecionada
  const algunsVisiveisSelecionados = useMemo(
    () =>
      codigosVisiveisModal.some((c: string) => produtosSelecionadosModal.includes(c)) &&
      !todosVisiveisSelecionados,
    [codigosVisiveisModal, produtosSelecionadosModal, todosVisiveisSelecionados]
  );

  // Alterna a seleção de todos os produtos visíveis na busca atual (estilo Google Planilhas)
  const handleToggleSelecionarTodosVisiveis = () => {
    if (todosVisiveisSelecionados) {
      // Desmarca apenas os produtos que estão visíveis na busca atual
      setProdutosSelecionadosModal((prev) => prev.filter((c) => !codigosVisiveisModal.includes(c)));
    } else {
      // Adiciona todos os visíveis mantendo os já selecionados em buscas anteriores
      setProdutosSelecionadosModal((prev) => Array.from(new Set([...prev, ...codigosVisiveisModal])));
    }
  };

  const produtosDoGrupo = React.useMemo(() => {
    if (!grupoProdutoSelecionado || !grupoProdutoSelecionado.produtosCodigos) return [];
    const codigosSet = new Set(grupoProdutoSelecionado.produtosCodigos.map((c: string) => c.toLowerCase().trim()));
    return catalogoProdutos.filter(
      (p) => codigosSet.has((p.codigo || '').toLowerCase().trim()) || codigosSet.has((p.id || '').toLowerCase().trim())
    );
  }, [grupoProdutoSelecionado, catalogoProdutos]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Navegação entre Grupos de Clientes e Grupos de Produtos */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] shadow-sm w-fit">
        <button
          type="button"
          onClick={() => setSubAbaAtiva('clientes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            subAbaAtiva === 'clientes'
              ? 'bg-[#11d493] text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Grupos de Clientes & Vendas IA</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
            subAbaAtiva === 'clientes' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-100 dark:bg-[#162f27] text-slate-400'
          }`}>
            {grupos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubAbaAtiva('produtos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            subAbaAtiva === 'produtos'
              ? 'bg-[#11d493] text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Grupos de Produtos (Kits & Combos)</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
            subAbaAtiva === 'produtos' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-100 dark:bg-[#162f27] text-slate-400'
          }`}>
            {gruposProdutos.length}
          </span>
        </button>
      </div>

      {subAbaAtiva === 'produtos' ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Topo: Seletor de Grupo de Produtos + Ações */}
          <div className="bg-white dark:bg-[#10221c] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#1a382e] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
                <Package className="w-5 h-5 stroke-[2.2]" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Grupo de Produtos / Kit
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {grupoProdutoSelecionado?.produtosCodigos?.length || 0} produtos cadastrados
                  </span>
                </div>

                <div className="relative mt-1">
                  <select
                    value={grupoProdutoSelecionadoId}
                    onChange={(e) => setGrupoProdutoSelecionadoId(e.target.value)}
                    className="font-black text-base sm:text-lg text-slate-900 dark:text-white bg-transparent pr-8 cursor-pointer focus:outline-none hover:text-amber-500 transition-colors"
                  >
                    {gruposProdutos.map((gp) => (
                      <option key={gp.id} value={gp.id} className="bg-white dark:bg-[#10221c] text-slate-900 dark:text-white font-semibold">
                        {gp.nome} ({gp.produtosCodigos.length} itens)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsNovoGrupoProdutoModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#11d493] text-slate-950 hover:bg-[#0eb880] transition active:scale-95 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Kit / Grupo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProdutosSelecionadosModal(grupoProdutoSelecionado?.produtosCodigos || []);
                  setIsAddProdutosModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/25 transition active:scale-95 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Adicionar Produtos</span>
              </button>

              {gruposProdutos.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleExcluirGrupoProdutos(grupoProdutoSelecionado.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition active:scale-95 cursor-pointer"
                  title="Excluir este grupo de produtos"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Produtos Inclusos no Grupo */}
          <div className="bg-white dark:bg-[#10221c] rounded-2xl border border-slate-200 dark:border-[#1a382e] shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/70 dark:bg-[#162f27]/40 border-b border-slate-200 dark:border-[#1a382e] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>Produtos do Grupo "{grupoProdutoSelecionado?.nome}"</span>
                </h4>
                {grupoProdutoSelecionado?.descricao && (
                  <p className="text-xs text-slate-400 mt-0.5">{grupoProdutoSelecionado.descricao}</p>
                )}
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                Ao selecionar este kit para um cliente, a IA irá gerar orçamentos compostos estritamente por estes itens.
              </span>
            </div>

            {produtosDoGrupo.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
                  <Package className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-base text-slate-800 dark:text-white">Nenhum produto neste grupo</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Adicione produtos do catálogo cadastrado na sua empresa para formar este kit ou combo.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setProdutosSelecionadosModal([]);
                    setIsAddProdutosModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#11d493] text-slate-950 hover:bg-[#0eb880] transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Produtos Agora</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#1a382e] bg-slate-50/70 dark:bg-[#162f27]/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Descrição do Produto</th>
                      <th className="py-3 px-3">Categoria</th>
                      <th className="py-3 px-3">Unidade</th>
                      <th className="py-3 px-4 text-right">Valor Unitário</th>
                      <th className="py-3 px-4 text-center w-16">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#1a382e]/80">
                    {produtosDoGrupo.map((prod) => (
                      <tr key={prod.id || prod.codigo} className="hover:bg-slate-50/50 dark:hover:bg-[#162f27]/20 transition">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-600 dark:text-slate-300">
                          {prod.codigo || prod.id}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                          {prod.descricao}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#162f27] text-[10px] font-bold">
                            {prod.categoria || 'Geral'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">
                          {prod.unidade || 'UN'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(prod.precoUnitario)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoverProdutoDoGrupo(grupoProdutoSelecionado.id, prod.codigo || prod.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Remover deste grupo de produtos"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Topo: Seletor de Grupo + Ações de Gestão */}
          <div className="bg-white dark:bg-[#10221c] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#1a382e] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Esquerda: Seletor de Grupo */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20 shrink-0">
                <Users className="w-5 h-5 stroke-[2.2]" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Grupo de Clientes
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#11d493] border border-emerald-500/20">
                    {grupoAtivo?.clientes.length || 0} clientes
                  </span>
                </div>

                <div className="relative mt-1">
                  <select
                    value={grupoAtivoId}
                    onChange={(e) => setGrupoAtivoId(e.target.value)}
                    className="font-black text-base sm:text-lg text-slate-900 dark:text-white bg-transparent pr-8 cursor-pointer focus:outline-none hover:text-[#11d493] transition-colors"
                  >
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id} className="bg-white dark:bg-[#10221c] text-slate-900 dark:text-white font-semibold">
                        {g.nome} ({g.clientes.length} clientes)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Direita: Botões de Ação do Grupo */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsNovoGrupoModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#162f27] hover:bg-slate-200 dark:hover:bg-[#1f4237] text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#11d493]" />
                <span>Novo Grupo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setClientesSelecionadosModal(grupoAtivo?.clientes.map((c) => c.clienteId) || []);
                  setIsAddClientesModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-[#11d493] border border-emerald-500/25 transition active:scale-95 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Adicionar Clientes</span>
              </button>

              {grupos.length > 1 && (
                <button
                  type="button"
                  onClick={handleExcluirGrupo}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition active:scale-95 cursor-pointer"
                  title="Excluir este grupo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

      {/* Barra de Controles Mestres (Ações em Massa) */}
      <div className="bg-gradient-to-r from-slate-900 to-[#10221c] text-white p-4 sm:p-5 rounded-2xl border border-slate-800 dark:border-[#1a382e] shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-black flex items-center gap-2 text-white">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Mesa de Operações de Vendas em Massa</span>
            </h3>
            <p className="text-xs text-slate-400">
              Personalize o valor e o foco de cada cliente ou aplique um padrão para todo o grupo com 1 clique.
            </p>
          </div>

          {/* Botão Mestre de Geração em Lote */}
          <button
            type="button"
            onClick={handleGerarTodosLote}
            disabled={isGerandoLote || !grupoAtivo || grupoAtivo.clientes.length === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-[#11d493] to-emerald-500 hover:from-[#0eb880] hover:to-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20 transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isGerandoLote ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Gerando ({progressoLote.atual}/{progressoLote.total})...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                <span>⚡ Gerar Orçamentos com IA (Todos)</span>
              </>
            )}
          </button>
        </div>

        {/* Bloco Destaque: Distribuição de Meta Total do Grupo (Critério 1 - Mix Comercial Escalonado) */}
        <div className="bg-slate-800/90 p-3.5 sm:p-4 rounded-xl border border-amber-500/30 shadow-inner flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs sm:text-sm font-black text-white">Meta de Faturamento Total do Grupo</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Critério 1: Mix Escalonado
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                A IA espalha esse valor entre os orçamentos (pedidos âncora, médios e menores) somando exatamente a meta.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <div className="relative flex-1 md:w-44">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">R$</span>
              <input
                type="number"
                value={metaTotalGrupo}
                onChange={(e) => setMetaTotalGrupo(Number(e.target.value))}
                className="w-full bg-slate-900 text-white font-mono font-black text-xs pl-8 pr-2 py-2 rounded-xl border border-amber-500/40 focus:outline-none focus:border-amber-400 shadow-sm"
                placeholder="15000"
              />
            </div>
            <button
              type="button"
              onClick={handleDistribuirMetaEscalonada}
              disabled={!grupoAtivo || grupoAtivo.clientes.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 transition active:scale-95 disabled:opacity-50 shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Calcular e distribuir valores escalonados para cada cliente do grupo"
            >
              <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
              <span>Distribuir Meta com IA</span>
            </button>
          </div>
        </div>

        {/* Notificação de Meta Distribuída */}
        {feedbackMetaDistribuida && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{feedbackMetaDistribuida}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMetaDistribuida(null)}
              className="text-xs text-amber-400 hover:text-white cursor-pointer px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Linha de Definição Rápida em Massa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3 border-t border-slate-800">
          {/* Valor Padrão para Todos */}
          <div className="lg:col-span-4 flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
            <span className="text-xs font-bold text-slate-400 shrink-0 pl-1">Valor Padrão:</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
              <input
                type="number"
                value={valorMassa}
                onChange={(e) => setValorMassa(Number(e.target.value))}
                className="w-full bg-slate-900/90 text-white font-mono font-bold text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-[#11d493]"
                placeholder="5000"
              />
            </div>
            <button
              type="button"
              onClick={handleAplicarValorParaTodos}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#11d493]/20 hover:bg-[#11d493]/30 text-[#11d493] border border-[#11d493]/40 transition shrink-0 cursor-pointer"
            >
              Aplicar
            </button>
          </div>

          {/* Filtro Rápido de Categoria para Todos */}
          <div className="lg:col-span-4 flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
            <span className="text-xs font-bold text-slate-400 shrink-0 pl-1">Foco Livre:</span>
            <input
              type="text"
              value={filtroMassa}
              onChange={(e) => setFiltroMassa(e.target.value)}
              className="flex-1 bg-slate-900/90 text-white text-xs px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-[#11d493]"
              placeholder="Ex: Elétrica, Hidráulica"
            />
            <button
              type="button"
              onClick={handleAplicarFiltroParaTodos}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white transition shrink-0 cursor-pointer"
            >
              Aplicar
            </button>
          </div>

          {/* Vincular Grupo de Produtos (Kit) para Todos */}
          <div className="lg:col-span-4 flex items-center gap-2 bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
            <span className="text-xs font-bold text-amber-400 shrink-0 pl-1 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              <span>Kit/Grupo:</span>
            </span>
            <select
              value={grupoAtivo?.grupoProdutoPadraoId || ''}
              onChange={(e) => handleAplicarGrupoProdutoParaTodos(e.target.value)}
              className="flex-1 bg-slate-900/90 text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="">🌐 Livre (Sem Grupo)</option>
              {gruposProdutos.map((gp) => (
                <option key={gp.id} value={gp.id}>
                  📦 {gp.nome} ({gp.produtosCodigos.length} itens)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela Interativa de Produção */}
      <div className="bg-white dark:bg-[#10221c] rounded-2xl border border-slate-200 dark:border-[#1a382e] shadow-sm overflow-hidden">
        {grupoAtivo?.clientes.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#162f27] text-slate-400 mx-auto flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-base text-slate-800 dark:text-white">Nenhum cliente neste grupo</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Adicione clientes cadastrados na sua conta do Bling para começar a gerar propostas em massa.
            </p>
            <button
              type="button"
              onClick={() => setIsAddClientesModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#11d493] text-slate-950 shadow hover:bg-[#0eb880] transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Clientes Agora</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1a382e] bg-slate-50/70 dark:bg-[#162f27]/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-3 w-40">Valor Alvo (R$)</th>
                  <th className="py-3.5 px-3 w-56">Foco / Linha de Produtos</th>
                  <th className="py-3.5 px-4 min-w-[200px]">Status IA</th>
                  <th className="py-3.5 px-4 text-right w-44">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1a382e]/80 text-xs">
                {grupoAtivo?.clientes.map((item) => {
                  const isGerando = item.status === 'gerando';
                  const isGerado = item.status === 'gerado';
                  const isErro = item.status === 'erro';

                  return (
                    <tr
                      key={item.clienteId}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#162f27]/20 transition-colors group"
                    >
                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-[#11d493] font-bold text-xs flex items-center justify-center shrink-0">
                            {item.nome.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                              {item.nome}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                              {item.numeroDocumento} {item.cidade ? `• ${item.cidade}/${item.uf || 'SP'}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Valor Alvo (Editável) */}
                      <td className="py-3 px-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">R$</span>
                          <input
                            type="number"
                            value={item.valorAlvo}
                            onChange={(e) => handleUpdateItemValor(item.clienteId, Number(e.target.value))}
                            className="w-full bg-slate-50 dark:bg-[#162f27]/60 border border-slate-200 dark:border-[#214739] rounded-lg py-1.5 pl-7 pr-2 font-mono font-bold text-xs text-slate-800 dark:text-white focus:outline-none focus:border-[#11d493]"
                          />
                        </div>
                      </td>

                      {/* Foco / Linha de Produtos (Grupo de Produtos ou Foco Livre) */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          <select
                            value={item.grupoProdutoId || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const gp = gruposProdutos.find((g) => g.id === val);
                              const atualizado: GrupoClientes = {
                                ...grupoAtivo,
                                clientes: grupoAtivo.clientes.map((c) =>
                                  c.clienteId === item.clienteId
                                    ? {
                                        ...c,
                                        grupoProdutoId: val || undefined,
                                        filtroFoco: gp ? gp.nome : c.filtroFoco,
                                      }
                                    : c
                                ),
                              };
                              atualizarGrupo(atualizado);
                            }}
                            className="w-full bg-slate-50 dark:bg-[#162f27]/60 border border-slate-200 dark:border-[#214739] rounded-lg py-1 px-2 text-[11px] font-bold text-slate-800 dark:text-white focus:outline-none focus:border-[#11d493]"
                          >
                            <option value="">🌐 Catálogo Livre</option>
                            {gruposProdutos.map((gp) => (
                              <option key={gp.id} value={gp.id}>
                                📦 {gp.nome} ({gp.produtosCodigos.length} itens)
                              </option>
                            ))}
                          </select>

                          {!item.grupoProdutoId && (
                            <input
                              type="text"
                              value={item.filtroFoco || ''}
                              onChange={(e) => handleUpdateItemFoco(item.clienteId, e.target.value)}
                              placeholder="Foco livre (ex: Hidráulica)"
                              className="w-full bg-slate-50 dark:bg-[#162f27]/40 border border-slate-200 dark:border-[#214739] rounded-lg py-1 px-2 text-[10px] text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-[#11d493]"
                            />
                          )}
                        </div>
                      </td>

                      {/* Status da IA */}
                      <td className="py-3 px-4">
                        {isGerando ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 font-bold text-[11px] animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Compondo com IA...</span>
                          </span>
                        ) : isGerado && item.ofertaGerada ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-[#11d493] font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{item.ofertaGerada.itens.length} itens</span>
                                <span className="font-mono ml-1 font-bold text-slate-900 dark:text-white">
                                  {formatCurrency(item.ofertaGerada.valorTotal)}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setItemVisualizandoOferta(item)}
                                className="p-1 rounded text-slate-400 hover:text-[#11d493] transition cursor-pointer"
                                title="Ver e ajustar quantidades do pedido"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {item.nfeEmitida && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-bold text-[10px] border border-emerald-500/30 w-fit">
                                <span>✓ No Bling #{item.nfeEmitida.numeroNFe} (Pendente)</span>
                              </span>
                            )}
                            {item.erro && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 font-medium text-[10px] border border-rose-500/30 max-w-[240px] truncate" title={item.erro}>
                                <AlertCircle className="w-3 h-3 shrink-0 text-rose-400" />
                                <span className="truncate">{item.erro}</span>
                              </span>
                            )}
                          </div>
                        ) : isErro ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 font-bold text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Erro na geração</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#162f27] text-slate-400 font-bold text-[10px]">
                            Aguardando geração
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isGerado ? (
                            <>
                              {itemEmitindoNFeId === item.clienteId ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/30 animate-pulse">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Gravando...</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleEmitirLinha(item)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] shadow-sm transition active:scale-95 cursor-pointer ${
                                    item.nfeEmitida
                                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                      : 'bg-[#11d493] hover:bg-[#0eb880] text-slate-950'
                                  }`}
                                  title={item.nfeEmitida ? 'Gravar novamente no Bling' : 'Gravar rascunho de nota de saída no Bling'}
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>{item.nfeEmitida ? 'Reenviar' : 'Emitir'}</span>
                                </button>
                              )}

                              {item.nfeEmitida && onViewDanfe && (
                                <button
                                  type="button"
                                  onClick={() => onViewDanfe(item.nfeEmitida!)}
                                  className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                                  title="Visualizar DANFE"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {item.nfeEmitida && onViewBoleto && item.nfeEmitida.parcelas?.[0] && (
                                <button
                                  type="button"
                                  onClick={() => onViewBoleto(item.nfeEmitida!.parcelas[0], item.nfeEmitida!)}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-[#11d493] font-bold text-[11px] transition active:scale-95 cursor-pointer"
                                  title="Visualizar Boleto e PIX"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGerarItemIndividual(item.clienteId)}
                              disabled={isGerando}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-[#11d493] font-bold text-[11px] border border-emerald-500/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
                              title="Gerar orçamento deste cliente agora"
                            >
                              <Play className="w-3 h-3" />
                              <span>Gerar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoverCliente(item.clienteId)}
                            className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Remover deste grupo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {grupoAtivo && grupoAtivo.clientes.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-[#162f27]/80 border-t-2 border-slate-200 dark:border-[#1a382e] font-bold text-xs">
                    <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200">
                      Total ({grupoAtivo.clientes.length} clientes no lote)
                    </td>
                    <td className="py-3.5 px-3 font-mono font-black text-amber-500 dark:text-amber-400">
                      {formatCurrency(
                        grupoAtivo.clientes.reduce((acc, c) => acc + (c.valorAlvo || 0), 0)
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-slate-400 text-[11px]">
                      Soma das metas distribuídas
                    </td>
                    <td className="py-3.5 px-4 font-mono font-black text-emerald-600 dark:text-[#11d493]" colSpan={2}>
                      Total Orçado: {formatCurrency(
                        grupoAtivo.clientes.reduce((acc, c) => acc + (c.ofertaGerada?.valorTotal || 0), 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
        </div>
      )}

      {/* Modal: Novo Grupo */}
      {isNovoGrupoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCriarGrupo}
            className="bg-white dark:bg-[#10221c] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-[#1a382e] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#11d493]" />
                <span>Novo Grupo de Clientes</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNovoGrupoModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome do Grupo</label>
              <input
                type="text"
                required
                value={nomeNovoGrupo}
                onChange={(e) => setNomeNovoGrupo(e.target.value)}
                placeholder="Ex: Clientes VIP Vale do Paraíba, Obras Ativas..."
                className="w-full bg-slate-50 dark:bg-[#162f27] border border-slate-200 dark:border-[#214739] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#11d493]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNovoGrupoModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#162f27] text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#11d493] text-slate-950 hover:bg-[#0eb880]"
              >
                Criar Grupo e Adicionar Clientes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Adicionar Clientes ao Grupo (Multi-Seleção) */}
      {isAddClientesModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#10221c] rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-[#1a382e] space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#11d493]" />
                  <span>Selecionar Clientes para o Grupo</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Grupo: <strong className="text-slate-900 dark:text-white">{grupoAtivo?.nome}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddClientesModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={buscaClienteModal}
                onChange={(e) => setBuscaClienteModal(e.target.value)}
                placeholder="Buscar por razão social, nome fantasia ou CNPJ/CPF..."
                className="w-full bg-slate-50 dark:bg-[#162f27] border border-slate-200 dark:border-[#214739] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#11d493]"
              />
            </div>

            {/* Lista com Checkboxes */}
            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[50vh] pr-1">
              {clientesFiltradosModal.length === 0 ? (
                <p className="text-xs text-center text-slate-400 py-8">Nenhum cliente encontrado.</p>
              ) : (
                clientesFiltradosModal.map((c) => {
                  const isChecked = clientesSelecionadosModal.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-slate-50 dark:bg-[#162f27]/40 border-slate-200 dark:border-[#214739] hover:bg-slate-100 dark:hover:bg-[#162f27]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setClientesSelecionadosModal((prev) => [...prev, c.id]);
                            } else {
                              setClientesSelecionadosModal((prev) => prev.filter((id) => id !== c.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-[#11d493] focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                            {c.nome} {c.fantasia ? `(${c.fantasia})` : ''}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {c.numeroDocumento} {c.endereco?.geral?.municipio ? `• ${c.endereco?.geral?.municipio}/${c.endereco?.geral?.uf || 'SP'}` : ''}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Rodapé da Modal */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-[#1a382e]">
              <span className="text-xs font-bold text-slate-500">
                {clientesSelecionadosModal.length} clientes selecionados
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddClientesModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#162f27] text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarAddClientes}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#11d493] text-slate-950 hover:bg-[#0eb880]"
                >
                  Confirmar e Salvar no Grupo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Visualizar Detalhes da Oferta Gerada pela IA */}
      {itemVisualizandoOferta && itemVisualizandoOferta.ofertaGerada && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#10221c] rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-[#1a382e] space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>Orçamento Personalizado por IA</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cliente: <strong className="text-slate-900 dark:text-white">{itemVisualizandoOferta.nome}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setItemVisualizandoOferta(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Card com Resumo de Valor e Justificativa */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#162f27]/50 border border-slate-200 dark:border-[#214739] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Valor Alvo Pretendido:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {formatCurrency(itemVisualizandoOferta.valorAlvo)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-600 dark:text-[#11d493] font-bold">Total Calculado pelo Robô:</span>
                <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                  {formatCurrency(itemVisualizandoOferta.ofertaGerada.valorTotal)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1 italic">
                "{itemVisualizandoOferta.ofertaGerada.razaoExplicativa}"
              </p>
            </div>

            {/* Tabela de Produtos Compostos com Ajuste de Quantidade */}
            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[45vh] pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#214739] text-[10px] uppercase font-bold text-slate-400">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-center w-36">Quantidade</th>
                    <th className="py-2 text-right">Unitário</th>
                    <th className="py-2 text-right">Subtotal</th>
                    <th className="py-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#214739]/50">
                  {itemVisualizandoOferta.ofertaGerada.itens.map((it: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-[#162f27]/30 transition">
                      <td className="py-2 pr-2">
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">{it.descricao}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{it.codigo || it.id} • {it.unidade || 'UN'}</p>
                      </td>
                      <td className="py-2 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-[#162f27] border border-slate-200 dark:border-[#214739] rounded-lg p-1">
                          <button
                            type="button"
                            onClick={() => handleAlterarQuantidadeItemOferta(idx, -1)}
                            disabled={it.quantidade <= 1}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#214739] disabled:opacity-30 cursor-pointer"
                            title="Diminuir quantidade"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-9 font-mono font-bold text-xs text-center text-slate-900 dark:text-white">
                            {it.quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAlterarQuantidadeItemOferta(idx, 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#214739] cursor-pointer"
                            title="Aumentar quantidade"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 text-right font-mono">{formatCurrency(it.valorUnitario)}</td>
                      <td className="py-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(it.valorTotal)}
                      </td>
                      <td className="py-2 text-center">
                        {itemVisualizandoOferta.ofertaGerada.itens.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoverItemOferta(idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Remover produto da proposta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Ações do Modal */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#1a382e]">
              <button
                type="button"
                onClick={() => setItemVisualizandoOferta(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#162f27] text-slate-700 dark:text-slate-300"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = itemVisualizandoOferta;
                  setItemVisualizandoOferta(null);
                  handleEmitirLinha(target);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#11d493] text-slate-950 hover:bg-[#0eb880]"
              >
                Emitir NF-e e Boleto Deste Orçamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Grupo de Produtos / Kit */}
      {isNovoGrupoProdutoModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCriarGrupoProdutos}
            className="bg-white dark:bg-[#10221c] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-[#1a382e] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <span>Novo Grupo de Produtos (Kit / Combo)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNovoGrupoProdutoModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome do Kit / Grupo</label>
              <input
                type="text"
                required
                value={nomeNovoGrupoProduto}
                onChange={(e) => setNomeNovoGrupoProduto(e.target.value)}
                placeholder="Ex: Kit Hidráulica Básica, Combo Elétrica..."
                className="w-full bg-slate-50 dark:bg-[#162f27] border border-slate-200 dark:border-[#214739] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Descrição / Finalidade (Opcional)</label>
              <input
                type="text"
                value={descNovoGrupoProduto}
                onChange={(e) => setDescNovoGrupoProduto(e.target.value)}
                placeholder="Ex: Produtos para instalação hidráulica em residências"
                className="w-full bg-slate-50 dark:bg-[#162f27] border border-slate-200 dark:border-[#214739] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNovoGrupoProdutoModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#162f27] text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#11d493] text-slate-950 hover:bg-[#0eb880]"
              >
                Criar Kit de Produtos
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Adicionar Produtos ao Grupo de Produtos */}
      {isAddProdutosModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#10221c] rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-[#1a382e] space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-400" />
                  <span>Adicionar Produtos em "{grupoProdutoSelecionado?.nome}"</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selecione os produtos do catálogo para compor as propostas deste kit
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProdutosModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Busca Rápida de Produtos com Botão de Limpar (X) */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={buscaProdutoModal}
                onChange={(e) => setBuscaProdutoModal(e.target.value)}
                placeholder="Buscar por descrição, código ou categoria do produto..."
                className="w-full bg-slate-50 dark:bg-[#162f27] border border-slate-200 dark:border-[#214739] rounded-xl pl-9 pr-9 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-400"
              />
              {buscaProdutoModal && (
                <button
                  type="button"
                  onClick={() => setBuscaProdutoModal('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition cursor-pointer"
                  title="Limpar busca e desfazer filtro dinâmico"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Barra de Controle de Seleção em Lote (Estilo Google Planilhas) */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100 dark:bg-[#162f27] rounded-xl border border-slate-200 dark:border-[#214739] text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer select-none font-bold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={todosVisiveisSelecionados}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = algunsVisiveisSelecionados;
                    }
                  }}
                  onChange={handleToggleSelecionarTodosVisiveis}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                />
                <span>
                  {todosVisiveisSelecionados
                    ? `Desmarcar todos os ${codigosVisiveisModal.length} itens visíveis`
                    : `Selecionar todos os ${codigosVisiveisModal.length} produtos filtrados`}
                </span>
              </label>

              {produtosSelecionadosModal.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black text-amber-500 dark:text-amber-400">
                    {produtosSelecionadosModal.length} selecionados no total
                  </span>
                  <button
                    type="button"
                    onClick={() => setProdutosSelecionadosModal([])}
                    className="text-[11px] text-slate-400 hover:text-rose-400 font-semibold underline cursor-pointer transition"
                    title="Desmarcar todos os produtos selecionados"
                  >
                    Limpar seleção
                  </button>
                </div>
              )}
            </div>

            {/* Lista com Checkbox */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[46vh] pr-1">
              {produtosFiltradosModal.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-slate-400">Nenhum produto encontrado com o filtro atual.</p>
                  {buscaProdutoModal && (
                    <button
                      type="button"
                      onClick={() => setBuscaProdutoModal('')}
                      className="mt-2 text-xs text-amber-400 hover:underline font-bold"
                    >
                      Limpar filtro de busca
                    </button>
                  )}
                </div>
              ) : (
                produtosFiltradosModal.map((p: any) => {
                  const codigo = String(p.codigo || p.id);
                  const isChecked = produtosSelecionadosModal.includes(codigo);
                  return (
                    <label
                      key={codigo}
                      className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                        isChecked
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-slate-50 dark:bg-[#162f27]/40 border-slate-200 dark:border-[#214739] hover:bg-slate-100 dark:hover:bg-[#162f27]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setProdutosSelecionadosModal((prev) => [...prev, codigo]);
                            } else {
                              setProdutosSelecionadosModal((prev) => prev.filter((id) => id !== codigo));
                            }
                          }}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                            {p.descricao}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Código: {codigo} • Unidade: {p.unidade || 'UN'} • Categoria: {p.categoria || 'Geral'}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white shrink-0 ml-3">
                        {formatCurrency(p.precoUnitario)}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Rodapé da Modal com Estatísticas e Ações */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-[#1a382e]">
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {produtosSelecionadosModal.length} produtos selecionados no total
                </span>
                {buscaProdutoModal.trim() && (
                  <span className="text-[10px] text-slate-400">
                    ({codigosVisiveisModal.filter((c: string) => produtosSelecionadosModal.includes(c)).length} marcados visíveis nesta busca)
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddProdutosModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#162f27] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1f4337] transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarAddProdutosAoGrupo}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-[#11d493] text-slate-950 hover:bg-[#0eb880] shadow-md shadow-emerald-500/20 transition cursor-pointer"
                >
                  Confirmar e Salvar no Grupo ({produtosSelecionadosModal.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
