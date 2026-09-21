/**
 * Módulo de Integração com a API v3 do Bling ERP (OAuth 2.0)
 */

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
      return JSON.parse(saved);
    } catch {}
  }
  return {
    clientId: '',
    clientSecret: '',
    isConnected: false,
  };
}

export function saveBlingConfig(config: BlingConfig): void {
  localStorage.setItem('bling_config', JSON.stringify(config));
}

/**
 * Retorna a URL de Callback/Redirecionamento para cadastrar no painel do Bling
 */
export function getBlingCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/oauth/callback`;
  }
  return 'https://seu-app.vercel.app/oauth/callback';
}

/**
 * Gera a URL oficial de autorização OAuth do Bling API v3
 */
export function getBlingAuthorizeUrl(clientId: string): string {
  const redirectUri = encodeURIComponent(getBlingCallbackUrl());
  const state = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('bling_oauth_state', state);
  
  return `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${clientId}&state=${state}&redirect_uri=${redirectUri}`;
}

/**
 * Troca o código de autorização pelo token de acesso
 */
export async function exchangeBlingCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const redirectUri = getBlingCallbackUrl();

    // Na arquitetura de produção, essa chamada é feita via Edge Function / Serverless para proteger o clientSecret
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
