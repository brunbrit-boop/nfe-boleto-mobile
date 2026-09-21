// Vercel Serverless Function Proxy para consultas à API v3 do Bling sem bloqueio de CORS
export default async function handler(req: any, res: any) {
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

  const { endpoint } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: 'Parâmetro "endpoint" obrigatório (ex: /contatos, /contas/pagar, /contas/receber).' });
  }

  // Extrai o token Bearer enviado pelo frontend ou pelo header
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Token de autorização Bearer não informado.' });
  }

  try {
    const cleanEndpoint = Array.isArray(endpoint) ? endpoint[0] : endpoint;
    const url = `https://www.bling.com.br/Api/v3${cleanEndpoint.startsWith('/') ? cleanEndpoint : '/' + cleanEndpoint}`;

    const blingRes = await fetch(url, {
      method: req.method,
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await blingRes.json();
    return res.status(blingRes.status).json(data);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Erro no proxy Bling',
      message: error.message,
    });
  }
}
