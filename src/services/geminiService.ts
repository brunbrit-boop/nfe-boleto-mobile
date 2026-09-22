import type { CatalogoProduto, OfertaGeradaResult, PedidoItemVenda } from '../utils/salesOptimizer';
import { CATALOGO_PRODUTOS_PADRAO, gerarOfertaComIA } from '../utils/salesOptimizer';

const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];

/**
 * Retorna a chave de API do Gemini salva
 */
export function getStoredGeminiApiKey(): string {
  return localStorage.getItem('gemini_api_key') || '';
}

/**
 * Salva ou remove a chave do Gemini
 */
export function setStoredGeminiApiKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem('gemini_api_key', trimmed);
  } else {
    localStorage.removeItem('gemini_api_key');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('gemini_key_updated'));
  }
}

/**
 * Testa a conexão com a API do Google Gemini
 */
export async function testarChaveGemini(
  apiKey: string
): Promise<{ success: boolean; message: string; modelUsado?: string }> {
  const key = apiKey.trim();
  if (!key) {
    return {
      success: false,
      message: 'Por favor, informe uma chave de API do Google Gemini.',
    };
  }

  // Tenta modelos conhecidos em ordem de preferência
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'Responda apenas: OK' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 10,
          },
        }),
      });

      if (response.ok) {
        return {
          success: true,
          message: `Conexão estabelecida com sucesso via Google Gemini (${model})!`,
          modelUsado: model,
        };
      }

      const errData = await response.json().catch(() => ({}));
      if (response.status === 400 || response.status === 403) {
        return {
          success: false,
          message:
            errData?.error?.message ||
            'Chave de API inválida ou sem permissão de acesso ao Gemini.',
        };
      }
    } catch (e: any) {
      // Se for erro de rede, reporta
      if (model === GEMINI_MODELS[GEMINI_MODELS.length - 1]) {
        return {
          success: false,
          message: `Falha de rede ao conectar à API do Google: ${e?.message || 'Sem conexão'}`,
        };
      }
    }
  }

  return {
    success: false,
    message: 'Não foi possível validar a chave com os modelos do Google Gemini.',
  };
}

/**
 * Gera proposta comercial inteligente utilizando Google Gemini API
 * Se a chave não estiver configurada ou falhar, recorre graciosamente ao motor local.
 */
export async function gerarOfertaComGeminiOuLocal(
  valorAlvo: number,
  margemMax: number = 0.05,
  catalogo: CatalogoProduto[] = CATALOGO_PRODUTOS_PADRAO
): Promise<OfertaGeradaResult & { motor: 'gemini' | 'local' }> {
  const apiKey = getStoredGeminiApiKey();

  // Sem chave configurada: usa motor algorítmico local
  if (!apiKey) {
    const localRes = gerarOfertaComIA(valorAlvo, margemMax, catalogo);
    return {
      ...localRes,
      motor: 'local',
      razaoExplicativa: `[Motor Local] ${localRes.razaoExplicativa} (Para respostas com raciocínio semântico, configure sua chave do Google Gemini no ícone do sistema).`,
    };
  }

  const limiteMaximo = Number((valorAlvo * (1 + margemMax)).toFixed(2));

  // Catálogo simplificado para prompt
  const catalogoResumido = catalogo.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descricao: p.descricao,
    unidade: p.unidade,
    precoUnitario: p.precoUnitario,
    ncm: p.ncm,
    categoria: p.categoria,
  }));

  const prompt = `Você é um analista sênior de vendas B2B e orçamentos comerciais de materiais de construção.
Sua missão é selecionar uma combinação ideal e inteligente de produtos do catálogo para compor um pedido de venda.

DADOS DA SOLICITAÇÃO:
- Valor Alvo Pretendido: R$ ${valorAlvo.toFixed(2)}
- Valor Máximo Permitido (com margem de até ${margemMax * 100}% a mais): R$ ${limiteMaximo.toFixed(2)}
- Regra de Valor: O valor total do pedido (soma de qtd * precoUnitario) DEVE ficar entre R$ ${valorAlvo.toFixed(2)} e R$ ${limiteMaximo.toFixed(2)}.
- Regra de Mix: Escolha itens complementares que façam sentido comercial juntos (ex: tubos com conexões, cimento com argamassa, cabos com disjuntores).
- Regra de Catálogo: Use APENAS produtos existentes no catálogo fornecido. As quantidades devem ser números inteiros maiores que zero.

CATÁLOGO DISPONÍVEL (JSON):
${JSON.stringify(catalogoResumido, null, 2)}

Retorne ESTRITAMENTE um objeto JSON válido (sem tags markdown nem texto extra) com a seguinte estrutura:
{
  "itens": [
    { "id": "prod_1", "quantidade": 10 }
  ],
  "razaoExplicativa": "Explicação concisa do mix de produtos escolhido e como o valor foi atingido com até 5% de margem."
}`;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText);
      if (!parsed?.itens || !Array.isArray(parsed.itens)) continue;

      // Mapeia os itens devolvidos pelo Gemini de volta para os produtos do catálogo
      const itensCompostos: PedidoItemVenda[] = [];
      let totalCalculado = 0;

      for (const itemGemini of parsed.itens) {
        const prod = catalogo.find((p) => p.id === itemGemini.id);
        const qtd = Math.max(1, Math.floor(Number(itemGemini.quantidade) || 1));
        if (prod) {
          const itemTotal = Number((qtd * prod.precoUnitario).toFixed(2));
          itensCompostos.push({
            id: prod.id,
            descricao: prod.descricao,
            quantidade: qtd,
            unidade: prod.unidade,
            valorUnitario: prod.precoUnitario,
            valorTotal: itemTotal,
            ncm: prod.ncm,
            cfop: prod.cfop,
            categoria: prod.categoria,
          });
          totalCalculado += itemTotal;
        }
      }

      if (itensCompostos.length > 0) {
        const totalFinal = Number(totalCalculado.toFixed(2));
        const margem = Number((((totalFinal - valorAlvo) / valorAlvo) * 100).toFixed(1));

        return {
          itens: itensCompostos,
          valorTotal: totalFinal,
          valorAlvoOriginal: valorAlvo,
          margemPercentual: margem,
          razaoExplicativa: `[Google Gemini • ${model}] ${parsed.razaoExplicativa || `Mix inteligente gerado com ${itensCompostos.length} itens.`}`,
          motor: 'gemini',
        };
      }
    } catch {
      // Tenta próximo modelo ou fallback
    }
  }

  // Fallback seguro caso a chamada falhe
  const fallback = gerarOfertaComIA(valorAlvo, margemMax, catalogo);
  return {
    ...fallback,
    motor: 'local',
    razaoExplicativa: `[Motor Local Fallback] ${fallback.razaoExplicativa}`,
  };
}
