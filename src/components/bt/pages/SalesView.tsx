import React, { useState, useEffect } from 'react';
import type { BlingCliente, EmpresaTenant, BankProvider, NFeData } from '../../../types';
import {
  gerarOfertaComIA,
  converterPedidoParaNFeRascunho,
  CATALOGO_PRODUTOS_PADRAO,
  type PedidoItemVenda,
  type OfertaGeradaResult,
  type CatalogoProduto,
} from '../../../utils/salesOptimizer';
import {
  gerarOfertaComGeminiOuLocal,
  getStoredGeminiApiKey,
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
} from 'lucide-react';
import { BANKS } from '../../../utils/financeEngine';

interface SalesViewProps {
  empresa: EmpresaTenant;
  clientes: BlingCliente[];
  bancoAtual: BankProvider;
  onViewDanfe?: (nfe: NFeData) => void;
  onEmitirNFe?: (nfe: NFeData) => void;
  onOpenApiKeys?: () => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  empresa,
  clientes = [],
  bancoAtual = 'inter',
  onViewDanfe,
  onEmitirNFe,
  onOpenApiKeys,
}) => {
  const [selectedClienteId, setSelectedClienteId] = useState<number | ''>(
    clientes.length > 0 ? clientes[0].id : ''
  );
  const [valorAlvoInput, setValorAlvoInput] = useState<string>('5000');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultadoOferta, setResultadoOferta] = useState<OfertaGeradaResult | null>(null);
  const [itensPedido, setItensPedido] = useState<PedidoItemVenda[]>([]);
  const [parcelasCount, setParcelasCount] = useState<number>(1);
  const [bancoSelecionado, setBancoSelecionado] = useState<BankProvider>(bancoAtual);

  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [nfeGeradaSucesso, setNfeGeradaSucesso] = useState<NFeData | null>(null);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(() => Boolean(getStoredGeminiApiKey()));

  useEffect(() => {
    setHasGeminiKey(Boolean(getStoredGeminiApiKey()));
  }, []);

  const clienteSelecionado = clientes.find((c) => c.id === Number(selectedClienteId)) || clientes[0] || null;

  // Gera oferta inteligente com IA (Google Gemini ou Motor Local com margem de até 5%)
  const handleGerarOferta = async () => {
    const valorAlvo = parseFloat(valorAlvoInput.replace(/\D/g, '')) || 0;
    if (valorAlvo <= 0) {
      alert('Por favor, informe um valor alvo válido para a venda.');
      return;
    }

    setIsGenerating(true);
    setNfeGeradaSucesso(null);

    try {
      const res = await gerarOfertaComGeminiOuLocal(valorAlvo, 0.05, CATALOGO_PRODUTOS_PADRAO);
      setResultadoOferta(res);
      setItensPedido(res.itens);
    } catch {
      const fallback = gerarOfertaComIA(valorAlvo, 0.05, CATALOGO_PRODUTOS_PADRAO);
      setResultadoOferta(fallback);
      setItensPedido(fallback.itens);
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

  // Aprovar Pedido e Preparar NF-e em Rascunho
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
      parcelasCount
    );

    setNfeGeradaSucesso(nfeRascunho);

    if (onEmitirNFe) {
      onEmitirNFe(nfeRascunho);
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
        </div>

        {/* Notificação de NF-e Preparada */}
        {nfeGeradaSucesso && (
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

              {/* 3. Condição de Pagamento e Banco */}
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
            <div className="p-4 rounded-2xl bg-white dark:bg-[#162f27] border border-gray-200 dark:border-[#214739] shadow-sm flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Layers className="w-4 h-4 text-[#11d493]" />
                <span>Catálogo de Produtos: <strong>{CATALOGO_PRODUTOS_PADRAO.length} itens</strong></span>
              </div>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="text-xs font-bold text-[#11d493] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Item</span>
              </button>
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
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                              {item.unidade}
                            </span>
                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate block">
                              {item.descricao}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            Unitário: R$ {item.valorUnitario.toFixed(2)} • NCM: {item.ncm} • CFOP: {item.cfop}
                          </div>
                        </div>

                        {/* Controles de Quantidade & Subtotal */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1 bg-white dark:bg-[#162f27] border border-gray-300 dark:border-gray-700 rounded-lg p-0.5">
                            <button
                              onClick={() => handleUpdateQuantidade(item.id, -1)}
                              className="w-6 h-6 rounded flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-gray-900 dark:text-white">
                              {item.quantidade}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantidade(item.id, 1)}
                              className="w-6 h-6 rounded flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right w-24">
                            <span className="text-xs font-black text-gray-900 dark:text-white block">
                              R$ {item.valorTotal.toFixed(2)}
                            </span>
                          </div>

                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-500/10 transition"
                            title="Remover item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumo Final & Botão de Aprovação de NF-e */}
              {itensPedido.length > 0 && (
                <div className="pt-4 border-t border-gray-100 dark:border-[#214739] space-y-3">
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

                  {/* Botão de Aprovar Pedido e Preparar Nota Fiscal */}
                  <button
                    onClick={handleAprovarEPrepararNFe}
                    className="w-full py-3.5 px-4 bg-[#11d493] hover:bg-[#0eb880] text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                    <span>Aprovar Pedido & Preparar NF-e (Rascunho Oficial)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
              {CATALOGO_PRODUTOS_PADRAO.map((prod) => (
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
