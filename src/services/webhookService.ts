/**
 * webhookService.ts
 * Gerenciamento e Espelhamento em Tempo Real via Webhooks do Bling API v3
 */

import {
  obterProdutosCacheLocal,
  salvarProdutosCacheLocal,
  obterClientesCacheLocal,
  salvarClientesCacheLocal,
} from './blingService';
import type { BlingCliente } from '../types';
import type { CatalogoProduto } from '../utils/salesOptimizer';

export interface BlingWebhookConfig {
  id?: number;
  url: string;
  tipo: 'produtos' | 'contatos' | 'nfe' | 'pedidos-vendas' | 'contas-receber' | string;
  situacao: number; // 1 = Ativo, 0 = Inativo
}

const BLING_API_BASE = 'https://www.bling.com.br/Api/v3';

/**
 * Consulta a lista de webhooks cadastrados no Bling para a empresa
 */
export async function listarWebhooksBling(token: string): Promise<BlingWebhookConfig[]> {
  if (!token) return [];
  try {
    const res = await fetch(`${BLING_API_BASE}/webhooks`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[Webhooks] Não foi possível listar webhooks: HTTP ${res.status}`);
      return [];
    }

    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('[Webhooks] Erro ao consultar webhooks no Bling:', err);
    return [];
  }
}

/**
 * Cadastra um novo webhook no Bling para espelhamento em tempo real
 */
export async function cadastrarWebhookBling(
  token: string,
  urlWebhook: string,
  tipo: 'produtos' | 'contatos' | 'nfe' | 'pedidos-vendas' | 'contas-receber'
): Promise<{ sucesso: boolean; id?: number; erro?: string }> {
  if (!token || !urlWebhook) {
    return { sucesso: false, erro: 'Token ou URL do Webhook ausentes.' };
  }

  try {
    const payload = {
      url: urlWebhook,
      tipo,
      situacao: 1,
    };

    const res = await fetch(`${BLING_API_BASE}/webhooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      return { sucesso: false, erro: `HTTP ${res.status}: ${errorBody}` };
    }

    const json = await res.json();
    return { sucesso: true, id: json.data?.id };
  } catch (err: any) {
    return { sucesso: false, erro: err.message || 'Falha ao registrar webhook no Bling.' };
  }
}

/**
 * Remove um webhook do Bling
 */
export async function removerWebhookBling(token: string, webhookId: number): Promise<boolean> {
  if (!token || !webhookId) return false;
  try {
    const res = await fetch(`${BLING_API_BASE}/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Processa uma notificação recebida de Webhook do Bling e atualiza os dados locais
 */
export function processarEventoWebhook(evento: any, empresaId: string): void {
  if (!evento || !empresaId) return;

  console.log(`[Webhooks] Notificação recebida do Bling para empresa ${empresaId}:`, evento);

  const topic = evento.topic || evento.tipo || '';
  const data = evento.data || evento.retorno || evento;

  if (topic.includes('produto') || evento.entity === 'produtos') {
    const produtos = obterProdutosCacheLocal(empresaId);
    if (data.id) {
      const idx = produtos.findIndex((p) => p.id === String(data.id) || (data.codigo && p.codigo === data.codigo));
      const prodAtualizado: CatalogoProduto = {
        id: String(data.id),
        codigo: data.codigo || (idx >= 0 ? produtos[idx].codigo : `PROD-${data.id}`),
        descricao: data.nome || data.descricao || (idx >= 0 ? produtos[idx].descricao : 'Produto Bling'),
        unidade: data.unidade || (idx >= 0 ? produtos[idx].unidade : 'UN'),
        precoUnitario: Number(data.preco || data.precoVenda || (idx >= 0 ? produtos[idx].precoUnitario : 0)),
        ncm: data.tributacao?.ncm || data.classificacaoFiscal || (idx >= 0 ? produtos[idx].ncm : '25232910'),
        cfop: data.tributacao?.cfop || (idx >= 0 ? produtos[idx].cfop : '5102'),
        categoria: data.categoria?.descricao || (idx >= 0 ? produtos[idx].categoria : 'Geral'),
      };

      if (idx >= 0) {
        produtos[idx] = { ...produtos[idx], ...prodAtualizado };
      } else {
        produtos.unshift(prodAtualizado);
      }
      salvarProdutosCacheLocal(empresaId, produtos);
      window.dispatchEvent(new CustomEvent('bling_sync_update', { detail: { tipo: 'produtos', empresaId } }));
    }
  } else if (topic.includes('contato') || topic.includes('cliente') || evento.entity === 'contatos') {
    const clientes = obterClientesCacheLocal(empresaId);
    if (data.id) {
      const clienteIdNum = Number(data.id);
      const idx = clientes.findIndex((c) => c.id === clienteIdNum);
      const clienteAtualizado: BlingCliente = {
        id: clienteIdNum,
        nome: data.nome || (idx >= 0 ? clientes[idx].nome : 'Cliente Bling'),
        fantasia: data.fantasia || (idx >= 0 ? clientes[idx].fantasia : undefined),
        codigo: data.codigo || (idx >= 0 ? clientes[idx].codigo : undefined),
        tipoPessoa: data.tipoPessoa === 'F' ? 'F' : 'J',
        numeroDocumento: data.numeroDocumento || (idx >= 0 ? clientes[idx].numeroDocumento : ''),
        telefone: data.telefone || (idx >= 0 ? clientes[idx].telefone : undefined),
        email: data.email || (idx >= 0 ? clientes[idx].email : undefined),
        situacao: data.situacao === 'I' ? 'I' : 'A',
      };

      if (idx >= 0) {
        clientes[idx] = { ...clientes[idx], ...clienteAtualizado };
      } else {
        clientes.unshift(clienteAtualizado);
      }
      salvarClientesCacheLocal(empresaId, clientes);
      window.dispatchEvent(new CustomEvent('bling_sync_update', { detail: { tipo: 'clientes', empresaId } }));
    }
  }
}
