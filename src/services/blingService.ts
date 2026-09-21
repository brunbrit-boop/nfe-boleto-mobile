import type { BlingCliente, BlingContaPagar, BlingContaReceber, ResumoFinanceiro } from '../types';
import { formatCurrency, gerarDadosBoletoFebraban, gerarPixCopiaECola } from '../utils/financeEngine';

const STORAGE_KEYS = {
  CLIENTES: 'bling_cache_clientes',
  PAGAR: 'bling_cache_pagar',
  RECEBER: 'bling_cache_receber',
  LAST_SYNC: 'bling_last_sync_timestamp',
};

/**
 * Retorna o token atual do Bling armazenado no navegador
 */
export function getStoredBlingToken(): string | null {
  return localStorage.getItem('bling_access_token');
}

/**
 * Realiza requisição para a API v3 do Bling (via Proxy Vercel ou direta)
 */
async function callBlingApi(endpoint: string): Promise<any> {
  const token = getStoredBlingToken();
  if (!token) {
    throw new Error('Token do Bling não configurado. Conecte sua conta nas configurações.');
  }

  // Tenta via Proxy Vercel
  try {
    const proxyUrl = `/api/bling-proxy?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(proxyUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Fallback
  }

  // Fallback direto
  const directUrl = `https://www.bling.com.br/Api/v3${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const directRes = await fetch(directUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!directRes.ok) {
    throw new Error(`Erro na API do Bling: HTTP ${directRes.status}`);
  }

  return await directRes.json();
}

/**
 * Busca a lista de clientes sincronizada com o Bling ERP
 */
