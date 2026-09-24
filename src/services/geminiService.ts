import type { CatalogoProduto, OfertaGeradaResult, PedidoItemVenda } from '../utils/salesOptimizer';
import { CATALOGO_PRODUTOS_PADRAO } from '../utils/salesOptimizer';

export const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

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
      if (response.status === 402) {
        return {
          success: false,
          message:
            'Seus créditos pré-pagos do Google Gemini esgotaram (Erro 402: Prepayment credits depleted). Acesse https://aistudio.google.com para adicionar créditos ou crie uma chave em um projeto gratuito.',
        };
      }
      if (response.status === 400 || response.status === 403) {
        return {
          success: false,
          message:
            errData?.error?.message ||
            'Chave de API inválida ou sem permissão de acesso ao Gemini.',
        };
      }
      if (response.status === 429) {
        return {
          success: false,
          message: 'Limite de requisições excedido no Google Gemini (Quota 429). Aguarde alguns instantes.',
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
    message: 'Não foi possível validar a chave com os modelos do Google Gemini. Verifique os créditos da sua conta no Google AI Studio.',
  };
}

/**
 * Verifica se a chave de Inteligência Artificial do Google Gemini está configurada
 */
export function isCerebroIAConectado(): boolean {
  return Boolean(getStoredGeminiApiKey().trim());
}

/**
 * Gera proposta comercial inteligente utilizando Google Gemini API
 * TRAVA DE SEGURANÇA: NUNCA gera itens por matemática cega sem a IA ativa.
 */
