import React, { useState, useEffect, useMemo } from 'react';
import type { BlingCliente, EmpresaTenant, BankProvider, NFeData, CompanyProfile, Installment } from '../../../types';
import {
  converterPedidoParaNFeRascunho,
  CATALOGO_PRODUTOS_PADRAO,
  type PedidoItemVenda,
  type OfertaGeradaResult,
  type CatalogoProduto,
} from '../../../utils/salesOptimizer';
import {
  gerarOfertaComGeminiOuLocal,
  getStoredGeminiApiKey,
  isCerebroIAConectado,
} from '../../../services/geminiService';
import {
  Sparkles,
  ShoppingBag,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  Layers,
  ArrowRight,
  X,
  Key,
  CloudUpload,
  AlertTriangle,
  Target,
  Calendar,
  Users,
  RefreshCw,
} from 'lucide-react';
import { BANKS } from '../../../utils/financeEngine';
import {
  gravarEsbocoNFeNoBling,
  obterProdutosCacheLocal,
  type ResultadoEsbocoBling,
} from '../../../services/blingService';
import { GruposClientesView } from './GruposClientesView';

interface SalesViewProps {
  empresa: EmpresaTenant;
  company?: CompanyProfile;
  clientes: BlingCliente[];
  bancoAtual: BankProvider;
  onViewDanfe?: (nfe: NFeData) => void;
  onViewBoleto?: (parcela: Installment, nfe: NFeData) => void;
  onEmitirNFe?: (nfe: NFeData) => void;
  onOpenApiKeys?: () => void;
  onNavigateToProducts?: () => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  empresa,
  company,
  clientes = [],
  bancoAtual = 'inter',
  onViewDanfe,
  onViewBoleto,
  onEmitirNFe,
  onOpenApiKeys,
  onNavigateToProducts,
}) => {
  const [subAbaVendas, setSubAbaVendas] = useState<'individual' | 'grupos'>('individual');
  const [selectedClienteId, setSelectedClienteId] = useState<number | string>(
    clientes.length > 0 ? clientes[0].id : ''
  );
  const [valorAlvoInput, setValorAlvoInput] = useState<string>('5000');
  const [diretrizComercial, setDiretrizComercial] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultadoOferta, setResultadoOferta] = useState<OfertaGeradaResult | null>(null);
  const [itensPedido, setItensPedido] = useState<PedidoItemVenda[]>([]);
  const [parcelasCount, setParcelasCount] = useState<number>(1);
  const [primeiroVencimento, setPrimeiroVencimento] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [intervaloDiasInput, setIntervaloDiasInput] = useState<string>('15');
  const intervaloDias = Math.max(1, parseInt(intervaloDiasInput, 10) || 15);
  const [bancoSelecionado, setBancoSelecionado] = useState<BankProvider>(bancoAtual);

  const previewParcelas = useMemo(() => {
    if (itensPedido.length === 0) return [];
    let baseDate = new Date();
    if (primeiroVencimento && /^\d{4}-\d{2}-\d{2}$/.test(primeiroVencimento)) {
      const [ano, mes, dia] = primeiroVencimento.split('-').map(Number);
      baseDate = new Date(ano, mes - 1, dia);
    } else {
      baseDate.setDate(baseDate.getDate() + (intervaloDias || 30));
    }

    const valorTotal = Number(itensPedido.reduce((acc, it) => acc + it.valorTotal, 0).toFixed(2));
    const qtd = Math.max(1, Math.min(parcelasCount, 48));
    const valorBase = Number((valorTotal / qtd).toFixed(2));
    let acumulado = 0;

    const list: { parcela: number; total: number; dataFormatada: string; valor: number }[] = [];

    for (let i = 1; i <= qtd; i++) {
      const d = new Date(baseDate);
      if (i > 1) {
        d.setDate(d.getDate() + (i - 1) * (intervaloDias || 30));
      }
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const valor = i === qtd ? Number((valorTotal - acumulado).toFixed(2)) : valorBase;
      acumulado += valor;

      list.push({
        parcela: i,
        total: qtd,
        dataFormatada: `${dd}/${mm}/${yyyy}`,
        valor,
      });
    }
    return list;
  }, [itensPedido, parcelasCount, primeiroVencimento, intervaloDias]);

  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [nfeGeradaSucesso, setNfeGeradaSucesso] = useState<NFeData | null>(null);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(() => Boolean(getStoredGeminiApiKey()));
  const [isSavingBling, setIsSavingBling] = useState(false);
  const [resultadoBling, setResultadoBling] = useState<ResultadoEsbocoBling | null>(null);

  // Inicializa imediatamente com os produtos do cache local desta empresa (0ms de atraso)
  const [catalogoProdutos, setCatalogoProdutos] = useState<CatalogoProduto[]>(() => {
    const cached = obterProdutosCacheLocal(empresa.id);
    return cached.length > 0 ? cached : CATALOGO_PRODUTOS_PADRAO;
  });
  const [isProdutosDoBling, setIsProdutosDoBling] = useState<boolean>(() => {
    return obterProdutosCacheLocal(empresa.id).length > 0;
  });
  const [isLoadingProdutosBling] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyChange = () => {
      setHasGeminiKey(Boolean(getStoredGeminiApiKey()));
    };
    handleKeyChange();
    window.addEventListener('gemini_key_updated', handleKeyChange);
    window.addEventListener('storage', handleKeyChange);
    return () => {
      window.removeEventListener('gemini_key_updated', handleKeyChange);
      window.removeEventListener('storage', handleKeyChange);
    };
  }, []);

  // Ao trocar de empresa, utiliza rigorosamente a base local (Local-First)
  useEffect(() => {
    const cached = obterProdutosCacheLocal(empresa.id);
    if (cached.length > 0) {
      setCatalogoProdutos(cached);
      setIsProdutosDoBling(true);
    } else {
      // Se não há cache ainda, usa o padrão provisório até a sincronização ocorrer
      setCatalogoProdutos(CATALOGO_PRODUTOS_PADRAO);
      setIsProdutosDoBling(false);
    }
  }, [empresa.id]);

  // Escuta atualizações de sincronização para recarregar o catálogo automaticamente
  useEffect(() => {
    const handleStorageUpdate = () => {
      const cached = obterProdutosCacheLocal(empresa.id);
      if (cached.length > 0) {
        setCatalogoProdutos(cached);
        setIsProdutosDoBling(true);
      }
    };
    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, [empresa.id]);

  const clienteSelecionado = clientes.find((c) => c.id === Number(selectedClienteId)) || clientes[0] || null;

  // Gera oferta inteligente estritamente com Inteligência Artificial (Google Gemini)
  const handleGerarOferta = async () => {
    const valorAlvo = parseFloat(valorAlvoInput.replace(/\D/g, '')) || 0;
    if (valorAlvo <= 0) {
      alert('Por favor, informe um valor alvo válido para a venda.');
      return;
    }

    // TRAVA DE SEGURANÇA: Sem cérebro, sem proposta
    if (!isCerebroIAConectado()) {
      if (onOpenApiKeys) {
        onOpenApiKeys();
      }
      alert('⚠️ Cérebro de IA Desconectado!\n\nPara garantir que nenhum cliente receba um orçamento com produtos aleatórios ou sem coerência técnica, conecte sua chave do Google Gemini antes de gerar propostas inteligentes.');
      return;
    }

    setIsGenerating(true);
    setNfeGeradaSucesso(null);

    const catalogoParaOferta = catalogoProdutos.length > 0 ? catalogoProdutos : CATALOGO_PRODUTOS_PADRAO;

    try {
      const res = await gerarOfertaComGeminiOuLocal(
        valorAlvo,
        0.05,
        catalogoParaOferta,
        diretrizComercial.trim() || undefined
      );
      setResultadoOferta(res);
      setItensPedido(res.itens);
    } catch (err: any) {
      setResultadoOferta(null);
      alert(`⚠️ Não foi possível gerar a proposta com IA:\n\n${err?.message || 'Falha de comunicação com o Google Gemini. Nenhum produto foi gerado para evitar itens aleatórios.'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Ajuste de quantidade de um item
  const handleUpdateQuantidade = (id: string, delta: number) => {
    setItensPedido((prev) =>
      prev
        .map((it) => {
          if (it.id === id) {
            const novaQtd = Math.max(1, it.quantidade + delta);
            return {
              ...it,
              quantidade: novaQtd,
              valorTotal: Number((novaQtd * it.valorUnitario).toFixed(2)),
            };
          }
          return it;
        })
        .filter((it) => it.quantidade > 0)
    );
  };

  // Remover item do pedido
  const handleRemoveItem = (id: string) => {
    setItensPedido((prev) => prev.filter((it) => it.id !== id));
  };

  // Adicionar produto avulso do catálogo
  const handleAddProdutoCatalogo = (prod: CatalogoProduto) => {
    setItensPedido((prev) => {
      const existente = prev.find((it) => it.id === prod.id);
      if (existente) {
        return prev.map((it) =>
          it.id === prod.id
            ? {
                ...it,
                quantidade: it.quantidade + 1,
                valorTotal: Number(((it.quantidade + 1) * it.valorUnitario).toFixed(2)),
              }
            : it
        );
      }
      return [
        ...prev,
        {
          id: prod.id,
          descricao: prod.descricao,
          quantidade: 1,
          unidade: prod.unidade,
          valorUnitario: prod.precoUnitario,
          valorTotal: prod.precoUnitario,
          ncm: prod.ncm,
          cfop: prod.cfop,
          categoria: prod.categoria,
        },
      ];
    });
    setShowAddProductModal(false);
  };

  // Valor total atual do pedido editado
  const totalPedidoAtual = Number(itensPedido.reduce((acc, it) => acc + it.valorTotal, 0).toFixed(2));
  const valorAlvoNum = parseFloat(valorAlvoInput.replace(/\D/g, '')) || 0;
  const margemAtual = valorAlvoNum > 0 ? Number((((totalPedidoAtual - valorAlvoNum) / valorAlvoNum) * 100).toFixed(1)) : 0;

  // Aprovar Pedido e Preparar NF-e em Rascunho Local
  const handleAprovarEPrepararNFe = () => {
    if (!clienteSelecionado) {
      alert('Selecione um cliente para aprovar o pedido de venda.');
      return;
    }
    if (itensPedido.length === 0) {
      alert('Adicione pelo menos um produto ao pedido.');
      return;
    }

    const nfeRascunho = converterPedidoParaNFeRascunho(
      clienteSelecionado,
      itensPedido,
      empresa,
      bancoSelecionado,
      parcelasCount,
      intervaloDias,
      primeiroVencimento
    );

    setNfeGeradaSucesso(nfeRascunho);

    if (onEmitirNFe) {
      onEmitirNFe(nfeRascunho);
    }
  };

  // Gravar Esboço de Nota no Bling (Vendas > Notas Fiscais / Notas de Saída)
  const handleGravarEsbocoNoBling = async () => {
    if (!clienteSelecionado) {
      alert('Selecione um cliente para gravar o esboço de nota.');
      return;
    }
    if (itensPedido.length === 0) {
      alert('Adicione pelo menos um produto ao pedido antes de gravar no Bling.');
      return;
    }

    setIsSavingBling(true);
    setResultadoBling(null);

    // Timer de segurança para garantir que o botão nunca fique travado
    const safetyTimer = setTimeout(() => {
      setIsSavingBling(false);
    }, 25000);

    // 1. Gera rascunho oficial local para habilitar DANFE imediatamente
    const nfeRascunho = converterPedidoParaNFeRascunho(
      clienteSelecionado,
      itensPedido,
      empresa,
      bancoSelecionado,
      parcelasCount,
      intervaloDias,
      primeiroVencimento
    );
    setNfeGeradaSucesso(nfeRascunho);

    if (onEmitirNFe) {
      onEmitirNFe(nfeRascunho);
    }

    // 2. Envia para a API v3 do Bling (POST /nfe)
    try {
      if (!empresa.blingAccessToken || !empresa.blingAccessToken.trim()) {
        setResultadoBling({
          sucesso: false,
          mensagem: `A empresa "${empresa.nomeFantasia || empresa.razaoSocial}" não possui um Token de Acesso do Bling ativo configurado. Conecte as credenciais desta empresa antes de gravar notas fiscais.`,
        });
        return;
      }

      const res = await gravarEsbocoNFeNoBling({
        empresaToken: empresa.blingAccessToken.trim(),
        cliente: clienteSelecionado,
        itens: itensPedido,
        parcelasCount,
        banco: bancoSelecionado,
        primeiroVencimento,
        intervaloDias,
      });

      setResultadoBling(res);

      if (res.sucesso && res.idNotaBling) {
        nfeRascunho.numeroNFe = String(res.numeroNota || res.idNotaBling);
        setNfeGeradaSucesso({ ...nfeRascunho });
      }
    } catch (e: any) {
      setResultadoBling({
        sucesso: false,
        mensagem: e?.message || 'Falha ao conectar com o Bling ERP.',
      });
    } finally {
      clearTimeout(safetyTimer);
      setIsSavingBling(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] overflow-y-auto font-['Manrope',sans-serif] transition-colors pb-16">
      {/* Header da Página */}
      <div className="p-6 md:p-8 pb-4 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
                <ShoppingBag className="w-7 h-7 text-[#11d493]" />
                <span>Vendas & Ofertas IA</span>
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-3.5 h-3.5 text-[#11d493]" />
                Compositor Inteligente
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">
              Gere propostas de vendas ideais baseadas no valor alvo pretendido e prepare a NF-e sem transmissão imediata.
            </p>
          </div>

          {/* Status do Cérebro IA (Google Gemini) */}
          <button
            type="button"
            onClick={onOpenApiKeys}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer w-fit ${
              hasGeminiKey
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 animate-pulse'
            }`}
            title={hasGeminiKey ? 'Cérebro Google Gemini Conectado' : 'Clique para configurar a Chave de API Gemini'}
          >
            <span className={`w-2 h-2 rounded-full ${hasGeminiKey ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <Sparkles className="w-3.5 h-3.5" />
            <span>{hasGeminiKey ? 'Cérebro IA Ativo (Gemini)' : 'IA Desconectada • Conectar Chave'}</span>
          </button>
        </div>

        {/* Seletor de Modo: Orçamento Individual vs Grupos & Lote */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#162f27] border border-slate-200 dark:border-[#214739] w-fit shadow-sm">
          <button
            type="button"
            onClick={() => setSubAbaVendas('individual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subAbaVendas === 'individual'
                ? 'bg-[#11d493] text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Orçamento Individual</span>
          </button>

          <button
            type="button"
            onClick={() => setSubAbaVendas('grupos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subAbaVendas === 'grupos'
                ? 'bg-[#11d493] text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Grupos & Vendas em Lote (IA)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-500 dark:text-amber-300 font-black">
              NOVO
            </span>
          </button>
        </div>

        {subAbaVendas === 'grupos' ? (
          <GruposClientesView
            empresa={empresa}
            company={
              company || {
                razaoSocial: empresa.razaoSocial,
                nomeFantasia: empresa.nomeFantasia,
                cnpj: empresa.cnpj,
                inscricaoEstadual: empresa.inscricaoEstadual || '',
                logradouro: empresa.logradouro || '',
                numero: empresa.numero || '',
                bairro: empresa.bairro || '',
                cidade: empresa.cidade || 'São Paulo',
                uf: empresa.uf || 'SP',
                cep: empresa.cep || '',
                regimeTributario: empresa.regimeTributario || 'Simples Nacional',
                certificadoA1Valido: empresa.certificadoA1Valido ?? true,
              }
            }
            bancoAtual={bancoAtual}
            clientes={clientes}
            catalogoProdutos={catalogoProdutos}
            onViewDanfe={onViewDanfe}
            onViewBoleto={onViewBoleto}
            onEmitirNFe={onEmitirNFe}
            onOpenApiKeys={onOpenApiKeys}
          />
        ) : (
          <>
            {/* 1. Sucesso ao Gravar no Bling */}
            {resultadoBling?.sucesso && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#11d493] text-slate-950 flex items-center justify-center font-bold shrink-0">
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>Esboço Gravado com Sucesso no Bling!</span>
                  {resultadoBling.idNotaBling && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-[#11d493] border border-emerald-500/30">
                      ID Bling #{resultadoBling.idNotaBling}
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Vendas &gt; Notas de Saída
                  </span>
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                  A nota já está no seu painel do Bling com status <strong>Pendente / Em digitação</strong>.
                </p>
              </div>
            </div>

            {nfeGeradaSucesso && onViewDanfe && (
              <button
                onClick={() => onViewDanfe(nfeGeradaSucesso)}
                className="px-4 py-2 bg-[#11d493] text-slate-950 font-bold rounded-xl text-xs hover:bg-[#0eb880] shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <span>Visualizar DANFE</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* 2. Alerta ou Erro do Bling */}
        {resultadoBling && !resultadoBling.sucesso && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 animate-fade-in text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-sm">Aviso da Integração com o Bling</span>
              <p className="leading-relaxed">{resultadoBling.mensagem}</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                O rascunho oficial da NF-e foi gerado no app e você pode conferir o DANFE normalmente.
              </p>
            </div>
          </div>
        )}

        {/* 3. Notificação de NF-e Preparada Localmente */}
        {!resultadoBling && nfeGeradaSucesso && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#11d493] text-slate-950 flex items-center justify-center font-bold shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <span>NF-e Nº {nfeGeradaSucesso.numeroNFe} Preparada com Sucesso!</span>
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    Rascunho Oficial (Não Transmitida)
                  </span>
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                  Valor Total: <strong>{nfeGeradaSucesso.valorTotalFormatado}</strong> • Cliente: <strong>{nfeGeradaSucesso.destinatario.razaoSocial}</strong>
                </p>
              </div>
            </div>

            {onViewDanfe && (
              <button
                onClick={() => onViewDanfe(nfeGeradaSucesso)}
                className="px-4 py-2 bg-[#11d493] text-slate-950 font-bold rounded-xl text-xs hover:bg-[#0eb880] shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>Visualizar DANFE</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Painel Principal: 2 Colunas (Gerador IA à Esquerda + Pedido Editável à Direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna 1: Formulário do Gerador IA (5 Colunas) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-[#214739] shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#214739]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-[#11d493] flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">
                    Parâmetros da Oferta
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-gray-400">Margem até +5%</span>
              </div>

              {/* Status da Conexão IA Gemini */}
              <div className="p-2.5 rounded-xl bg-purple-500/10 dark:bg-purple-950/20 border border-purple-500/20 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="text-[11px] text-purple-950 dark:text-purple-200">
                    Cérebro: <strong>{hasGeminiKey ? 'Google Gemini Ativo' : 'Motor Local (Offline)'}</strong>
                  </span>
                </div>
                {onOpenApiKeys && (
                  <button
                    type="button"
                    onClick={onOpenApiKeys}
                    className="text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Key className="w-3 h-3" />
                    <span>{hasGeminiKey ? 'Gerenciar' : 'Configurar Chave'}</span>
                  </button>
                )}
              </div>

              {/* 1. Seleção do Cliente */}
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                  <span>Cliente / Destinatário *</span>
                  <span className="text-[10px] text-gray-400">Base Bling</span>
                </label>
                <select
                  value={selectedClienteId}
                  onChange={(e) => setSelectedClienteId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-[#10221c] text-gray-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-[#11d493] focus:outline-none cursor-pointer"
                >
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fantasia || c.nome} • CNPJ: {c.numeroDocumento}
                    </option>
                  ))}
                </select>

                {clienteSelecionado && (
                  <div className="mt-2 p-2 rounded-xl bg-gray-50 dark:bg-[#10221c] border border-gray-200/60 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
                    <span className="truncate">{clienteSelecionado.nome}</span>
                    <span className="font-bold text-emerald-600 shrink-0 ml-1">
                      {clienteSelecionado.endereco?.geral?.municipio || 'São Paulo'}/{clienteSelecionado.endereco?.geral?.uf || 'SP'}
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Valor Alvo Desejado */}
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1.5">
                  Valor Alvo da Venda (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">
                    R$
                  </span>
                  <input
                    type="number"
                    value={valorAlvoInput}
                    onChange={(e) => setValorAlvoInput(e.target.value)}
                    placeholder="Ex: 5000"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white text-base font-black focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                  />
                </div>

                {/* Atalhos Rápidos de Valor */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {['1500', '3000', '5000', '10000', '20000'].map((val) => (
                    <button
                      key={val}
                      onClick={() => setValorAlvoInput(val)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                        valorAlvoInput === val
                          ? 'bg-[#11d493] text-slate-950 shadow-sm'
                          : 'bg-gray-100 dark:bg-[#10221c] text-gray-600 dark:text-gray-400 hover:text-gray-900'
                      }`}
                    >
                      R$ {Number(val).toLocaleString('pt-BR')}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Foco / Diretriz Comercial (Opcional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#11d493]" />
                    <span>Foco / Diretriz Comercial (Opcional)</span>
                  </label>
                  {diretrizComercial && (
                    <button
                      type="button"
                      onClick={() => setDiretrizComercial('')}
                      className="text-[10px] text-gray-400 hover:text-red-500 font-bold cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={diretrizComercial}
                  onChange={(e) => setDiretrizComercial(e.target.value)}
                  placeholder="Ex: Foco em hidráulica e tubulações / Elétrica..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#10221c] text-gray-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-[#11d493] focus:outline-none"
                />

                {/* Pílulas de Foco Rápido */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {[
                    { label: '💧 Hidráulica & Tubos', val: 'Hidráulica, tubos e conexões' },
                    { label: '⚡ Elétrica & Cabos', val: 'Elétrica, cabos e disjuntores' },
                    { label: '🧱 Alvenaria & Cimento', val: 'Alvenaria, cimento e argamassa' },
                    { label: '🏗️ Mix Geral de Obra', val: 'Mix equilibrado de materiais de construção' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setDiretrizComercial(diretrizComercial === item.val ? '' : item.val)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        diretrizComercial === item.val
                          ? 'bg-[#11d493] text-slate-950 shadow-sm font-black'
                          : 'bg-gray-100 dark:bg-[#10221c] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Condição de Pagamento e Banco */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Condição
                  </label>
                  <select
                    value={parcelasCount}
                    onChange={(e) => setParcelasCount(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-[#10221c] text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-[#11d493] cursor-pointer"
                  >
                    <option value={1}>À Vista (1x)</option>
                    <option value={2}>2x Parcelas</option>
                    <option value={3}>3x Parcelas</option>
                    <option value={4}>4x Parcelas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Banco Emissor
                  </label>
                  <select
                    value={bancoSelecionado}
                    onChange={(e) => setBancoSelecionado(e.target.value as BankProvider)}
                    className="w-full px-2.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-[#10221c] text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-[#11d493] cursor-pointer"
                  >
                    {Object.values(BANKS).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botão de Disparo do Cérebro IA */}
              <button
                onClick={handleGerarOferta}
                disabled={isGenerating}
                className="w-full py-3 px-4 rounded-xl font-black text-xs text-slate-950 bg-gradient-to-r from-emerald-400 to-[#11d493] hover:from-emerald-500 hover:to-[#0eb880] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>{isGenerating ? 'IA Compondo Mix Ideal...' : '⚡ Gerar Oferta Automática com IA'}</span>
              </button>
            </div>

            {/* Informações do Catálogo Disponível */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-[#214739] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Layers className="w-4 h-4 text-[#11d493] shrink-0" />
                <span>
                  Base de Produtos: <strong>{catalogoProdutos.length} itens {isProdutosDoBling ? '(Bling ERP)' : ''}</strong>
                  {isLoadingProdutosBling && <span className="ml-1 text-[10px] text-gray-400 animate-pulse">(Sincronizando Bling...)</span>}
                </span>
              </div>
              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                {onNavigateToProducts && (
                  <button
                    type="button"
                    onClick={onNavigateToProducts}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-[#11d493] hover:bg-emerald-500/20 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    <span>Ver Catálogo</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(true)}
                  className="text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-[#11d493] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Item Avulso</span>
                </button>
              </div>
            </div>
          </div>

          {/* Coluna 2: Pedido de Vendas Composto & Editável (7 Colunas) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-[#214739] shadow-sm flex flex-col justify-between min-h-[480px]">
              <div className="space-y-4">
                {/* Header do Pedido */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#214739]">
                  <div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                      <span>Proposta Comercial / Pedido de Venda</span>
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Revise e ajuste as quantidades dos produtos sugeridos pela IA.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddProductModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-[#10221c] hover:bg-emerald-500/10 text-gray-700 dark:text-gray-200 hover:text-[#11d493] transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Item Extra</span>
                  </button>
                </div>

                {/* Banner de Raciocínio da IA */}
                {resultadoOferta && itensPedido.length > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-[#11d493] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Mix Inteligente Composto com Sucesso</span>
                      <span className="text-[11px] text-gray-600 dark:text-gray-300">{resultadoOferta.razaoExplicativa}</span>
                    </div>
                  </div>
                )}

                {/* Lista de Produtos do Pedido */}
                {itensPedido.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto stroke-[1.5]" />
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      Nenhum pedido gerado ainda
                    </h4>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto">
                      Defina o valor alvo à esquerda e clique em <strong>Gerar Oferta com IA</strong> para que o algoritmo componha a cesta ideal de produtos.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {itensPedido.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-gray-50/80 dark:bg-[#10221c] border border-gray-200/80 dark:border-gray-800 flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                              {item.unidade}
                            </span>
                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate block">
                              {item.descricao}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            NCM: {item.ncm} • CFOP: {item.cfop}
                          </div>
                        </div>

                        {/* Valor Unitário Destacado */}
                        <div className="text-right shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-[#162f27] border border-gray-200/80 dark:border-gray-700">
                          <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider">Unitário</span>
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                            R$ {item.valorUnitario.toFixed(2)}
                          </span>
                        </div>

                        {/* Controles de Quantidade */}
                        <div className="flex items-center gap-1 bg-white dark:bg-[#162f27] border border-gray-300 dark:border-gray-700 rounded-lg p-0.5 shrink-0">
                          <button
                            onClick={() => handleUpdateQuantidade(item.id, -1)}
                            className="w-6 h-6 rounded flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-gray-900 dark:text-white">
                            {item.quantidade}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantidade(item.id, 1)}
                            className="w-6 h-6 rounded flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        {/* Subtotal */}
                        <div className="text-right w-24 shrink-0">
                          <span className="text-[9px] text-gray-400 block uppercase font-bold tracking-wider">Subtotal</span>
                          <span className="text-xs font-black text-emerald-600 dark:text-[#11d493] block">
                            R$ {item.valorTotal.toFixed(2)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                          title="Remover item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumo Final & Botão de Aprovação de NF-e */}
              {itensPedido.length > 0 && (
                <div className="pt-4 border-t border-gray-100 dark:border-[#214739] space-y-3">
                  {/* Configuração de Vencimento e Condições de Pagamento */}
                  <div className="p-4 rounded-xl bg-white dark:bg-[#152e25] border border-gray-200 dark:border-[#214739] shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600 dark:text-[#11d493]" />
                        <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                          Condições de Pagamento & Vencimento
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-400">
                        {previewParcelas.length} {previewParcelas.length === 1 ? 'boleto' : 'boletos'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* 1º Vencimento */}
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                          1º Vencimento (Boleto)
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={primeiroVencimento}
                            onChange={(e) => setPrimeiroVencimento(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-medium bg-gray-50 dark:bg-[#10221c] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#11d493]"
                          />
                        </div>
                      </div>

                      {/* Prazo Entre Parcelas */}
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                          Prazo entre Parcelas (Dias)
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={intervaloDiasInput}
                            placeholder="15"
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setIntervaloDiasInput(val);
                            }}
                            onBlur={() => {
                              if (!intervaloDiasInput || parseInt(intervaloDiasInput, 10) <= 0) {
                                setIntervaloDiasInput('15');
                              }
                            }}
                            className="w-full px-3 py-2 text-xs font-medium bg-gray-50 dark:bg-[#10221c] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#11d493]"
                          />
                          <span className="absolute right-3 text-[11px] text-gray-400 pointer-events-none">dias</span>
                        </div>
                      </div>

                      {/* Parcelas */}
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                          Quantidade de Parcelas
                        </label>
                        <select
                          value={parcelasCount}
                          onChange={(e) => setParcelasCount(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs font-medium bg-gray-50 dark:bg-[#10221c] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#11d493]"
                        >
                          <option value="1">À vista / 1x</option>
                          <option value="2">2x parcelas</option>
                          <option value="3">3x parcelas</option>
                          <option value="4">4x parcelas</option>
                          <option value="5">5x parcelas</option>
                          <option value="6">6x parcelas</option>
                          <option value="8">8x parcelas</option>
                          <option value="10">10x parcelas</option>
                          <option value="12">12x parcelas</option>
                        </select>
                      </div>
                    </div>

                    {/* Previsão das Parcelas Calculadas */}
                    {previewParcelas.length > 0 && (
                      <div className="pt-2 border-t border-gray-100 dark:border-[#214739]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">
                            Cronograma de Vencimentos & Boletos
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-[#11d493] font-semibold">
                            Soma: R$ {totalPedidoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {previewParcelas.map((p) => (
                            <div
                              key={p.parcela}
                              className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-[#10221c] border border-gray-200 dark:border-gray-800 text-[11px] flex items-center gap-1.5"
                            >
                              <span className="font-bold text-gray-500 dark:text-gray-400">
                                {p.parcela}/{p.total}:
                              </span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {p.dataFormatada}
                              </span>
                              <span className="font-black text-emerald-600 dark:text-[#11d493]">
                                (R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">
                          * As datas e valores das parcelas serão inseridos automaticamente nas Informações Complementares da NF-e no Bling.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Resumo Financeiro */}
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#10221c] border border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                        Alvo vs Realizado
                      </span>
                      <span className="text-gray-600 dark:text-gray-300 font-medium">
                        Alvo: R$ {valorAlvoNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`ml-2 font-bold ${margemAtual <= 5 ? 'text-[#11d493]' : 'text-amber-500'}`}>
                        ({margemAtual >= 0 ? `+${margemAtual}%` : `${margemAtual}%`})
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                        Total da Venda
                      </span>
                      <span className="text-lg font-black text-emerald-600 dark:text-[#11d493]">
                        R$ {totalPedidoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Botões de Ação para Aprovação e Gravação no Bling */}
                  <div className="space-y-2">
                    <button
                      onClick={handleGravarEsbocoNoBling}
                      disabled={isSavingBling}
                      className="w-full py-3.5 px-4 bg-[#11d493] hover:bg-[#0eb880] text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isSavingBling ? (
                        <>
                          <Sparkles className="w-5 h-5 animate-spin" />
                          <span>Gravando no Bling (Vendas &gt; Notas de Saída)...</span>
                        </>
                      ) : (
                        <>
                          <CloudUpload className="w-5 h-5 stroke-[2.5]" />
                          <span>Gravar Esboço no Bling (Vendas &gt; Notas de Saída)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleAprovarEPrepararNFe}
                      className="w-full py-2 px-3 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Apenas gerar rascunho local para DANFE (sem enviar ao Bling)</span>
                    </button>
                  </div>

                  {/* Feedback Oficial do Bling ao Gravar Nota */}
                  {resultadoBling && (
                    <div className={`p-4 rounded-xl border text-xs leading-relaxed animate-fade-in ${
                      resultadoBling.sucesso
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    }`}>
                      <div className="flex items-start gap-2.5">
                        <span className="text-base shrink-0">
                          {resultadoBling.sucesso ? '🎉' : '⚠️'}
                        </span>
                        <div className="space-y-1 flex-1">
                          <span className="font-bold block text-sm">
                            {resultadoBling.sucesso ? 'Esboço Gravado com Sucesso no Bling!' : 'O Bling não aceitou a gravação da nota:'}
                          </span>
                          <p className="text-xs">{resultadoBling.mensagem}</p>

                          {!resultadoBling.sucesso && (resultadoBling.mensagem.toLowerCase().includes('token') || resultadoBling.mensagem.toLowerCase().includes('expir') || resultadoBling.mensagem.toLowerCase().includes('401')) && (
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (empresa.blingClientId && empresa.blingClientSecret) {
                                    localStorage.setItem('bling_oauth_pending_empresa_id', empresa.id);
                                    localStorage.setItem('bling_client_id', empresa.blingClientId);
                                    localStorage.setItem('bling_client_secret', empresa.blingClientSecret);
                                    window.location.href = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${empresa.blingClientId}&state=${empresa.id}`;
                                  } else {
                                    alert('Volte à tela inicial de Empresas e clique em "⚡ Ativar Bling" para reconectar com suas credenciais.');
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition active:scale-95 cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>⚡ Reconectar Bling Agora (1 Clique)</span>
                              </button>
                            </div>
                          )}

                          {resultadoBling.sucesso && resultadoBling.idNotaBling && (
                            <div className="pt-2 mt-2 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-between font-mono text-[11px]">
                              <span>ID Bling: <strong>{resultadoBling.idNotaBling}</strong></span>
                              {resultadoBling.numeroNota && (
                                <span>Número NF-e: <strong>{resultadoBling.numeroNota}</strong></span>
                              )}
                            </div>
                          )}

                          {resultadoBling.sucesso && (
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 pt-1">
                              👉 Abra o Bling no menu <strong>Vendas &gt; Notas Fiscais (ou Notas de Saída)</strong> para visualizar o esboço preparado.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      {/* Modal Adicionar Produto do Catálogo */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#162f27] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-[#214739] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Catálogo de Produtos Disponíveis
              </h3>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {catalogoProdutos.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => handleAddProdutoCatalogo(prod)}
                  className="p-3 rounded-xl bg-gray-50 dark:bg-[#10221c] hover:bg-emerald-500/10 border border-gray-200/80 dark:border-gray-800 hover:border-[#11d493] transition cursor-pointer flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {prod.codigo}
                      </span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate block">
                        {prod.descricao}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Categoria: {prod.categoria} • NCM: {prod.ncm}
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <span className="text-xs font-black text-emerald-600 dark:text-[#11d493] block">
                      R$ {prod.precoUnitario.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-gray-400">{prod.unidade}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-[#214739]">
              <button
                onClick={() => setShowAddProductModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