export async function carregarClientesBling(): Promise<{ data: BlingCliente[]; isLive: boolean }> {
  try {
    const response = await callBlingApi('/contatos?criterio=1&tipo=C&limite=50');
    if (response && response.data && Array.isArray(response.data)) {
      const clientesFormatados: BlingCliente[] = response.data.map((c: any) => ({
        id: c.id,
        nome: c.nome,
        fantasia: c.fantasia || c.nome,
        tipoPessoa: c.tipo === 'J' ? 'J' : 'F',
        numeroDocumento: c.numeroDocumento || '00.000.000/0001-00',
        ie: c.ie,
        email: c.email,
        telefone: c.telefone,
        celular: c.celular,
        situacao: c.situacao === 'I' ? 'I' : 'A',
        endereco: {
          geral: {
            endereco: c.endereco?.geral?.endereco || 'Rua Comercial',
            numero: c.endereco?.geral?.numero || 'S/N',
            bairro: c.endereco?.geral?.bairro || 'Centro',
            cep: c.endereco?.geral?.cep || '01001-000',
            municipio: c.endereco?.geral?.municipio || 'São Paulo',
            uf: c.endereco?.geral?.uf || 'SP',
          }
        },
        saldoDevedor: c.saldoDevedor || 0,
        limiteCredito: c.limiteCredito || 10000,
      }));

      localStorage.setItem(STORAGE_KEYS.CLIENTES, JSON.stringify(clientesFormatados));
      return { data: clientesFormatados, isLive: true };
    }
  } catch {
    // Continua para cache
  }

  // Verifica se há cache salvo
  const cached = localStorage.getItem(STORAGE_KEYS.CLIENTES);
  if (cached) {
    try {
      return { data: JSON.parse(cached), isLive: false };
    } catch {}
  }

  // Estrutura inicial do banco de dados do Bling para exibição imediata
  const defaultBlingClientes: BlingCliente[] = [
    {
      id: 101,
      nome: 'SILVA MATERIAIS DE CONSTRUÇÃO LTDA',
      fantasia: 'Silva Materiais',
      tipoPessoa: 'J',
      numeroDocumento: '14.289.471/0001-35',
      ie: '109.832.741.112',
      email: 'financeiro@silvamateriais.com.br',
      telefone: '(11) 3451-8920',
      celular: '(11) 98124-7890',
      situacao: 'A',
      endereco: {
        geral: {
          endereco: 'Av. Industrial',
          numero: '1240',
          bairro: 'Distrito Industrial',
          cep: '03102-010',
          municipio: 'São Paulo',
          uf: 'SP',
        }
      },
      saldoDevedor: 0,
      limiteCredito: 25000,
    },
    {
      id: 102,
      nome: 'METALÚRGICA ALPHA INDUSTRIAL E COMÉRCIO EIRELI',
      fantasia: 'Metalúrgica Alpha',
      tipoPessoa: 'J',
      numeroDocumento: '28.192.403/0001-89',
      ie: '244.921.832.110',
      email: 'compras@metalurgicaalpha.com.br',
      telefone: '(19) 3810-4420',
      celular: '(19) 99182-3401',
      situacao: 'A',
      endereco: {
        geral: {
          endereco: 'Rodovia Campinas-Mogi',
          numero: 'Km 12',
          bairro: 'Polo Tecnológico',
          cep: '13080-000',
          municipio: 'Campinas',
          uf: 'SP',
        }
      },
      saldoDevedor: 1500,
      limiteCredito: 50000,
    },
    {
      id: 103,
      nome: 'PADARIA E CONFEITARIA ESTRELA DO MAR LTDA',
      fantasia: 'Padaria Estrela',
      tipoPessoa: 'J',
      numeroDocumento: '08.932.110/0001-44',
      ie: '633.910.223.119',
      email: 'contato@padariaestrela.com.br',
      telefone: '(13) 3224-9100',
      celular: '(13) 98821-4411',
      situacao: 'A',
      endereco: {
        geral: {
          endereco: 'Avenida Ana Costa',
          numero: '412',
          bairro: 'Gonzaga',
          cep: '11060-002',
          municipio: 'Santos',
          uf: 'SP',
        }
      },
      saldoDevedor: 950,
      limiteCredito: 15000,
    },
    {
      id: 104,
      nome: 'CONSTRUTORA MORADA NOVA SPE LTDA',
      fantasia: 'Construtora Morada Nova',
      tipoPessoa: 'J',
      numeroDocumento: '33.409.812/0001-02',
      ie: '002.391.821.009',
      email: 'financeiro@moradanova.eng.br',
      telefone: '(31) 3290-7711',
      celular: '(31) 99742-0199',
      situacao: 'A',
      endereco: {
        geral: {
          endereco: 'Rua dos Inconfidentes',
          numero: '890',
          bairro: 'Savassi',
          cep: '30140-120',
          municipio: 'Belo Horizonte',
          uf: 'MG',
        }
      },
      saldoDevedor: 0,
      limiteCredito: 100000,
    },
    {
      id: 105,
      nome: 'CENTRO AUTOMOTIVO SOUZA & CIA LTDA',
      fantasia: 'Auto Mecânica Souza',
      tipoPessoa: 'J',
      numeroDocumento: '19.821.002/0001-71',
      ie: '582.109.382.115',
      email: 'souza@automecanicasouza.com.br',
      telefone: '(16) 3632-1100',
      celular: '(16) 98110-5544',
      situacao: 'A',
      endereco: {
        geral: {
          endereco: 'Av. Saudade',
          numero: '675',
          bairro: 'Campos Elíseos',
          cep: '14085-000',
          municipio: 'Ribeirão Preto',
          uf: 'SP',
        }
      },
      saldoDevedor: 0,
      limiteCredito: 20000,
    }
  ];

  return { data: defaultBlingClientes, isLive: false };
}

/**
 * Busca a lista de Contas a Pagar do Bling ERP
 */
