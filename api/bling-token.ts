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
    const { code, clientId, clientSecret, redirectUri } = req.body || {};

    if (!code) {
      return res.status(400).json({ error: 'Parâmetro "code" obrigatório.' });
    }

    const cId = clientId || 'd07e344178ec5f63e8045571930efcf047083dd0';
    const cSec = clientSecret || process.env.BLING_CLIENT_SECRET || '';

    const basicAuth = Buffer.from(`${cId}:${cSec}`).toString('base64');

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    if (redirectUri) {
      params.append('redirect_uri', redirectUri);
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

    let data = await response.json().catch(() => null);

    // Se falhar e tínhamos enviado redirect_uri, tenta novamente sem redirect_uri
    if (!response.ok && redirectUri) {
      const fallbackParams = new URLSearchParams();
      fallbackParams.append('grant_type', 'authorization_code');
      fallbackParams.append('code', code);

      const fallbackRes = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`,
          'Accept': '1.0',
        },
        body: fallbackParams.toString(),
      });

      const fallbackData = await fallbackRes.json().catch(() => null);
      if (fallbackRes.ok && fallbackData) {
        response = fallbackRes;
        data = fallbackData;
      }
    }

    if (!response.ok) {
      const errorMsg = data?.error_description || data?.error || data?.mensagem || 'Erro retornado pelo Bling ao trocar código';
      return res.status(response.status).json({
        error: errorMsg,
        details: data,
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