export async function gerarOfertaComGeminiOuLocal(
  valorAlvo: number,
  margemMax: number = 0.05,
  catalogo: CatalogoProduto[] = CATALOGO_PRODUTOS_PADRAO,
  diretrizComercial?: string,
  diretrizesGeraisPersonalizadas?: string,
  diretrizesGrupoPersonalizadas?: string,
  itensMin: number = 10,
  itensMax: number = 35
): Promise<OfertaGeradaResult & { motor: 'gemini' }> {
  const apiKey = getStoredGeminiApiKey().trim();

  // TRAVA DE SEGURANÇA: Sem chave de IA configurada, JAMAIS gera orçamento
  if (!apiKey) {
    throw new Error(
      'Cérebro de Inteligência Artificial desconectado. Conecte sua chave do Google Gemini para gerar propostas comerciais inteligentes com segurança.'
    );
  }

  const limiteMaximo = Number((valorAlvo * (1 + margemMax)).toFixed(2));
  const minEfetivo = Math.max(10, Math.min(50, itensMin));
  const maxEfetivo = Math.max(minEfetivo, Math.min(50, itensMax));

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

  const diretrizesGeraisEfetivas = diretrizesGeraisPersonalizadas?.trim() || `1. QUANTIDADES HUMANIZADAS E QUEBRADAS (REGRA DE OURO):
   - NUNCA use quantidades perfeitamente redondas ou terminadas em zero (evite expressamente 10, 20, 30, 40, 50, 100).
   - Use SEMPRE quantidades comerciais quebradas e naturais, típicas de compras reais de obra (ex: 7, 13, 16, 19, 23, 27, 31, 38, 44 unidades).
2. LEI DA TRAVA DE QUANTIDADE PARA ACESSÓRIOS E ITENS BARATOS (< R$ 18,00):
   - Itens de baixo ticket (joelhos, luvas, curvas, buchas, fita veda-rosca) NUNCA podem ter quantidades absurdas. O teto máximo normal é entre 5 e 35 unidades por item.
   - É ABSOLUTAMENTE PROIBIDO usar um produto barato com centenas ou milhares de unidades apenas para "fechar" o valor financeiro do pedido!
3. BALANCEAMENTO DE ESTRUTURA COMERCIAL (50% ESTRUTURAL / 50% COMPLETAMENTE SORTIDO):
   - Aprox. metade dos pedidos pode ter base estrutural de maior valor, e a outra metade DEVE ser COMPLETAMENTE SORTIDA e multicategoria (cruzando de 3 a 5 departamentos diferentes, NUNCA monocromático).
4. CUMPRIMENTO RÍGIDO DA QUANTIDADE DE ITENS (ANTI-ACOMODAÇÃO):
   - O pedido DEVE atingir a quantidade estipulada de itens distintos (${minEfetivo} a ${maxEfetivo}). Nunca pare antes de preencher as linhas solicitadas! Fracione as quantidades unitárias para que todos os itens caibam no valor pretendido.
5. PROPORÇÃO TÉCNICA E COERÊNCIA DE COMPRA:
   - Produtos devem ter relação técnica realista e coesão prática de obra.`;

  const prompt = `Você é um diretor comercial sênior e especialista em orçamentos B2B e vendas de materiais de construção.
Sua missão é selecionar uma combinação técnica e comercialmente IMPECÁVEL de produtos do catálogo para compor um pedido de venda no valor pretendido.

DADOS DA SOLICITAÇÃO:
- Valor Alvo Pretendido: R$ ${valorAlvo.toFixed(2)}
- Valor Máximo Permitido (com margem de até ${margemMax * 100}%): R$ ${limiteMaximo.toFixed(2)}
- Margem Aceitável: O valor total do pedido (soma de qtd * precoUnitario) DEVE ficar estritamente entre R$ ${valorAlvo.toFixed(2)} e R$ ${limiteMaximo.toFixed(2)}.
- QUANTIDADE DE PRODUTOS DISTINTOS (SKUs) OBRIGATÓRIA: O pedido DEVE conter OBRIGATORIAMENTE entre ${minEfetivo} e ${maxEfetivo} itens diferentes do catálogo. NÃO se acomode em poucos produtos! Distribua o valor entre ${minEfetivo} e ${maxEfetivo} produtos distintos.
${diretrizComercial ? `- DIRETRIZ DE FOCO / NICHO COMERCIAL: "${diretrizComercial}".` : ''}

🎯 MODALIDADES DE ORÇAMENTO (SIGA CONFORME A DIRETRIZ ACIMA):
1. SE FOR NICHO ESPECÍFICO (ex: "Cabos & Condutores", "Tubos & Conexões", "Disjuntores & Proteção", "Iluminação & Lâmpadas", "Cimento & Alvenaria", "Ferramentas & Fixação", "Tintas & Químicos"):
   - Concentre pelo menos 85% a 100% do pedido em itens desta categoria/nicho e seus complementos técnicos diretos.
2. SE FOR CESTA BALANCEADA OU MIX SORTIDO:
   - OBRIGATÓRIO mesclar produtos de 3 a 5 categorias distintas (mix colorido: ex: hidráulica + elétrica + ferramentas + pintura + fixação). NUNCA concentre tudo em apenas uma categoria.
3. SE FOR MIX ROTATIVO OU ABERTO (ex: "Mix Rotativo Automático" ou Geral):
   - Varie a seleção de produtos com criatividade comercial e evite repetir sempre os mesmos itens convencionais.

🌐 DIRETRIZES GERAIS DA EMPRESA (LEIS OBRIGATÓRIAS):
${diretrizesGeraisEfetivas}

${diretrizesGrupoPersonalizadas?.trim() ? `🎯 DIRETRIZES ESPECÍFICAS DESTE GRUPO DE VENDAS:
${diretrizesGrupoPersonalizadas.trim()}
` : ''}

CATÁLOGO DISPONÍVEL (JSON):
${JSON.stringify(catalogoResumido, null, 2)}

Retorne ESTRITAMENTE um objeto JSON válido (sem blocos markdown) com a seguinte estrutura:
{
  "itens": [
    { "id": "prod_1", "quantidade": 23 }
  ],
  "razaoExplicativa": "Explicação comercial concisa de como o mix foi estruturado (itens principais + complementos) e como o valor foi atingido com até 5% de margem."
}`;

  let ultimoErroIndividual = '';

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.65,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          throw new Error('Seus créditos pré-pagos do Google Gemini esgotaram (Erro 402: Prepayment credits depleted). Acesse https://aistudio.google.com para adicionar saldo ou use uma nova chave em um projeto gratuito.');
        }
        if (response.status === 429) {
          console.warn(`[Gemini ${model}] 429 Quota/Rate Limit atingido. Aguardando pausa de 3s...`);
          await new Promise((r) => setTimeout(r, 3000));
        }
        ultimoErroIndividual = errData?.error?.message || `HTTP ${response.status} (${model})`;
        continue;
      }

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

        // Regra de Ouro: Se a quantidade for múltipla de 10 (ex: 10, 20, 30), transforma em quantidade quebrada e natural (ex: 11, 19, 23, 27, 31)
        if (qtd > 5 && qtd % 10 === 0) {
          const delta = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 3));
          qtd = Math.max(1, qtd + delta);
        }

        // Trava de segurança anti-alucinação: se o produto for < R$ 18 e o modelo mandou > 35, trava em 30
        if (prod && prod.precoUnitario < 18 && qtd > 35) {
          qtd = 27; // número quebrado natural
        }

        if (prod) {
          const itemTotal = Number((qtd * prod.precoUnitario).toFixed(2));
          itensCompostos.push({
            id: prod.id,
            codigo: prod.codigo,
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
    } catch (err: any) {
      console.warn(`Tentativa com ${model} falhou:`, err);
    }
  }

  // TRAVA DE SEGURANÇA: Se todos os modelos falharem, NUNCA recorre ao motor matemático aleatório
  throw new Error(
    ultimoErroIndividual ||
      'Não foi possível obter a resposta do Google Gemini. O orçamento foi bloqueado com segurança para evitar o envio de produtos aleatórios ao cliente. Verifique sua chave e créditos no Google AI Studio.'
  );
}