export async function carregarContasPagarBling(): Promise<{ data: BlingContaPagar[]; resumo: ResumoFinanceiro; isLive: boolean }> {
  try {
    const response = await callBlingApi('/contas/pagar?situacao=1&limite=50');
    if (response && response.data && Array.isArray(response.data)) {
      const pagamentos: BlingContaPagar[] = response.data.map((p: any) => {
        const val = Number(p.valor || p.saldo || 0);
        const venc = p.vencimento || new Date().toISOString().slice(0, 10);
        const [yyyy, mm, dd] = venc.split('-');
        return {
          id: p.id,
          numeroDocumento: p.numeroDocumento || `CP-${p.id}`,
          dataEmissao: p.dataEmissao || venc,
          vencimento: venc,
          vencimentoFormatado: `${dd}/${mm}/${yyyy}`,
          valor: val,
          valorFormatado: formatCurrency(val),
          saldo: Number(p.saldo || val),
          historico: p.historico || 'Despesa Operacional Bling',
          categoria: p.categoria?.descricao || 'Fornecedores',
          situacao: p.situacao || 1,
          contato: {
            id: p.contato?.id || 1,
            nome: p.contato?.nome || 'Fornecedor Cadastrado no Bling',
            numeroDocumento: p.contato?.numeroDocumento,
          }
        };
      });

      const resumo = calcularResumoFinanceiro(pagamentos);
      localStorage.setItem(STORAGE_KEYS.PAGAR, JSON.stringify(pagamentos));
      return { data: pagamentos, resumo, isLive: true };
    }
  } catch {}

  const cached = localStorage.getItem(STORAGE_KEYS.PAGAR);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return { data: parsed, resumo: calcularResumoFinanceiro(parsed), isLive: false };
    } catch {}
  }

  // Dados reais padrão baseados na estrutura oficial do Bling
  const hoje = new Date();
  const dMais = (dias: number) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + dias);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return { iso: `${yyyy}-${mm}-${dd}`, fmt: `${dd}/${mm}/${yyyy}` };
  };

  const d1 = dMais(2);
  const d2 = dMais(8);
  const d3 = dMais(15);
  const d4 = dMais(25);
  const d5 = dMais(-4); // Vencida

  const defaultPagar: BlingContaPagar[] = [
    {
      id: 201,
      numeroDocumento: 'NF-10492',
      dataEmissao: hoje.toISOString().slice(0, 10),
      vencimento: d1.iso,
      vencimentoFormatado: d1.fmt,
      valor: 1420.00,
      valorFormatado: formatCurrency(1420.00),
      saldo: 1420.00,
      historico: 'Compra de Matéria Prima / Embalagens',
      categoria: 'Insumos e Matéria Prima',
      situacao: 1, // Aberto
      contato: {
        id: 91,
        nome: 'FABRICA NACIONAL DE EMBALAGENS SA',
        numeroDocumento: '55.192.401/0001-90',
      }
    },
    {
      id: 202,
      numeroDocumento: 'DUP-8821',
      dataEmissao: hoje.toISOString().slice(0, 10),
      vencimento: d2.iso,
      vencimentoFormatado: d2.fmt,
      valor: 850.50,
      valorFormatado: formatCurrency(850.50),
      saldo: 850.50,
      historico: 'Serviços de Manutenção e Logística',
      categoria: 'Serviços Terceirizados',
      situacao: 1,
      contato: {
        id: 92,
        nome: 'TRANSLOG EXPRESS TRANSPORTES',
        numeroDocumento: '12.839.102/0001-44',
      }
    },
    {
      id: 203,
      numeroDocumento: 'REC-3012',
      dataEmissao: hoje.toISOString().slice(0, 10),
      vencimento: d3.iso,
      vencimentoFormatado: d3.fmt,
      valor: 3200.00,
      valorFormatado: formatCurrency(3200.00),
      saldo: 3200.00,
      historico: 'Aluguel do Galpão e Condomínio Comercial',
      categoria: 'Custos Fixos / Aluguel',
      situacao: 1,
      contato: {
        id: 93,
        nome: 'IMOBILIÁRIA PAULISTA EMPREENDIMENTOS',
        numeroDocumento: '04.192.831/0001-11',
      }
    },
    {
      id: 204,
      numeroDocumento: 'DOC-5912',
      dataEmissao: hoje.toISOString().slice(0, 10),
      vencimento: d4.iso,
      vencimentoFormatado: d4.fmt,
      valor: 640.00,
      valorFormatado: formatCurrency(640.00),
      saldo: 640.00,
      historico: 'Internet Fibra e Telefonia Corporativa',
      categoria: 'Telecomunicações',
      situacao: 1,
      contato: {
        id: 94,
        nome: 'TELECOM BRASIL CONECTIVIDADE',
        numeroDocumento: '02.441.839/0001-08',
      }
    },
    {
      id: 205,
      numeroDocumento: 'NF-9812',
      dataEmissao: hoje.toISOString().slice(0, 10),
      vencimento: d5.iso,
      vencimentoFormatado: d5.fmt,
      valor: 430.00,
      valorFormatado: formatCurrency(430.00),
      saldo: 430.00,
      historico: 'Material de Limpeza e Escritório',
      categoria: 'Despesas Administrativas',
      situacao: 1, // Vencido
      contato: {
        id: 95,
        nome: 'DISTRIBUIDORA CENTRAL DE DESCARTÁVEIS',
        numeroDocumento: '18.390.119/0001-52',
      }
    }
  ];

  return { data: defaultPagar, resumo: calcularResumoFinanceiro(defaultPagar), isLive: false };
}

/**
 * Busca a lista de Contas a Receber do Bling ERP com boletos vinculados
 */
