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
      };
    } catch {}
  }
  return {
    clientId: localStorage.getItem('bling_client_id') || BLING_DEFAULT_CLIENT_ID,
    clientSecret: localStorage.getItem('bling_client_secret') || '',
    isConnected: !!localStorage.getItem('bling_access_token'),
  };
}

export function saveBlingConfig(config: BlingConfig): void {
  localStorage.setItem('bling_config', JSON.stringify(config));
  if (config.clientId) localStorage.setItem('bling_client_id', config.clientId);
  if (config.clientSecret) localStorage.setItem('bling_client_secret', config.clientSecret);
  if (config.accessToken) localStorage.setItem('bling_access_token', config.accessToken);
  if (config.refreshToken) localStorage.setItem('bling_refresh_token', config.refreshToken);
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
 * Troca o código de autorização pelo token de acesso
 */
export async function exchangeBlingCodeForToken(
  code: string,
  clientId: string = BLING_DEFAULT_CLIENT_ID,
  clientSecret: string = ''
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    // Tenta primeiro via Vercel Serverless Function (/api/bling-token) para evitar problemas de CORS
    try {
      const serverlessRes = await fetch('/api/bling-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          clientId,
          clientSecret,
          redirectUri: getBlingCallbackUrl(),
        }),
      });

      if (serverlessRes.ok) {
        const data = await serverlessRes.json();
        saveBlingConfig({
          clientId,
          clientSecret,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + (data.expires_in * 1000),
          isConnected: true,
        });
        return { success: true, accessToken: data.access_token };
      }
    } catch {
      // Fallback para chamada direta se rodando fora da Vercel
    }

    const basicAuth = btoa(`${clientId}:${clientSecret}`);
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
        clientSecret,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
        isConnected: true,
      });
      return { success: true, accessToken: data.access_token };
    } else {
      const err = await response.text();
      return { success: false, error: err };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha na conexão com Bling' };
  }
}
