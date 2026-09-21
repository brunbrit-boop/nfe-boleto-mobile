/**
 * Módulo de Integração com a API v3 do Bling ERP (OAuth 2.0)
 */

export const BLING_DEFAULT_CLIENT_ID = 'd07e344178ec5f63e8045571930efcf047083dd0';
export const BLING_DEFAULT_STATE = 'cb9768157cff9aef9675a82bdd68c5e4';

export interface BlingConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  isConnected: boolean;
}

export function getBlingConfig(): BlingConfig {
  const saved = localStorage.getItem('bling_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        clientId: parsed.clientId || BLING_DEFAULT_CLIENT_ID,
        clientSecret: parsed.clientSecret || localStorage.getItem('bling_client_secret') || '',
        accessToken: parsed.accessToken || localStorage.getItem('bling_access_token') || '',
        isConnected: !!(parsed.accessToken || localStorage.getItem('bling_access_token')),
      };
    } catch {}
  }
  const token = localStorage.getItem('bling_access_token') || '';
  return {
    clientId: localStorage.getItem('bling_client_id') || BLING_DEFAULT_CLIENT_ID,
    clientSecret: localStorage.getItem('bling_client_secret') || '',
    accessToken: token,
    isConnected: !!token,
  };
}

export function saveBlingConfig(config: BlingConfig): void {
  localStorage.setItem('bling_config', JSON.stringify(config));
  if (config.clientId) localStorage.setItem('bling_client_id', config.clientId);
  if (config.clientSecret) localStorage.setItem('bling_client_secret', config.clientSecret);
  if (config.accessToken) {
    localStorage.setItem('bling_access_token', config.accessToken);
  } else {
    localStorage.removeItem('bling_access_token');
  }
  if (config.refreshToken) localStorage.setItem('bling_refresh_token', config.refreshToken);
}

/**
 * Salva diretamente um Access Token manual informado pelo usuário
 */
export function setBlingAccessTokenDirect(token: string): void {
  const cleanToken = token.trim().replace(/^Bearer\s+/i, '');
  if (cleanToken) {
    localStorage.setItem('bling_access_token', cleanToken);
    const cfg = getBlingConfig();
    saveBlingConfig({ ...cfg, accessToken: cleanToken, isConnected: true });
  } else {
    localStorage.removeItem('bling_access_token');
    const cfg = getBlingConfig();
    saveBlingConfig({ ...cfg, accessToken: undefined, isConnected: false });
  }
}

/**
 * Retorna a URL de Callback/Redirecionamento para cadastrar no painel do Bling
 */
export function getBlingCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/oauth/callback`;
  }
  return 'https://nfe-boleto-mobile.vercel.app/oauth/callback';
}

/**
 * Retorna o link direto oficial de autorização do Bling
 */
export function getBlingAuthorizeUrl(clientId: string = BLING_DEFAULT_CLIENT_ID): string {
  const state = BLING_DEFAULT_STATE;
  return `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${clientId}&state=${state}`;
}

/**
 * Testa se o token de acesso do Bling é válido consultando 1 contato
 */
export async function testBlingConnection(token?: string): Promise<{ success: boolean; message: string; data?: any }> {
  const activeToken = (token || localStorage.getItem('bling_access_token') || '').trim().replace(/^Bearer\s+/i, '');
  if (!activeToken) {
    return { success: false, message: 'Nenhum token de acesso foi fornecido. Por favor, informe o Token de Acesso do Bling.' };
  }

  try {
    // Tenta via Proxy Vercel
    const proxyUrl = `/api/bling-proxy?endpoint=${encodeURIComponent('/contatos?criterio=1&limite=1')}`;
    const proxyRes = await fetch(proxyUrl, {
      headers: {
        'Authorization': `Bearer ${activeToken}`,
        'Accept': 'application/json',
      },
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return {
        success: true,
        message: 'Conexão com o Bling realizada com sucesso! Acesso aos dados confirmado.',
        data,
      };
    } else if (proxyRes.status === 401) {
      return {
        success: false,
        message: 'Token não autorizado (HTTP 401). Verifique se o Token de Acesso está correto ou se expirou.',
      };
    }
  } catch {
    // Continua para tentativa direta
  }

  // Tentativa direta com o Bling
  try {
    const directRes = await fetch('https://api.bling.com.br/Api/v3/contatos?criterio=1&limite=1', {
      headers: {
        'Authorization': `Bearer ${activeToken}`,
        'Accept': 'application/json',
      },
    });

    if (directRes.ok) {
      const data = await directRes.json();
      return {
        success: true,
        message: 'Conexão com o Bling realizada com sucesso! Acesso aos dados confirmado.',
        data,
      };
    } else {
      const errText = await directRes.text();
      return {
        success: false,
        message: `Bling retornou erro HTTP ${directRes.status}: ${errText.slice(0, 120)}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao conectar com o Bling: ${err.message || 'Verifique sua conexão ou bloqueio de CORS.'}`,
    };
  }
}

/**
 * Troca o código de autorização pelo token de acesso
 */
export async function exchangeBlingCodeForToken(
  code: string,
  clientId: string = BLING_DEFAULT_CLIENT_ID,
  clientSecret: string = ''
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    const cSec = clientSecret || localStorage.getItem('bling_client_secret') || '';
    if (!cSec) {
      return {
        success: false,
        error: 'Client Secret não configurado. Insira o Client Secret do seu aplicativo do Bling nas configurações.',
      };
    }

    // Tenta primeiro via Vercel Serverless Function (/api/bling-token) para evitar problemas de CORS
    try {
      const serverlessRes = await fetch('/api/bling-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          clientId,
          clientSecret: cSec,
          redirectUri: getBlingCallbackUrl(),
        }),
      });

      if (serverlessRes.ok) {
        const data = await serverlessRes.json();
        saveBlingConfig({
          clientId,
          clientSecret: cSec,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + (data.expires_in * 1000),
          isConnected: true,
        });
        localStorage.setItem('bling_access_token', data.access_token);
        return { success: true, accessToken: data.access_token };
      }
    } catch {
      // Fallback para chamada direta se rodando fora da Vercel
    }

    const basicAuth = btoa(`${clientId}:${cSec}`);
    const redirectUri = getBlingCallbackUrl();

    const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
        'Accept': '1.0',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      saveBlingConfig({
        clientId,
        clientSecret: cSec,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
        isConnected: true,
      });
      localStorage.setItem('bling_access_token', data.access_token);
      return { success: true, accessToken: data.access_token };
    } else {
      const err = await response.text();
      return { success: false, error: err };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha na conexão com Bling' };
  }
}
