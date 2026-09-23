// Vercel Serverless Function para troca de token OAuth do Bling sem problemas de CORS
export default async function handler(req: any, res: any) {
  // Configuração de CORS para chamadas locais ou na Vercel
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const {
      grant_type = 'authorization_code',
      code,
      refresh_token,
      clientId,
      clientSecret,
      redirectUri,
    } = req.body || {};

    const cId = clientId || '5142f9c38e36e69d55278681ac2864a053be067c';
    const cSec = clientSecret || process.env.BLING_CLIENT_SECRET || 'c34055bd8ec510dec764af628816b2c5da6ee1a69d2011e25628e1c71860';

    const basicAuth = Buffer.from(`${cId}:${cSec}`).toString('base64');
    const params = new URLSearchParams();

    if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return res.status(400).json({ error: 'Parâmetro "refresh_token" obrigatório para renovação.' });
      }
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', refresh_token);
    } else {
      if (!code) {
        return res.status(400).json({ error: 'Parâmetro "code" obrigatório para autorização inicial.' });
      }
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      // No Bling API v3, redirect_uri é opcional no POST token se já cadastrado no app.
      // Se enviado e não bater estritamente com a URL do app no Bling (ex: localhost vs vercel), causa HTTP 400.
      if (redirectUri && !redirectUri.includes('localhost')) {
        params.append('redirect_uri', redirectUri);
      }
    }

    let response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
        'Accept': '1.0',
      },
      body: params.toString(),
    });

    let data: any = await response.json().catch(() => null);

    if (!response.ok) {
      const errObj: any = data || {};
      let errorMsg = errObj?.error_description || errObj?.error?.message || errObj?.error || errObj?.mensagem;
      if (typeof errorMsg !== 'string') {
        errorMsg = errObj?.error?.description || 'Erro retornado pelo Bling ao processar token';
      }

      // Tratamento amigável para mensagens comuns do Bling
      if (errObj?.error === 'invalid_grant' || String(errorMsg).includes('invalid_grant')) {
        errorMsg = 'Código de autorização inválido ou expirado. Dica: Se você possui mais de uma conta no Bling, certifique-se de estar conectado no Bling com a conta correspondente ao Client ID desta empresa.';
      } else if (errObj?.error === 'invalid_client' || String(errorMsg).includes('invalid_client')) {
        errorMsg = 'Client ID ou Client Secret incorretos no cadastro do aplicativo Bling desta empresa.';
      }

      return res.status(response.status).json({
        error: errorMsg,
        details: data,
        statusBling: response.status,
      });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Erro interno ao processar OAuth com Bling',
      message: error.message,
    });
  }
}
