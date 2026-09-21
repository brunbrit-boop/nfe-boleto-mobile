// Vercel Serverless Function para receber Webhooks do Bling ERP
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Bling às vezes faz um teste GET para verificar se o servidor está ativo
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      message: 'Servidor Webhook Bling ativo e pronto para receber eventos!',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body;
      console.log('Webhook recebido do Bling:', JSON.stringify(payload));

      // Bling envia notificações de contatos, contas a pagar, contas a receber ou notas fiscais
      return res.status(200).json({
        received: true,
        event: payload?.topic || payload?.evento || 'general',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        error: 'Erro ao processar webhook',
        message: error.message,
      });
    }
  }

  return res.status(200).json({ status: 'ok' });
}
