/**
 * Módulo de Integração com a API v3 do Bling ERP (OAuth 2.0)
 */

export const BLING_DEFAULT_CLIENT_ID = '';
export const BLING_DEFAULT_CLIENT_SECRET = '';
export const BLING_DEFAULT_STATE = 'bling_oauth_state';

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
  if (config.expiresAt) localStorage.setItem('bling_expires_at', String(config.expiresAt));
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
): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; expiresAt?: number; error?: string }> {
  try {
    const cSec = clientSecret || localStorage.getItem('bling_client_secret') || BLING_DEFAULT_CLIENT_SECRET;
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
        const expiresAt = Date.now() + (data.expires_in * 1000);
        saveBlingConfig({
          clientId,
          clientSecret: cSec,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt,
          isConnected: true,
        });
        localStorage.setItem('bling_access_token', data.access_token);
        return { 
          success: true, 
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt,
        };
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
      const expiresAt = Date.now() + (data.expires_in * 1000);
      saveBlingConfig({
        clientId,
        clientSecret: cSec,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        isConnected: true,
      });
      localStorage.setItem('bling_access_token', data.access_token);
      return { 
        success: true, 
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
      };
    } else {
      const err = await response.text();
      return { success: false, error: err };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha na conexão com Bling' };
  }
}

/**
 * Verifica se o token está expirado ou prestes a expirar nos próximos X minutos (padrão: 15 min)
 */
export function isTokenExpirando(expiresAt?: number, margemMinutos: number = 15): boolean {
  if (!expiresAt) return false;
  const agora = Date.now();
  const margemMs = margemMinutos * 60 * 1000;
  return agora + margemMs >= expiresAt;
}

/**
 * Renova o Access Token do Bling usando o Refresh Token (30 dias)
 */
export async function renovarTokenBling(
  refreshToken: string,
  clientId: string = BLING_DEFAULT_CLIENT_ID,
  clientSecret: string = ''
): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; expiresAt?: number; error?: string }> {
  try {
    const cSec = clientSecret || localStorage.getItem('bling_client_secret') || BLING_DEFAULT_CLIENT_SECRET;
    const cId = clientId || localStorage.getItem('bling_client_id') || BLING_DEFAULT_CLIENT_ID;
    const cleanRefreshToken = (refreshToken || '').trim();

    if (!cleanRefreshToken) {
      return { success: false, error: 'Refresh token não informado.' };
    }

    // 1. Tenta via Vercel Serverless Function (/api/bling-token)
    try {
      const serverlessRes = await fetch('/api/bling-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: cleanRefreshToken,
          clientId: cId,
          clientSecret: cSec,
        }),
      });

      if (serverlessRes.ok) {
        const data = await serverlessRes.json();
        const expiresAt = Date.now() + ((data.expires_in || 21600) * 1000);
        saveBlingConfig({
          clientId: cId,
          clientSecret: cSec,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || cleanRefreshToken,
          expiresAt,
          isConnected: true,
        });
        localStorage.setItem('bling_access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('bling_refresh_token', data.refresh_token);
        }
        return {
          success: true,
          accessToken: data.access_token,
          refreshToken: data.refresh_token || cleanRefreshToken,
          expiresAt,
        };
      } else {
        const errData = await serverlessRes.json().catch(() => null);
        console.warn('Erro retornado na renovação via serverless:', errData);
      }
    } catch {
      // Fallback para chamada direta
    }

    // 2. Chamada direta ao Bling (fallback)
    const basicAuth = btoa(`${cId}:${cSec}`);
    const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
        'Accept': '1.0',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cleanRefreshToken,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const expiresAt = Date.now() + ((data.expires_in || 21600) * 1000);
      saveBlingConfig({
        clientId: cId,
        clientSecret: cSec,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || cleanRefreshToken,
        expiresAt,
        isConnected: true,
      });
      localStorage.setItem('bling_access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('bling_refresh_token', data.refresh_token);
      }
      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || cleanRefreshToken,
        expiresAt,
      };
    } else {
      const errText = await response.text();
      return { success: false, error: errText };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao renovar token com Bling' };
  }
}

