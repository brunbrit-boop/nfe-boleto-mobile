import type { CatalogoProduto } from '../utils/salesOptimizer';
import { getStoredGeminiApiKey, isCerebroIAConectado, GEMINI_MODELS } from './geminiService';

export interface NichoComercialDef {
  id: string;
  nome: string;
  icone: string;
  corBadge: string;
  descricao: string;
  palavrasChave: string[];
  prefixosNcm?: string[];
}

export const NICHOS_COMERCIAIS_PADRAO: NichoComercialDef[] = [
  {
    id: 'cabos_condutores',
    nome: 'Cabos & Condutores',
    icone: '⚡',
    corBadge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    descricao: 'Cabos flexíveis, fios sólidos, cordões paralelos, cabos de cobre e alumínio.',
    palavrasChave: ['cabo', 'fio', 'flexivel', 'bwf', '750v', 'cordao', 'sil', 'pirelli', 'condutor', 'rolo', '100m', 'bitola', 'mm2', 'mm²'],
    prefixosNcm: ['8544'],
  },
  {
    id: 'eletrica_protecao',
    nome: 'Disjuntores & Proteção',
    icone: '🔌',
    corBadge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    descricao: 'Disjuntores din, dps, idr, barramentos, quadros de distribuição e eletrodutos.',
    palavrasChave: ['disjuntor', 'dps', 'idr', 'dr', 'bipolar', 'unipolar', 'tripolar', 'steck', 'schneider', 'barramento', 'quadro', 'din', 'eletroduto', 'conduite', 'caixa de luz', 'tigreflex'],
    prefixosNcm: ['8536', '8535', '8537', '8538', '3917'],
  },
  {
    id: 'iluminacao',
    nome: 'Iluminação & Lâmpadas',
    icone: '💡',
    corBadge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    descricao: 'Lâmpadas LED, painéis plafon, refletores, fitas LED, spots e luminárias.',
    palavrasChave: ['lampada', 'led', 'plafon', 'painel', 'refletor', 'spot', 'fita led', 'soquete', 'luminaria', 'arandela', 'tubular', 'pendente', 'bivolt', '6500k', '3000k', 'ourolux', 'avant'],
    prefixosNcm: ['8539', '9405'],
  },
  {
    id: 'hidraulica_conexoes',
    nome: 'Tubos & Conexões Hidráulicas',
    icone: '🚰',
    corBadge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    descricao: 'Tubos de esgoto e soldável, joelhos, luvas, tês, registros, caixas d água e sifões.',
    palavrasChave: ['tubo', 'cano', 'conexao', 'joelho', 'luva', 'te ', 'tee', 'curva', 'esgoto', 'soldavel', 'roscavel', 'tigre', 'amanco', 'krona', 'registro', 'valvula', 'sifao', 'ralo', 'caixa d', 'torneira'],
    prefixosNcm: ['3917', '8481'],
  },
  {
    id: 'tomadas_acabamentos',
    nome: 'Tomadas, Interruptores & Plugues',
    icone: '🎛️',
    corBadge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    descricao: 'Conjuntos de tomadas, interruptores, placas, espelhos, plugues e canaletas.',
    palavrasChave: ['tomada', 'interruptor', 'conjunto', 'placa', 'espelho', 'plugue', 'macho', 'femea', 'adaptador', 'canaleta', 'pial', 'tramontina', 'margirius', '10a', '20a', 'modular'],
    prefixosNcm: ['853669'],
  },
  {
    id: 'cimento_bruto',
    nome: 'Cimento, Argamassa & Alvenaria',
    icone: '🧱',
    corBadge: 'bg-stone-500/15 text-stone-400 border-stone-500/30',
    descricao: 'Cimento, argamassas colantes, rejuntes, cal, gesso e impermeabilizantes.',
    palavrasChave: ['cimento', 'argamassa', 'ac-i', 'ac-ii', 'ac-iii', 'ac1', 'ac2', 'ac3', 'rejunte', 'votoran', 'quartzolit', 'cp-ii', 'cp2', 'cal', 'gesso', 'vedacit', 'impermeabilizante', 'biancol'],
    prefixosNcm: ['2523', '3824'],
  },
  {
    id: 'ferramentas_fixacao',
    nome: 'Ferramentas & Fixação',
    icone: '🛠️',
    corBadge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    descricao: 'Parafusos, buchas, pregos, ferramentas manuais, discos de corte e fitas.',
    palavrasChave: ['ferramenta', 'furadeira', 'disco', 'corte', 'broca', 'trena', 'martelo', 'alicate', 'chave', 'parafuso', 'bucha', 'prego', 'fita isolante', 'fita veda', 'adesivo', 'silicone', 'espuma expansiva', 'abrasivo'],
    prefixosNcm: ['8201', '8202', '8203', '8204', '8205', '8207', '8467', '7318', '6804'],
  },
  {
    id: 'tintas_quimica',
    nome: 'Tintas & Químicos',
    icone: '🎨',
    corBadge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    descricao: 'Tintas látex, acrílicas, esmaltes, vernizes, solventes, trinchas e rolos.',
    palavrasChave: ['tinta', 'acrilica', 'latex', 'esmalte', 'selador', 'fundo preparador', 'verniz', 'suvinil', 'coral', 'massa corrida', 'massa acrilica', 'solvente', 'aguarras', 'trincha', 'rolo de pintura'],
    prefixosNcm: ['3208', '3209', '3210', '3214'],
  },
  {
    id: 'geral_acessorios',
    nome: 'Geral & Acessórios',
    icone: '📦',
    corBadge: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    descricao: 'Insumos gerais e miudezas de apoio à construção e manutenção.',
    palavrasChave: [],
  },
];

