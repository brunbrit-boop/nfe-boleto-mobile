import { calcularDivisaoParcelas, formatCurrency, gerarPayloadIntegracaoBanco } from './src/utils/financeEngine';
import { interpretarComandoVoz, criarNFeDeComando } from './src/utils/aiParser';

console.log('=== TESTE 1: Divisão Exata de Parcelas Sem Perda de Centavos ===');
const valorTotal = 1000.00;
const parcelas = calcularDivisaoParcelas(valorTotal, 3, 'inter');
console.log(`Valor Total: ${formatCurrency(valorTotal)} em ${parcelas.length}x`);
let soma = 0;
parcelas.forEach(p => {
  console.log(`  • Parcela ${p.numero}/${p.totalParcelas}: ${p.valorFormatado} (Venc: ${p.dataVencimentoFormatada}) | Linha: ${p.linhaDigitavel}`);
  soma += p.valor;
});
console.log(`Soma das parcelas: ${formatCurrency(soma)}`);
if (Math.abs(soma - valorTotal) < 0.001) {
  console.log('✅ TESTE 1 PASSOU: A soma bateu 100% exatamente com o total!');
} else {
  console.error('❌ TESTE 1 FALHOU');
  process.exit(1);
}

console.log('\n=== TESTE 2: Interpretação de Comando por Voz ===');
const comando = 'Olha, eu quero criar uma nota fiscal de venda de produtos da minha empresa para a empresa Silva Materiais no valor de R$ 3.000 em 3 parcelas';
const parsed = interpretarComandoVoz(comando, 'inter');
console.log('Cliente extraído:', parsed.destinatarioNome);
console.log('CNPJ:', parsed.destinatarioCnpj);
console.log('Valor Total:', parsed.valorTotal);
console.log('Qtd Parcelas:', parsed.quantidadeParcelas);
console.log('Banco:', parsed.banco);

if (parsed.destinatarioNome.toLowerCase().includes('silva') && parsed.valorTotal === 3000 && parsed.quantidadeParcelas === 3) {
  console.log('✅ TESTE 2 PASSOU: Comando interpretado com sucesso!');
} else {
  console.error('❌ TESTE 2 FALHOU');
  process.exit(1);
}

console.log('\n=== TESTE 3: Criação de NF-e e Payload Bancário ===');
const nfe = criarNFeDeComando(parsed, {
  razaoSocial: 'BRASIL TECH LTDA',
  nomeFantasia: 'Brasil Tech',
  cnpj: '24.912.830/0001-52',
  inscricaoEstadual: '114.920.381.119',
  logradouro: 'Av Paulista',
  numero: '1578',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'SP',
  cep: '01310-200',
  regimeTributario: 'Simples Nacional',
  certificadoA1Valido: true,
});

console.log('Chave de Acesso (44 dígitos):', nfe.chaveAcesso, `(tamanho: ${nfe.chaveAcesso.length})`);
console.log('Número NF-e:', nfe.numeroNFe);
const payloadBanco = gerarPayloadIntegracaoBanco('inter', nfe.destinatario.razaoSocial, nfe.destinatario.cnpj, nfe.parcelas[0]);
console.log('Payload Banco Inter Parcela 1:', JSON.stringify(payloadBanco));

if (nfe.chaveAcesso.length === 44 && nfe.parcelas.length === 3) {
  console.log('✅ TESTE 3 PASSOU: NF-e e Boletos gerados com sucesso!');
} else {
  console.error('❌ TESTE 3 FALHOU');
  process.exit(1);
}

console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