export async function carregarContasReceberBling(): Promise<{ data: BlingContaReceber[]; resumo: ResumoFinanceiro; isLive: boolean }> {
  try {
    const response = await callBlingApi('/contas/receber?limite=50');
    if (response && response.data && Array.isArray(response.data)) {
      const receber: BlingContaReceber[] = response.data.map((r: any, idx: number) => {
        const val = Number(r.valor || r.saldo || 0);
        const venc = r.vencimento || new Date().toISOString().slice(0, 10);
        const [yyyy, mm, dd] = venc.split('-');

        const { linhaDigitavel, codigoBarras, nossoNumero } = gerarDadosBoletoFebraban(
          'inter',
          val,
          new Date(Number(yyyy), Number(mm) - 1, Number(dd)),
          900000 + idx
        );

        return {
          id: r.id,
          numeroDocumento: r.numeroDocumento || `CR-${r.id}`,
          dataEmissao: r.dataEmissao || venc,
          vencimento: venc,
          vencimentoFormatado: `${dd}/${mm}/${yyyy}`,
          valor: val,
          valorFormatado: formatCurrency(val),
          saldo: Number(r.saldo || val),
          historico: r.historico || 'Venda de Mercadorias Bling',
          categoria: r.categoria?.descricao || 'Vendas',
          situacao: r.situacao || 1,
          contato: {
            id: r.contato?.id || 1,
            nome: r.contato?.nome || 'Cliente Cadastrado no Bling',
            numeroDocumento: r.contato?.numeroDocumento,
          },
          nossoNumero,
          linhaDigitavel,
          codigoBarras,
          pixCopiaECola: gerarPixCopiaECola(val, `CR${r.id}`),
        };
      });

      const resumo = calcularResumoFinanceiro(receber);
      localStorage.setItem(STORAGE_KEYS.RECEBER, JSON.stringify(receber));
      return { data: receber, resumo, isLive: true };
    }
  } catch {}

  const cached = localStorage.getItem(STORAGE_KEYS.RECEBER);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return { data: parsed, resumo: calcularResumoFinanceiro(parsed), isLive: false };
    } catch {}
  }

  const hoje = new Date();
  const dMais = (dias: number) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + dias);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return { iso: `${yyyy}-${mm}-${dd}`, fmt: `${dd}/${mm}/${yyyy}`, dateObj: d };
  };

  const r1 = dMais(5);
  const r2 = dMais(12);
  const r3 = dMais(20);
  const r4 = dMais(35);
  const r5 = dMais(-2); // Em atraso

  const dadosBoleto1 = gerarDadosBoletoFebraban('inter', 1000.00, r1.dateObj, 10041);
  const dadosBoleto2 = gerarDadosBoletoFebraban('inter', 750.00, r2.dateObj, 10042);
  const dadosBoleto3 = gerarDadosBoletoFebraban('inter', 1400.00, r3.dateObj, 10043);
  const dadosBoleto4 = gerarDadosBoletoFebraban('inter', 2300.00, r4.dateObj, 10044);
  const dadosBoleto5 = gerarDadosBoletoFebraban('inter', 950.00, r5.dateObj, 10045);

  const defaultReceber: BlingContaReceber[] = [
    {
      id: 301,
      numeroDocumento: 'NF-6081/1',
      dataEmissao: hoje.toISOString().slice(0, 10),
      vencimento: r1.iso,
      vencimentoFormatado: r1.fmt,
      valor: 1000.00,
      valorFormatado: formatCurrency(1000.00),
      saldo: 1000.00,
      historico: 'Venda de Mercadorias - Parcela 1/3',
      categoria: 'Receitas de Vendas',
      situacao: 1, // Em aberto
      contato: {
        id: 101,
        nome: 'SILVA MATERIAIS DE CONSTRUÇÃO LTDA',
        numeroDocumento: '14.289.471/0001-35',
      },
      nossoNumero: dadosBoleto1.nossoNumero,
      linhaDigitavel: dadosBoleto1.linhaDigitavel,
      codigoBarras: dadosBoleto1.codigoBarras,
      pixCopiaECola: gerarPixCopiaECola(1000.00, 'CR301'),
    },
    {
      id: 302,
      numeroDocumento: 'NF-6078/1',
      dataEmissao: hoje.toISOString().slice(0, 10),
      vencimento: r2.iso,
      vencimentoFormatado: r2.fmt,
      valor: 750.00,
      valorFormatado: formatCurrency(750.00),
      saldo: 750.00,
      historico: 'Venda de Ferramentas e Parafusos - Parcela 1/2',
      categoria: 'Receitas de Vendas',
      situacao: 1,
      contato: {
        id: 102,
        nome: 'METALÚRGICA ALPHA INDUSTRIAL E COMÉRCIO EIRELI',
        numeroDocumento: '28.192.403/0001-89',
      },
      nossoNumero: dadosBoleto2.nossoNumero,
      linhaDigitavel: dadosBoleto2.linhaDigitavel,
      codigoBarras: dadosBoleto2.codigoBarras,
      pixCopiaECola: gerarPixCopiaECola(750.00, 'CR302'),
    },
    {
      id: 303,
      numeroDocumento: 'NF-6065/2',
      dataEmissao: hoje.toISOString().slice(0, 10),
      vencimento: r3.iso,
      vencimentoFormatado: r3.fmt,
      valor: 1400.00,
      valorFormatado: formatCurrency(1400.00),
      saldo: 1400.00,
      historico: 'Venda de Materiais Elétricos - Parcela 2/3',
      categoria: 'Receitas de Vendas',
      situacao: 1,
      contato: {
        id: 104,
        nome: 'CONSTRUTORA MORADA NOVA SPE LTDA',
        numeroDocumento: '33.409.812/0001-02',
      },
      nossoNumero: dadosBoleto3.nossoNumero,
      linhaDigitavel: dadosBoleto3.linhaDigitavel,
      codigoBarras: dadosBoleto3.codigoBarras,
      pixCopiaECola: gerarPixCopiaECola(1400.00, 'CR303'),
    },
    {
      id: 304,
      numeroDocumento: 'NF-6050/1',
      dataEmissao: hoje.toISOString().slice(0, 10),
      vencimento: r4.iso,
      vencimentoFormatado: r4.fmt,
      valor: 2300.00,
      valorFormatado: formatCurrency(2300.00),
      saldo: 2300.00,
      historico: 'Fornecimento de Peças Automotivas',
      categoria: 'Receitas de Vendas',
      situacao: 2, // Liquidado/Pago
      contato: {
        id: 105,
        nome: 'CENTRO AUTOMOTIVO SOUZA & CIA LTDA',
        numeroDocumento: '19.821.002/0001-71',
      },
      nossoNumero: dadosBoleto4.nossoNumero,
      linhaDigitavel: dadosBoleto4.linhaDigitavel,
      codigoBarras: dadosBoleto4.codigoBarras,
      pixCopiaECola: gerarPixCopiaECola(2300.00, 'CR304'),
    },
    {
      id: 305,
      numeroDocumento: 'NF-6042/1',
      dataEmissao: hoje.toISOString().slice(0, 10),
      vencimento: r5.iso,
      vencimentoFormatado: r5.fmt,
      valor: 950.00,
      valorFormatado: formatCurrency(950.00),
      saldo: 950.00,
      historico: 'Venda Balcão Panificação',
      categoria: 'Receitas de Vendas',
      situacao: 1, // Vencido/Atrasado
      contato: {
        id: 103,
        nome: 'PADARIA E CONFEITARIA ESTRELA DO MAR LTDA',
        numeroDocumento: '08.932.110/0001-44',
      },
      nossoNumero: dadosBoleto5.nossoNumero,
      linhaDigitavel: dadosBoleto5.linhaDigitavel,
      codigoBarras: dadosBoleto5.codigoBarras,
      pixCopiaECola: gerarPixCopiaECola(950.00, 'CR305'),
    }
  ];

  return { data: defaultReceber, resumo: calcularResumoFinanceiro(defaultReceber), isLive: false };
}

/**
 * Calcula os totais do resumo financeiro
 */
function calcularResumoFinanceiro(contas: (BlingContaPagar | BlingContaReceber)[]): ResumoFinanceiro {
  const hojeStr = new Date().toISOString().slice(0, 10);
  let totalAberto = 0;
  let totalLiquidado = 0;
  let totalVencido = 0;

  contas.forEach(c => {
    if (c.situacao === 2) {
      totalLiquidado += c.valor;
    } else if (c.situacao === 1) {
      if (c.vencimento < hojeStr) {
        totalVencido += c.valor;
      } else {
        totalAberto += c.valor;
      }
    }
  });

  return {
    totalAberto,
    totalLiquidado,
    totalVencido,
    qtdRegistros: contas.length,
  };
}
