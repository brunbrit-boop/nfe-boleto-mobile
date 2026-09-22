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
  catalogo: CatalogoProduto[] = CATALOGO_PRODUTOS_PADRAO,
  diretrizComercial?: string
): Promise<OfertaGeradaResult & { motor: 'gemini' | 'local' }> {
  const apiKey = getStoredGeminiApiKey();

  // Sem chave configurada: usa motor algorítmico local
  if (!apiKey) {
    const localRes = gerarOfertaComIA(valorAlvo, margemMax, catalogo, diretrizComercial);
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

  const prompt = `Você é um diretor comercial sênior e especialista em orçamentos B2B e vendas de materiais de construção.
Sua missão é selecionar uma combinação técnica e comercialmente IMPECÁVEL de produtos do catálogo para compor um pedido de venda no valor pretendido.

DADOS DA SOLICITAÇÃO:
- Valor Alvo Pretendido: R$ ${valorAlvo.toFixed(2)}
- Valor Máximo Permitido (com margem de até ${margemMax * 100}%): R$ ${limiteMaximo.toFixed(2)}
- Margem Aceitável: O valor total do pedido (soma de qtd * precoUnitario) DEVE ficar estritamente entre R$ ${valorAlvo.toFixed(2)} e R$ ${limiteMaximo.toFixed(2)}.
${diretrizComercial ? `- FOCO / DIRETRIZ COMERCIAL SOLICITADA: "${diretrizComercial}". Priorize fortemente itens e complementos desta linha!` : '- DIRETRIZ COMERCIAL: Monte um mix balanceado e coerente para obra/reforma.'}

⚠️ 4 LEIS COMERCIAIS OBRIGATÓRIAS (VIOLAÇÃO GERA PROPOSTA INVÁLIDA):
1. LEI DO MIX LÓGICO E PROPORÇÃO REAL DE CONSUMO:
   - Produtos estruturais e miudezas devem ter relação técnica realista.
   - Exemplo: Se cotar Tubos de PVC (6m), inclua no máximo 2 a 4 conexões/joelhos por barra de tubo. NUNCA crie pedidos com dezenas de tubos e milhares de joelhos!
   - Se cotar cimento, inclua argamassa/areia em proporções de canteiro de obras real.
2. LEI DA TRAVA DE QUANTIDADE PARA ACESSÓRIOS E ITENS BARATOS (< R$ 18,00):
   - Itens de baixo ticket (joelhos, luvas, curvas, buchas, fita veda-rosca) NUNCA podem ter quantidades absurdas. O teto máximo normal é entre 5 e 30 unidades por item.
   - É ABSOLUTAMENTE PROIBIDO usar um produto barato com centenas ou milhares de unidades apenas para "fechar" o valor financeiro do pedido!
3. LEI DE PARETO (80/20 DO VALOR DA VENDA):
   - Pelo menos 75% a 85% do valor total do pedido DEVE ser construído pelos itens estruturais ou de maior valor unitário (ex: tubulações em barras, rolos de cabos, sacos de cimento, disjuntores).
   - Os itens baratos servem exclusivamente como complementos funcionais do kit.
4. LEI DOS LOTES COMERCIAIS REAIS:
   - Use quantidades comerciais usuais em depósitos e construtoras (ex: 5, 10, 20, 25, 50, 100).
   - Use APENAS produtos existentes no catálogo fornecido. As quantidades devem ser inteiros > 0.

CATÁLOGO DISPONÍVEL (JSON):
${JSON.stringify(catalogoResumido, null, 2)}

Retorne ESTRITAMENTE um objeto JSON válido (sem blocos markdown) com a seguinte estrutura:
{
  "itens": [
    { "id": "prod_1", "quantidade": 10 }
  ],
  "razaoExplicativa": "Explicação comercial concisa de como o mix foi estruturado (itens principais + complementos) e como o valor foi atingido com até 5% de margem."
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
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      // Limpa eventuais marcações markdown se o modelo tiver retornado
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (!parsed?.itens || !Array.isArray(parsed.itens)) continue;

      // Mapeia e sanitiza os itens devolvidos pelo Gemini
      const itensCompostos: PedidoItemVenda[] = [];
      let totalCalculado = 0;

      for (const itemGemini of parsed.itens) {
        const prod = catalogo.find((p) => p.id === itemGemini.id);
        let qtd = Math.max(1, Math.floor(Number(itemGemini.quantidade) || 1));

        // Trava de segurança anti-alucinação: se o produto for < R$ 18 e o modelo mandou > 35, trava em 30
        if (prod && prod.precoUnitario < 18 && qtd > 35) {
          qtd = 30;
        }

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
  const fallback = gerarOfertaComIA(valorAlvo, margemMax, catalogo, diretrizComercial);
  return {
    ...fallback,
    motor: 'local',
    razaoExplicativa: `[Motor Local Fallback] ${fallback.razaoExplicativa}`,
  };
}