/**
 * Normaliza um texto removendo acentos e convertendo para minúsculas
 */
function normalizarTexto(txt: string): string {
  return (txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Classifica um produto instantaneamente via heurística de NCM e palavras-chave
 */
export function classificarProdutoPorHeuristica(produto: CatalogoProduto): string {
  const descNorm = normalizarTexto(`${produto.descricao} ${produto.codigo}`);
  const ncmLimpo = (produto.ncm || '').replace(/\D/g, '');

  // 1. Verifica NCMs específicos primeiro
  for (const nicho of NICHOS_COMERCIAIS_PADRAO) {
    if (nicho.prefixosNcm) {
      for (const prefixo of nicho.prefixosNcm) {
        if (ncmLimpo.startsWith(prefixo)) {
          // Validação secundária por palavras-chave se for um NCM genérico
          if (nicho.id === 'cabos_condutores') {
            if (descNorm.includes('cabo') || descNorm.includes('fio') || descNorm.includes('flexivel') || descNorm.includes('cordao')) {
              return nicho.nome;
            }
          } else {
            return nicho.nome;
          }
        }
      }
    }
  }

  // 2. Busca pelas palavras-chave em ordem de especificidade
  for (const nicho of NICHOS_COMERCIAIS_PADRAO) {
    if (nicho.id === 'geral_acessorios') continue;
    for (const kw of nicho.palavrasChave) {
      const kwNorm = normalizarTexto(kw);
      if (descNorm.includes(kwNorm)) {
        return nicho.nome;
      }
    }
  }

  return 'Geral & Acessórios';
}

/**
 * Executa a classificação de todo o catálogo:
 * 1. Aplica a heurística imediata em alta velocidade
 * 2. Envia os itens restantes / ambíguos para o Gemini agrupar e refinar
 */
export async function classificarCatalogoCompleto(
  produtos: CatalogoProduto[],
  onProgress?: (processados: number, total: number, categoriaAtual: string) => void
): Promise<{
  produtosAtualizados: CatalogoProduto[];
  resumoCategorias: { nome: string; count: number; valorTotal: number; icone: string; corBadge: string }[];
  totalClassificados: number;
  iaClassificados: number;
  heuristicaClassificados: number;
}> {
  if (!produtos || produtos.length === 0) {
    return {
      produtosAtualizados: [],
      resumoCategorias: [],
      totalClassificados: 0,
      iaClassificados: 0,
      heuristicaClassificados: 0,
    };
  }

  const apiKey = getStoredGeminiApiKey().trim();
  if (!apiKey || !isCerebroIAConectado()) {
    throw new Error(
      'Cérebro IA desconectado! Por favor, cadastre sua Chave de API Google Gemini nas Configurações da IA antes de usar o botão de varredura inteligente.'
    );
  }

  const atualizados: CatalogoProduto[] = [];
  const pendentesIA: { index: number; prod: CatalogoProduto }[] = [];
  let heuristicaCount = 0;
  let iaCount = 0;

  // Passo 1: Classificação heurística inicial (NCMs e palavras-chave estruturadas)
  for (let i = 0; i < produtos.length; i++) {
    const p = produtos[i];
    const catHeuristica = classificarProdutoPorHeuristica(p);

    if (catHeuristica !== 'Geral & Acessórios') {
      atualizados.push({ ...p, categoria: catHeuristica });
      heuristicaCount++;
    } else {
      atualizados.push({ ...p, categoria: 'Geral & Acessórios' });
      pendentesIA.push({ index: i, prod: p });
    }

    if (onProgress && (i % 25 === 0 || i === produtos.length - 1)) {
      onProgress(i + 1, produtos.length, `Analisando NCMs e códigos (${i + 1}/${produtos.length})...`);
    }
  }

  // Passo 2: Se houver itens pendentes/ambíguos, aciona a IA Gemini em lotes otimizados
  if (pendentesIA.length > 0) {
    const lotesTamanho = 35;
    const nomesCategorias = NICHOS_COMERCIAIS_PADRAO.map((n) => n.nome).filter((nome) => nome !== 'Geral & Acessórios');
    const totalLotes = Math.ceil(pendentesIA.length / lotesTamanho);

    for (let loteIdx = 0; loteIdx < totalLotes; loteIdx++) {
      const inicio = loteIdx * lotesTamanho;
      const lote = pendentesIA.slice(inicio, inicio + lotesTamanho);

      if (onProgress) {
        onProgress(
          Math.min(produtos.length, heuristicaCount + inicio + lote.length),
          produtos.length,
          `🤖 Google Gemini analisando lote ${loteIdx + 1}/${totalLotes} (${lote.length} itens)...`
        );
      }

      const descricoes = lote.map((it) => ({
        id: it.prod.id,
        desc: it.prod.descricao,
        ncm: it.prod.ncm,
      }));

      const prompt = `Você é um classificador especialista de produtos e materiais de construção civil para revendas e depósitos.
Classifique cada produto em EXATAMENTE UMA das seguintes categorias oficiais:
${nomesCategorias.map((c) => `- "${c}"`).join('\n')}

Se o produto realmente for miudeza ou indefinível, use "Geral & Acessórios".

PRODUTOS (JSON):
${JSON.stringify(descricoes)}

Retorne ESTRITAMENTE um JSON com esta estrutura:
{
  "classificacoes": [
    { "id": "id_do_produto", "categoria": "Nome Exato da Categoria" }
  ]
}`;

      // Tenta a chamada com a cadeia de modelos Gemini disponíveis
      let sucessoLote = false;
      for (const model of GEMINI_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
              },
            }),
          });

          if (!res.ok) continue;

          const data = await res.json();
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!raw) continue;

          const parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
          if (Array.isArray(parsed?.classificacoes)) {
            for (const c of parsed.classificacoes) {
              const alvo = lote.find((item) => item.prod.id === c.id);
              if (alvo && c.categoria && nomesCategorias.includes(c.categoria)) {
                atualizados[alvo.index].categoria = c.categoria;
                iaCount++;
              }
            }
            sucessoLote = true;
            break;
          }
        } catch (errModel) {
          console.warn(`Tentativa de classificação com ${model} falhou:`, errModel);
        }
      }

      if (!sucessoLote) {
        console.warn(`Lote ${loteIdx + 1} mantido com classificação padrão.`);
      }

      // Pequena pausa para animação suave do progresso
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }

  // Passo 3: Monta o resumo estatístico por nicho comercial
  const contagens: Record<string, { count: number; valorTotal: number }> = {};
  for (const p of atualizados) {
    const cat = p.categoria || 'Geral & Acessórios';
    if (!contagens[cat]) contagens[cat] = { count: 0, valorTotal: 0 };
    contagens[cat].count++;
    contagens[cat].valorTotal += p.precoUnitario || 0;
  }

  const resumoCategorias = NICHOS_COMERCIAIS_PADRAO.map((nicho) => {
    const dados = contagens[nicho.nome] || { count: 0, valorTotal: 0 };
    return {
      nome: nicho.nome,
      count: dados.count,
      valorTotal: Number(dados.valorTotal.toFixed(2)),
      icone: nicho.icone,
      corBadge: nicho.corBadge,
    };
  }).filter((n) => n.count > 0 || n.nome === 'Geral & Acessórios');

  return {
    produtosAtualizados: atualizados,
    resumoCategorias,
    totalClassificados: atualizados.length,
    iaClassificados: iaCount,
    heuristicaClassificados: heuristicaCount,
  };
}
