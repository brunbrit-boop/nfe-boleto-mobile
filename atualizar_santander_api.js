/**
 * Script de Atualização em Lote via API Bling v3
 * Atribui a Conta Financeira / Forma de Pagamento "Santander"
 * para todas as Contas a Receber que estão com a coluna vazia.
 */

const https = require('https');

function fazerRequisicaoBling(endpoint, metodo = 'GET', body = null, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.bling.com.br/Api/v3${endpoint}`);
    const dataString = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: metodo,
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token.trim()}`,
        'User-Agent': 'BlingSantanderSync/1.0',
      },
    };

    if (dataString) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(dataString);
    }

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const parsed = responseBody ? JSON.parse(responseBody) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode, data: parsed });
          } else {
            resolve({ ok: false, status: res.statusCode, data: parsed, raw: responseBody });
          }
        } catch (e) {
          resolve({ ok: false, status: res.statusCode, raw: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (dataString) req.write(dataString);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function executarAtualizacaoSantander(token) {
  if (!token || !token.trim()) {
    console.error('❌ Erro: Token de acesso do Bling não informado.');
    process.exit(1);
  }

  console.log('🚀 Iniciando atualização via API Bling v3...');
  console.log('--------------------------------------------------');

  // 1. Localiza a Conta Financeira / Contábil do Santander
  console.log('🔍 Consultando contas contábeis cadastradas no Bling...');
  const resContas = await fazerRequisicaoBling('/contas-contabeis', 'GET', null, token);
  let idContaContabilSantander = null;
  let nomeContaContabil = null;

  if (resContas.ok && resContas.data?.data) {
    const lista = resContas.data.data;
    console.log(`   Total de contas contábeis encontradas: ${lista.length}`);
    const santander = lista.find((c) => (c.descricao || '').toLowerCase().includes('santander'));
    if (santander) {
      idContaContabilSantander = santander.id;
      nomeContaContabil = santander.descricao;
      console.log(`   ✅ Conta Contábil Santander localizada: ID ${idContaContabilSantander} (${nomeContaContabil})`);
    } else {
      console.log('   ⚠️ Nenhuma conta contábil com o nome "Santander" encontrada.');
      lista.forEach(c => console.log(`      - ID ${c.id}: ${c.descricao}`));
    }
  } else {
    console.warn('   ⚠️ Não foi possível listar /contas-contabeis:', resContas.status, resContas.data || resContas.raw);
  }

  // 2. Localiza a Forma de Pagamento do Santander (se existir)
  console.log('🔍 Consultando formas de pagamento ativas...');
  const resFormas = await fazerRequisicaoBling('/formas-pagamentos?situacao=1', 'GET', null, token);
  let idFormaPagamentoSantander = null;
  let nomeFormaPagamento = null;

  if (resFormas.ok && resFormas.data?.data) {
    const lista = resFormas.data.data;
    console.log(`   Total de formas de pagamento encontradas: ${lista.length}`);
    const santander = lista.find((f) => (f.descricao || '').toLowerCase().includes('santander'));
    if (santander) {
      idFormaPagamentoSantander = santander.id;
      nomeFormaPagamento = santander.descricao;
      console.log(`   ✅ Forma de Pagamento Santander localizada: ID ${idFormaPagamentoSantander} (${nomeFormaPagamento})`);
    }
  }

  if (!idContaContabilSantander && !idFormaPagamentoSantander) {
    console.error('❌ Erro: Não foi encontrado nem Conta Contábil nem Forma de Pagamento "Santander" no seu Bling.');
    console.error('   Por favor cadastre ou confira o nome em Finanças > Contas Bancárias no Bling.');
    return;
  }

  // 3. Busca todas as Contas a Receber
  console.log('\n📥 Buscando contas a receber em aberto...');
  let todasContas = [];
  let pagina = 1;

  while (pagina <= 5) {
    const resCR = await fazerRequisicaoBling(`/contas-receber?limite=100&pagina=${pagina}&situacao=1`, 'GET', null, token);
    if (!resCR.ok || !resCR.data?.data || resCR.data.data.length === 0) {
      break;
    }
    todasContas.push(...resCR.data.data);
    if (resCR.data.data.length < 100) break;
    pagina++;
  }

  console.log(`   Total de contas a receber em aberto: ${todasContas.length}`);

  // 4. Filtra apenas as que estão com a conta financeira / portador / forma vazia
  const contasVazias = todasContas.filter((c) => {
    const semContaContabil = !c.contaContabil || !c.contaContabil.id;
    const semForma = !c.formaPagamento || !c.formaPagamento.id;
    // Considera vazia se não tiver conta contábil definida
    return semContaContabil;
  });

  console.log(`   🎯 Contas com Conta Financeira vazia para preencher: ${contasVazias.length}`);

  if (contasVazias.length === 0) {
    console.log('✅ Nenhuma conta a receber pendente de preenchimento. Todas já possuem banco ou portador configurado!');
    return;
  }

  console.log('\n📝 Contas que serão atualizadas com Santander:');
  contasVazias.forEach((c, idx) => {
    console.log(`   ${idx + 1}. [ID ${c.id}] Doc: ${c.numeroDocumento || 'S/N'} | Cliente: ${c.contato?.nome} | R$ ${c.valor}`);
  });

  console.log('\n⚡ Iniciando disparo das atualizações via PUT /contas-receber/{id}...');
  console.log('--------------------------------------------------');

  let sucessos = 0;
  let erros = 0;

  for (let i = 0; i < contasVazias.length; i++) {
    const c = contasVazias[i];
    console.log(`[${i + 1}/${contasVazias.length}] Atualizando Doc ${c.numeroDocumento} (${c.contato?.nome})...`);

    // Consulta os dados completos da conta para enviar o payload perfeito
    const resGet = await fazerRequisicaoBling(`/contas-receber/${c.id}`, 'GET', null, token);
    const atual = resGet.ok ? resGet.data?.data : c;

    const payload = {
      vencimento: atual.vencimento,
      valor: atual.valor,
      historico: atual.historico,
      contato: { id: atual.contato?.id },
    };

    if (idContaContabilSantander) {
      payload.contaContabil = { id: idContaContabilSantander };
    }
    if (idFormaPagamentoSantander) {
      payload.formaPagamento = { id: idFormaPagamentoSantander };
    }

    // Delay de 400ms para respeitar taxa do Bling (3 requisições por segundo)
    await sleep(400);

    const resPut = await fazerRequisicaoBling(`/contas-receber/${c.id}`, 'PUT', payload, token);

    if (resPut.ok) {
      sucessos++;
      console.log(`   ✅ Sucesso! Conta ${c.id} atualizada com Santander.`);
    } else {
      erros++;
      console.error(`   ❌ Falha ao atualizar conta ${c.id}:`, resPut.status, JSON.stringify(resPut.data || resPut.raw));
    }
  }

  console.log('--------------------------------------------------');
  console.log(`🏁 Concluído! Sucessos: ${sucessos} | Erros: ${erros}`);
}

// Permite executar via CLI passando o token: node atualizar_santander_api.js SEU_TOKEN
const tokenCli = process.argv[2] || process.env.BLING_ACCESS_TOKEN;
if (tokenCli) {
  executarAtualizacaoSantander(tokenCli).catch(console.error);
} else {
  module.exports = { executarAtualizacaoSantander };
}
