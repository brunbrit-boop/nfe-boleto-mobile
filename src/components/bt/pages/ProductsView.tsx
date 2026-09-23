import React, { useState, useEffect, useMemo } from 'react';
import type { EmpresaTenant } from '../../../types';
import type { CatalogoProduto } from '../../../utils/salesOptimizer';
import {
  carregarProdutosBling,
  obterProdutosCacheLocal,
  salvarProdutosCacheLocal,
  obterDataUltimaSyncProdutos,
  obterFiltroMaterialConstrucao,
  salvarFiltroMaterialConstrucao,
} from '../../../services/blingService';
import { formatCurrency } from '../../../utils/financeEngine';
import {
  Search,
  RefreshCw,
  Plus,
  Package,
  Boxes,
  Copy,
  Check,
  X,
  FileCode,
  Barcode,
  Trash2,
  AlertCircle,
  HardHat,
} from 'lucide-react';

interface ProductsViewProps {
  empresa: EmpresaTenant;
  onProdutosAtualizados?: (produtos: CatalogoProduto[]) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  empresa,
  onProdutosAtualizados,
}) => {
  const [produtos, setProdutos] = useState<CatalogoProduto[]>(() =>
    obterProdutosCacheLocal(empresa.id)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas');
  const [copiedSkuId, setCopiedSkuId] = useState<string | null>(null);
  const [dataSync, setDataSync] = useState<string | null>(() =>
    obterDataUltimaSyncProdutos(empresa.id)
  );

  // Filtro Inteligente de Descarte: Material de Construção
  const [apenasConstrucao, setApenasConstrucao] = useState<boolean>(() =>
    obterFiltroMaterialConstrucao(empresa.id, empresa.nomeFantasia || empresa.razaoSocial)
  );
  const [progressoStatus, setProgressoStatus] = useState<string | null>(null);

  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [diagData, setDiagData] = useState<any[] | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Form para adicionar produto manual
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoPreco, setNovoPreco] = useState('');
  const [novaUnidade, setNovaUnidade] = useState('UN');
  const [novoNcm, setNovoNcm] = useState('25232910');
  const [novaCategoria, setNovaCategoria] = useState('Geral');

  // Ao mudar de empresa, carrega a base local daquela empresa
  useEffect(() => {
    const locais = obterProdutosCacheLocal(empresa.id);
    setProdutos(locais);
    setDataSync(obterDataUltimaSyncProdutos(empresa.id));
    setApenasConstrucao(obterFiltroMaterialConstrucao(empresa.id, empresa.nomeFantasia || empresa.razaoSocial));

    // Se estiver vazio e a empresa tiver token próprio, tenta buscar automaticamente
    if (locais.length === 0 && empresa.blingAccessToken && empresa.blingAccessToken.trim()) {
      handleSincronizarBling();
    }
  }, [empresa.id, empresa.blingAccessToken]);

  // Alterna o filtro de material de construção
  const handleToggleFiltroConstrucao = () => {
    const novoValor = !apenasConstrucao;
    setApenasConstrucao(novoValor);
    salvarFiltroMaterialConstrucao(empresa.id, novoValor);
  };

  // Sincronização profunda com a API v3 do Bling
  const handleSincronizarBling = async () => {
    const token = empresa.blingAccessToken?.trim() || '';
    if (!token) {
      setFeedbackMsg({
        tipo: 'erro',
        texto: `A empresa "${empresa.nomeFantasia || empresa.razaoSocial}" não possui Token de Acesso do Bling configurado. Acesse Configurações para conectar a conta desta empresa.`,
      });
      return;
    }

    setIsLoading(true);
    setFeedbackMsg(null);
    setProgressoStatus('Iniciando varredura completa no Bling...');

    try {
      const res = await carregarProdutosBling(token, empresa.id, apenasConstrucao, (p) => {
        setProgressoStatus(
          `Lendo página ${p.pagina}... (${p.produtosEncontrados} materiais encontrados, ${p.totalDescartados} descartados)`
        );
      });

      if (res.success && res.data.length > 0) {
        setProdutos(res.data);
        if (res.rawData) {
          setDiagData(res.rawData);
        }
        const agora = new Date().toISOString();
        setDataSync(agora);
        if (onProdutosAtualizados) {
          onProdutosAtualizados(res.data);
        }

        const msgDescarte = res.totalDescartados && res.totalDescartados > 0
          ? ` (${res.totalDescartados} itens não relacionados a material de construção foram descartados para economizar memória do navegador)`
          : '';

        setFeedbackMsg({
          tipo: 'sucesso',
          texto: `Varredura completa concluída! ${res.data.length} produtos de Material de Construção importados${msgDescarte}.`,
        });
      } else {
        setFeedbackMsg({
          tipo: 'erro',
          texto: res.error || 'Nenhum produto correspondente retornado pelo Bling. Verifique se há produtos ativos no ERP.',
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        tipo: 'erro',
        texto: err.message || 'Erro ao sincronizar com o Bling.',
      });
    } finally {
      setIsLoading(false);
      setProgressoStatus(null);
      setTimeout(() => setFeedbackMsg(null), 8000);
    }
  };

  // Copiar código SKU
  const handleCopySku = (id: string, codigo: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiedSkuId(id);
    setTimeout(() => setCopiedSkuId(null), 1800);
  };

  // Cadastrar Produto Manualmente na Base Local
  const handleSalvarNovoProduto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaDescricao.trim()) return;

    const precoNum = parseFloat(novoPreco.replace(/[^\d,.-]/g, '').replace(',', '.')) || 10.0;
    const itemCriado: CatalogoProduto = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      codigo: novoCodigo.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      descricao: novaDescricao.trim(),
      precoUnitario: precoNum,
      unidade: novaUnidade.trim().toUpperCase() || 'UN',
      ncm: novoNcm.trim().replace(/\D/g, '') || '25232910',
      cfop: '5102',
      categoria: novaCategoria.trim() || 'Geral',
    };

    const atualizados = [itemCriado, ...produtos];
    setProdutos(atualizados);
    salvarProdutosCacheLocal(empresa.id, atualizados);
    if (onProdutosAtualizados) onProdutosAtualizados(atualizados);

    setShowAddModal(false);
    setNovoCodigo('');
    setNovaDescricao('');
    setNovoPreco('');
    setFeedbackMsg({
      tipo: 'sucesso',
      texto: `Produto "${itemCriado.descricao}" adicionado à base local da empresa!`,
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Remover produto local
  const handleRemoverProduto = (id: string) => {
    if (!confirm('Deseja remover este produto da base local desta empresa?')) return;
    const filtrados = produtos.filter((p) => p.id !== id);
    setProdutos(filtrados);
    salvarProdutosCacheLocal(empresa.id, filtrados);
    if (onProdutosAtualizados) onProdutosAtualizados(filtrados);
  };

  // Lista de categorias distintas
  const categorias = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => {
      if (p.categoria && p.categoria.trim()) set.add(p.categoria.trim());
    });
    return Array.from(set);
  }, [produtos]);

  // Produtos filtrados por busca e categoria
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        p.descricao.toLowerCase().includes(term) ||
        p.codigo.toLowerCase().includes(term) ||
        p.ncm.includes(term) ||
        p.categoria.toLowerCase().includes(term);

      const matchesCat =
        selectedCategoria === 'todas' || p.categoria.toLowerCase() === selectedCategoria.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [produtos, searchTerm, selectedCategoria]);

  // Estatísticas do Catálogo
  const precoMedio = useMemo(() => {
    if (produtos.length === 0) return 0;
    const soma = produtos.reduce((acc, p) => acc + (p.precoUnitario || 0), 0);
    return soma / produtos.length;
  }, [produtos]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0c1a15] text-slate-900 dark:text-white overflow-hidden font-['Manrope',sans-serif]">
      {/* Barra de Topo do Módulo */}
      <div className="p-4 md:p-6 bg-white dark:bg-[#10221c] border-b border-slate-200 dark:border-[#1a382e] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-slate-950 flex items-center justify-center shadow-md shadow-emerald-500/20 font-bold shrink-0">
              <Package className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Catálogo de Produtos & Estoque
                </h1>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-[#11d493] border border-emerald-500/20">
                  Bling ERP Espelhado
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Base local sincronizada com o ERP para consultas imediatas pelo Robô de Vendas & IA.
              </p>
            </div>
          </div>

          {/* Ações Primárias */}
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            {/* Toggle Inteligente: Filtro de Material de Construção */}
            <button
              onClick={handleToggleFiltroConstrucao}
              type="button"
              className={`px-3 py-2 rounded-xl font-bold text-xs border transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                apenasConstrucao
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/25'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#162f27] dark:hover:bg-[#1f4337] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#214739]'
              }`}
              title="Quando ativado, o aplicativo analisa os NCMs e descrições vindos do Bling, mantendo apenas insumos de construção civil e descartando todo o resto para não lotar o cache do navegador."
            >
              <HardHat className={`w-3.5 h-3.5 ${apenasConstrucao ? 'text-amber-500' : 'text-slate-400'}`} />
              <span>{apenasConstrucao ? '🏗️ Material de Construção (Filtro Ativo)' : 'Filtro Construção: Desligado'}</span>
            </button>

            <button
              onClick={handleSincronizarBling}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Baixar produtos do Bling ERP aplicando as regras de filtragem"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Varrendo Bling...' : 'Sincronizar com Bling'}</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#162f27] dark:hover:bg-[#1f4337] text-slate-800 dark:text-white font-bold text-xs border border-slate-200 dark:border-[#214739] transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Produto</span>
            </button>

            {produtos.length > 0 && (
              <button
                onClick={() => setShowDiagModal(true)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-[#1a382e] transition"
                title="Inspecionar Diagnóstico / JSON do Bling"
              >
                <FileCode className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Indicador de Varredura em Tempo Real */}
        {isLoading && progressoStatus && (
          <div className="mt-3 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
            <span>{progressoStatus}</span>
          </div>
        )}

        {/* Notificação / Feedback */}
        {feedbackMsg && (
          <div
            className={`mt-3 p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-fade-in border ${
              feedbackMsg.tipo === 'sucesso'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.tipo === 'sucesso' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{feedbackMsg.texto}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)} className="text-xs opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-[#1a382e]">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#142821] border border-slate-200/70 dark:border-[#1f4337]">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Total de Itens
            </span>
            <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
              {produtos.length} produtos
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#142821] border border-slate-200/70 dark:border-[#1f4337]">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Preço Médio
            </span>
            <span className="text-base font-black text-emerald-600 dark:text-[#11d493] mt-0.5 block">
              {formatCurrency(precoMedio)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#142821] border border-slate-200/70 dark:border-[#1f4337]">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Categorias
            </span>
            <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
              {categorias.length} categorias
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#142821] border border-slate-200/70 dark:border-[#1f4337]">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Última Sincronização
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1 block truncate">
              {dataSync ? new Date(dataSync).toLocaleString('pt-BR') : 'Pendente Bling'}
            </span>
          </div>
        </div>

        {/* Barra de Busca e Filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-2 mt-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome do produto, SKU, NCM ou categoria..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-[#142821] text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-[#1f4337] focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {categorias.length > 0 && (
            <select
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              className="w-full sm:w-52 py-2 px-3 text-xs bg-slate-50 dark:bg-[#142821] text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-[#1f4337] focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold cursor-pointer"
            >
              <option value="todas">Todas as Categorias ({produtos.length})</option>
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Conteúdo: Tabela / Listagem de Produtos */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
        {produtosFiltrados.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-white dark:bg-[#10221c] rounded-2xl border border-slate-200 dark:border-[#1a382e] p-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#162f27] text-slate-400 flex items-center justify-center mx-auto">
              <Boxes className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Nenhum produto encontrado
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {searchTerm
                ? `Nenhum item corresponde à busca "${searchTerm}". Tente outros termos.`
                : 'Sua base local ainda não possui produtos sincronizados do Bling ERP.'}
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <button
                onClick={handleSincronizarBling}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Sincronizar com Bling Agora</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {produtosFiltrados.map((prod) => {
              const isCopied = copiedSkuId === prod.id;
              return (
                <div
                  key={prod.id}
                  className="bg-white dark:bg-[#10221c] p-4 rounded-2xl border border-slate-200 dark:border-[#1a382e] shadow-sm hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#162f27] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#214739] shrink-0">
                          {prod.unidade}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 truncate">
                          {prod.categoria || 'Geral'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleRemoverProduto(prod.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                        title="Remover da base local"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Descrição */}
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                      {prod.descricao}
                    </h3>

                    {/* Código SKU com Cópia */}
                    <div
                      onClick={() => handleCopySku(prod.id, prod.codigo)}
                      className="p-1.5 px-2 rounded-lg bg-slate-50 dark:bg-[#142821] border border-slate-200/60 dark:border-[#1f4337] flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-[#193229] transition"
                      title="Clique para copiar SKU"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Barcode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {prod.codigo}
                        </span>
                      </div>
                      {isCopied ? (
                        <span className="text-[10px] font-bold text-[#11d493] flex items-center gap-1">
                          <Check className="w-3 h-3" /> Copiado!
                        </span>
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Footer: Preço & NCM */}
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-[#1a382e] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block">
                        Preço Unitário
                      </span>
                      <span className="text-base font-black text-emerald-600 dark:text-[#11d493]">
                        {formatCurrency(prod.precoUnitario)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-slate-400 block">
                        NCM Fiscal
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        {prod.ncm || '25232910'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Adicionar Produto Manual */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#10221c] text-slate-900 dark:text-white w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#1a382e] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#162f27] border-b border-slate-200 dark:border-[#214739] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600 dark:text-[#11d493]" />
                <h2 className="text-sm font-bold">Adicionar Produto Local</h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarNovoProduto} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-[11px] font-bold mb-1">
                  Nome / Descrição do Produto *
                </label>
                <input
                  type="text"
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Ex: Cimento CP II-E-32 50kg"
                  className="w-full bg-slate-50 dark:bg-[#142821] border border-slate-200 dark:border-[#1f4337] rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-[11px] font-bold mb-1">
                    Código SKU
                  </label>
                  <input
                    type="text"
                    value={novoCodigo}
                    onChange={(e) => setNovoCodigo(e.target.value)}
                    placeholder="MAT-001"
                    className="w-full bg-slate-50 dark:bg-[#142821] border border-slate-200 dark:border-[#1f4337] rounded-xl px-3 py-2 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-[11px] font-bold mb-1">
                    Preço Unitário (R$) *
                  </label>
                  <input
                    type="text"
                    value={novoPreco}
                    onChange={(e) => setNovoPreco(e.target.value)}
                    placeholder="34,90"
                    className="w-full bg-slate-50 dark:bg-[#142821] border border-slate-200 dark:border-[#1f4337] rounded-xl px-3 py-2 font-bold text-emerald-600 dark:text-[#11d493] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-[11px] font-bold mb-1">
                    Unidade
                  </label>
                  <input
                    type="text"
                    value={novaUnidade}
                    onChange={(e) => setNovaUnidade(e.target.value.toUpperCase())}
                    placeholder="UN, CX, SC"
                    className="w-full bg-slate-50 dark:bg-[#142821] border border-slate-200 dark:border-[#1f4337] rounded-xl px-2.5 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-[11px] font-bold mb-1">
                    NCM Fiscal
                  </label>
                  <input
                    type="text"
                    value={novoNcm}
                    onChange={(e) => setNovoNcm(e.target.value)}
                    placeholder="25232910"
                    className="w-full bg-slate-50 dark:bg-[#142821] border border-slate-200 dark:border-[#1f4337] rounded-xl px-2.5 py-2 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-[11px] font-bold mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={novaCategoria}
                    onChange={(e) => setNovaCategoria(e.target.value)}
                    placeholder="Geral"
                    className="w-full bg-slate-50 dark:bg-[#142821] border border-slate-200 dark:border-[#1f4337] rounded-xl px-2.5 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#1a382e] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-sm"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Diagnóstico da Resposta da API do Bling */}
      {showDiagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-950 text-slate-100 w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold font-mono">Diagnóstico da API Bling v3 (/produtos)</h2>
              </div>
              <button
                onClick={() => setShowDiagModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-blue-300">
                <p>
                  <strong>Total na base local:</strong> {produtos.length} produtos carregados.
                </p>
                <p className="mt-1">
                  <strong>Última sincronização:</strong>{' '}
                  {dataSync ? new Date(dataSync).toLocaleString('pt-BR') : 'Nunca sincronizado'}
                </p>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block mb-1">
                  Amostra dos produtos brutos retornados pelo Bling ERP:
                </span>
                <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] leading-relaxed text-slate-300 overflow-x-auto select-all max-h-72">
                  {JSON.stringify(diagData || produtos.slice(0, 5), null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