export interface ClienteLoteInput {
  clienteId: number;
  nome: string;
  valorAlvo: number;
  foco?: string;
  catalogoEspecifico?: CatalogoProduto[];
  itensMin?: number;
  itensMax?: number;
}

/**
 * Gera propostas comerciais para múltiplos clientes em UMA ÚNICA chamada de IA unificada ao Google Gemini.
 * Elimina múltiplas requisições sequenciais, reduzindo latência e evitando sobrecarga da API.
 */
export async function gerarOfertasLoteUnificadoGemini(
  clientesInput: ClienteLoteInput[],
  catalogoGeral: CatalogoProduto[] = CATALOGO_PRODUTOS_PADRAO,
  margemMax: number = 0.05,
  diretrizesGeraisPersonalizadas?: string,
  diretrizesGrupoPersonalizadas?: string,
  itensMinGeral: number = 10,
  itensMaxGeral: number = 35
): Promise<Record<number, OfertaGeradaResult & { motor: 'gemini' }>> {
  if (clientesInput.length === 0) return {};

  const apiKey = getStoredGeminiApiKey().trim();
  if (!apiKey) {
    throw new Error(
      'Cérebro de Inteligência Artificial desconectado. Conecte sua chave do Google Gemini para gerar propostas comerciais inteligentes com segurança.'
    );
  }

  // Se for apenas 1 cliente, reaproveita o fluxo individual
  if (clientesInput.length === 1) {
    const c = clientesInput[0];
    const oferta = await gerarOfertaComGeminiOuLocal(
      c.valorAlvo,
      margemMax,
      c.catalogoEspecifico || catalogoGeral,
      c.foco,
      diretrizesGeraisPersonalizadas,
      diretrizesGrupoPersonalizadas,
      c.itensMin ?? itensMinGeral,
      c.itensMax ?? itensMaxGeral
    );
    return { [c.clienteId]: oferta };
  }

  const catalogoResumido = catalogoGeral.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descricao: p.descricao,
    unidade: p.unidade,
    precoUnitario: p.precoUnitario,
    categoria: p.categoria,
  }));

  const listaClientesPrompt = clientesInput.map((c, idx) => {
    const minClamped = Math.max(10, Math.min(50, c.itensMin ?? itensMinGeral ?? 10));
    const maxClamped = Math.max(minClamped, Math.min(50, c.itensMax ?? itensMaxGeral ?? 35));
    // Alterna a meta de quantidade de itens entre os clientes de forma sortida e variada
    const range = maxClamped - minClamped;
    const fatores = [0.15, 0.95, 0.45, 1.0, 0.25, 0.75];
    const fator = range > 0 ? fatores[idx % fatores.length] : 0;
    const metaItensExata = Math.round(minClamped + fator * range);

    // Alterna 50% estrutural / 50% completamente sortido multicategoria
    const estiloProposta = idx % 2 === 0
      ? 'Estrutural (itens de maior valor como âncora + complementos)'
      : 'Completamente Sortido (mix colorido cruzando de 3 a 5 categorias diferentes, nunca monocromático)';

    return {
      clienteId: c.clienteId,
      nome: c.nome,
      valorAlvo: c.valorAlvo,
      limiteMaximo: Number((c.valorAlvo * (1 + margemMax)).toFixed(2)),
      foco: c.foco || 'Geral / Mix comercial equilibrado',
      metaExataItensDistintos: metaItensExata,
      instrucaoLinhas: `O pedido DEVE conter exatamente ou cerca de ${metaItensExata} itens diferentes (faixa ${minClamped} a ${maxClamped} itens). NÃO pare antes de preencher as ${metaItensExata} linhas!`,
      estiloComposicao: estiloProposta,
      produtosPermitidos: c.catalogoEspecifico ? c.catalogoEspecifico.map((p) => p.id) : undefined,
    };
  });

  const diretrizesGeraisEfetivas =
    diretrizesGeraisPersonalizadas?.trim() ||
    `1. QUANTIDADES HUMANIZADAS E QUEBRADAS (REGRA DE OURO):
   - NUNCA use quantidades perfeitamente redondas ou terminadas em zero (evite expressamente 10, 20, 30, 40, 50, 100).
   - Use SEMPRE quantidades comerciais quebradas e naturais, típicas de compras reais de obra (ex: 7, 13, 16, 19, 23, 27, 31, 38, 44 unidades).
2. LEI DA TRAVA DE QUANTIDADE PARA ACESSÓRIOS E ITENS BARATOS (< R$ 18,00):
   - Itens de baixo ticket (joelhos, luvas, curvas, buchas, fita veda-rosca) NUNCA podem ter quantidades absurdas. Teto entre 5 e 35 unidades por item.
   - É ABSOLUTAMENTE PROIBIDO usar um produto barato com centenas de unidades apenas para fechar o valor do pedido!
3. BALANCEAMENTO DE ESTRUTURA COMERCIAL (50% ESTRUTURAL / 50% COMPLETAMENTE SORTIDO):
   - Aprox. metade das notas deve ser estrutural (com base forte de itens principais de maior valor) e a outra metade DEVE ser COMPLETAMENTE SORTIDA e multicategoria (cruzando de 3 a 5 categorias diferentes da loja, NUNCA monocromática).
4. CUMPRIMENTO RÍGIDO DA QUANTIDADE DE ITENS (ANTI-ACOMODAÇÃO):
   - A IA DEVE cumprir a "metaExataItensDistintos" de cada cliente (ex: se a meta for 35 ou 40 itens, preencha exatamente 35 ou 40 itens diferentes!).
   - NUNCA pare em 15 ou 20 itens por ter atingido o valor financeiro: reduza as quantidades unitárias de cada produto para que todas as linhas caibam no orçamento.
5. PROPORÇÃO TÉCNICA E COERÊNCIA DE MIX:
   - Produtos estruturais e miudezas devem ter relação técnica realista e coerência prática de compra de obra.`;

  const prompt = `Você é um diretor comercial sênior e especialista em orçamentos B2B e vendas de materiais de construção.
Sua missão é gerar propostas comerciais personalizadas para uma LISTA DE CLIENTES em uma única resposta unificada.

LISTA DE CLIENTES E RESPECTIVAS METAS (JSON):
${JSON.stringify(listaClientesPrompt, null, 2)}

🌐 DIRETRIZES GERAIS DA EMPRESA (LEIS OBRIGATÓRIAS):
${diretrizesGeraisEfetivas}

${
  diretrizesGrupoPersonalizadas?.trim()
    ? `🎯 DIRETRIZES ESPECÍFICAS DESTE GRUPO DE VENDAS:
${diretrizesGrupoPersonalizadas.trim()}
`
    : ''
}

CATÁLOGO GERAL DISPONÍVEL (JSON):
${JSON.stringify(catalogoResumido, null, 2)}

INSTRUÇÕES CRÍTICAS DE RETORNO E VARIAÇÃO DE NICHOS:
- Para CADA cliente da lista, selecione uma combinação técnica de produtos.
- Se o cliente tiver "produtosPermitidos", use EXCLUSIVAMENTE IDs dessa lista para ele.
- O valor total de cada proposta deve atingir o "valorAlvo" com desvio máximo de até ${margemMax * 100}%.

🎲 CUMPRIMENTO RÍGIDO DA QUANTIDADE DE ITENS (ANTI-ACOMODAÇÃO):
- Cada cliente tem sua "metaExataItensDistintos" (ex: 12, 22, 35, 40 itens). CUMPRA rigorosamente essa quantidade de linhas para cada cliente!
- É expressamente PROIBIDO parar antes da meta de itens. Se o cliente tiver meta de 35 a 40 itens, coloque 35 a 40 itens diferentes, fracionando as quantidades unitárias (ex: 2 a 8 unidades por produto) para fechar o valor total sem estourar a margem.

🎨 ALTERNÂNCIA DE ESTILOS (50% ESTRUTURAL / 50% SORTIDO MULTICATEGORIA):
- Metade dos clientes tem estilo "Estrutural" (âncora de produtos de maior ticket + complementos).
- A outra metade tem estilo "Completamente Sortido": crie uma CESTA COLORIDA e diversificada mesclando de 3 a 5 departamentos diferentes (ex: hidráulica, elétrica, ferramentas, pintura, acabamento). NUNCA monte notas monocromáticas com produtos de um único nicho!

🎲 ROTAÇÃO AUTOMÁTICA E DIVERSIDADE ENTRE CLIENTES (REGRA SUPREMA):
- Quando os clientes tiverem foco "Mix Rotativo Automático", foco livre ou "Geral", a IA DEVE ALTERNAR os nichos comerciais entre os clientes!
  Exemplo: Se há 5 clientes, o Cliente 1 pode receber foco em Hidráulica/Tubos, o Cliente 2 em Elétrica/Cabos & Disjuntores, o Cliente 3 em Iluminação, o Cliente 4 em Cimento & Alvenaria, e o Cliente 5 em Cesta Multicategoria Balanceada.
- NUNCA monte o mesmo kit repetido ou os mesmos produtos idênticos para clientes diferentes da lista!
- SE O CLIENTE TIVER UM NICHO ESPECÍFICO (ex: "Cabos & Condutores" ou "Tubos & Conexões"): Monte o kit focado estritamente nesse nicho.
- SE O CLIENTE TIVER "Cesta Balanceada Multicategoria": Mescle obrigatoriamente produtos de 3 a 5 categorias diferentes.

- Retorne ESTRITAMENTE um objeto JSON válido (sem blocos markdown) com a seguinte estrutura exata:
{
  "propostas": [
    {
      "clienteId": 123,
      "itens": [
        { "id": "prod_1", "quantidade": 23 }
      ],
      "razaoExplicativa": "Resumo comercial objetivo do mix montado para este cliente e qual nicho foi priorizado."
    }
  ]
}`;

  let ultimoErroLote = '';

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          throw new Error('Seus créditos pré-pagos do Google Gemini esgotaram (Erro 402: Prepayment credits depleted). Acesse https://aistudio.google.com para adicionar saldo ou use uma nova chave em um projeto gratuito.');
        }
        if (response.status === 429) {
          console.warn(`[Gemini Lote ${model}] 429 Quota/Rate Limit atingido. Aguardando pausa de 3.5s...`);
          await new Promise((r) => setTimeout(r, 3500));
        }
        ultimoErroLote = errData?.error?.message || `HTTP ${response.status} (${model})`;
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (!parsed?.propostas || !Array.isArray(parsed.propostas)) continue;

      const resultadoFinal: Record<number, OfertaGeradaResult & { motor: 'gemini' }> = {};

      for (const prop of parsed.propostas) {
        const clienteId = Number(prop.clienteId);
        const clienteInput = clientesInput.find((c) => c.clienteId === clienteId);
        if (!clienteInput) continue;

        const catCliente = clienteInput.catalogoEspecifico || catalogoGeral;
        const itensCompostos: PedidoItemVenda[] = [];
        let totalCalculado = 0;

        for (const itemGemini of prop.itens || []) {
          const prod = catCliente.find((p) => p.id === itemGemini.id);
          if (!prod) continue;

          let qtd = Math.max(1, Math.floor(Number(itemGemini.quantidade) || 1));

          // Regra de quantidades humanizadas quebradas
          if (qtd > 5 && qtd % 10 === 0) {
            const delta = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 3));
            qtd = Math.max(1, qtd + delta);
          }

          // Trava de segurança para itens baratos
          if (prod.precoUnitario < 18 && qtd > 35) {
            qtd = 27;
          }

          const itemTotal = Number((qtd * prod.precoUnitario).toFixed(2));
          itensCompostos.push({
            id: prod.id,
            codigo: prod.codigo,
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

        if (itensCompostos.length > 0) {
          const totalFinal = Number(totalCalculado.toFixed(2));
          const margem = Number((((totalFinal - clienteInput.valorAlvo) / clienteInput.valorAlvo) * 100).toFixed(1));

          resultadoFinal[clienteId] = {
            itens: itensCompostos,
            valorTotal: totalFinal,
            valorAlvoOriginal: clienteInput.valorAlvo,
            margemPercentual: margem,
            razaoExplicativa: `[Google Gemini • ${model} • Lote Unificado] ${prop.razaoExplicativa || `Mix inteligente gerado com ${itensCompostos.length} itens.`}`,
            motor: 'gemini',
          };
        }
      }

      // Se atendeu pelo menos a maioria dos clientes do lote, preenche eventuais faltantes de forma segura
      if (Object.keys(resultadoFinal).length > 0) {
        for (const c of clientesInput) {
          if (!resultadoFinal[c.clienteId]) {
            try {
              const individual = await gerarOfertaComGeminiOuLocal(
                c.valorAlvo,
                margemMax,
                c.catalogoEspecifico || catalogoGeral,
                c.foco,
                diretrizesGeraisPersonalizadas,
                diretrizesGrupoPersonalizadas,
                c.itensMin ?? itensMinGeral,
                c.itensMax ?? itensMaxGeral
              );
              resultadoFinal[c.clienteId] = individual;
            } catch (errFallback) {
              console.warn(`Fallback individual para cliente ${c.clienteId} falhou:`, errFallback);
            }
          }
        }
        return resultadoFinal;
      }
    } catch (err: any) {
      console.warn(`Tentativa unificada com ${model} falhou:`, err);
    }
  }

  throw new Error(
    ultimoErroLote ||
      'Não foi possível obter a resposta unificada do Google Gemini. Verifique os créditos da sua chave no Google AI Studio e tente novamente.'
  );
}

