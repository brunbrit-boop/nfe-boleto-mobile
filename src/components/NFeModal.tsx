import React from 'react';
import { X, Printer, ShieldCheck } from 'lucide-react';
import type { NFeData } from '../types';

interface NFeModalProps {
  nfe: NFeData | null;
  onClose: () => void;
}

export const NFeModal: React.FC<NFeModalProps> = ({ nfe, onClose }) => {
  if (!nfe) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white text-black w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-sans">
        {/* Modal Top Control Bar */}
        <div className="bg-slate-900 text-slate-100 px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-bold">
              DANFE Oficial • NF-e Nº {nfe.numeroNFe} (Série {nfe.serie})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              title="Imprimir DANFE"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* DANFE Paper Container (Estilo SEFAZ Real) */}
        <div className="p-4 sm:p-6 overflow-y-auto text-[11px] leading-tight space-y-3 print:p-0">
          {/* Header do DANFE */}
          <div className="border border-black p-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex-1">
              <h2 className="font-bold text-sm uppercase tracking-tight">
                {nfe.emitente.razaoSocial}
              </h2>
              <p className="text-[10px] text-gray-700">
                {nfe.emitente.logradouro}, {nfe.emitente.numero} - {nfe.emitente.bairro}
              </p>
              <p className="text-[10px] text-gray-700">
                {nfe.emitente.cidade} - {nfe.emitente.uf} • CEP: {nfe.emitente.cep}
              </p>
              <p className="text-[10px] font-semibold mt-1">
                CNPJ: {nfe.emitente.cnpj} • IE: {nfe.emitente.inscricaoEstadual}
              </p>
            </div>

            <div className="border border-black p-2 text-center shrink-0 w-36 bg-gray-50">
              <span className="font-extrabold text-sm block">DANFE</span>
              <span className="text-[8px] block uppercase leading-none mt-0.5">
                Doc. Auxiliar da Nota Fiscal Eletrônica
              </span>
              <div className="my-1 text-[10px] font-bold">
                0 - ENTRADA<br/>
                1 - SAÍDA [ 1 ]
              </div>
              <span className="font-bold text-xs block">Nº {nfe.numeroNFe}</span>
              <span className="text-[9px] block">SÉRIE {nfe.serie}</span>
            </div>

            <div className="flex-1 text-center sm:text-right">
              <span className="text-[8px] font-bold uppercase block text-gray-600">
                CHAVE DE ACESSO DA NF-E
              </span>
              <span className="font-mono text-[10px] font-bold tracking-tight block break-all bg-gray-100 p-1 border border-gray-300 rounded">
                {nfe.chaveAcesso}
              </span>
              <div className="mt-2 text-[9px] text-gray-700">
                <span className="block font-semibold">Protocolo de Autorização de Uso:</span>
                <span className="font-mono">{nfe.protocoloAutorizacao || '135260012938471'}</span>
              </div>
            </div>
          </div>

          {/* Natureza da Operação */}
          <div className="border border-black p-1.5 flex justify-between bg-gray-50">
            <div>
              <span className="text-[8px] font-bold uppercase block text-gray-600">Natureza da Operação</span>
              <span className="font-bold">{nfe.naturezaOperacao}</span>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-bold uppercase block text-gray-600">Data / Hora de Emissão</span>
              <span className="font-bold">{nfe.dataEmissao}</span>
            </div>
          </div>

          {/* Destinatário / Remetente */}
          <div className="border border-black p-2">
            <span className="text-[8px] font-bold uppercase block text-gray-600 mb-1 border-b border-gray-300 pb-0.5">
              DESTINATÁRIO / REMETENTE
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <span className="text-[8px] text-gray-500 block">NOME / RAZÃO SOCIAL:</span>
                <span className="font-bold text-xs">{nfe.destinatario.razaoSocial}</span>
              </div>
              <div>
                <span className="text-[8px] text-gray-500 block">CNPJ / CPF:</span>
                <span className="font-mono font-bold">{nfe.destinatario.cnpj}</span>
              </div>
              <div>
                <span className="text-[8px] text-gray-500 block">MUNICÍPIO:</span>
                <span>{nfe.destinatario.cidade}</span>
              </div>
              <div>
                <span className="text-[8px] text-gray-500 block">UF:</span>
                <span className="font-bold">{nfe.destinatario.uf}</span>
              </div>
              <div>
                <span className="text-[8px] text-gray-500 block">INSCRIÇÃO ESTADUAL:</span>
                <span>{nfe.destinatario.inscricaoEstadual || 'ISENTO'}</span>
              </div>
            </div>
          </div>

          {/* Fatura / Duplicatas de Cobrança */}
          <div className="border border-black p-2">
            <span className="text-[8px] font-bold uppercase block text-gray-600 mb-1.5 border-b border-gray-300 pb-0.5">
              FATURA / DUPLICATAS (PARCELAMENTO AUTOMÁTICO)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {nfe.parcelas.map((p) => (
                <div key={p.numero} className="border border-gray-300 bg-gray-50 p-1.5 rounded text-[10px]">
                  <span className="font-bold block text-gray-700">Duplicata: {p.numero}/{p.totalParcelas}</span>
                  <span className="text-gray-600 block">Venc: <strong>{p.dataVencimentoFormatada}</strong></span>
                  <span className="font-bold text-emerald-800 block text-xs mt-0.5">{p.valorFormatado}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cálculo do Imposto */}
          <div className="border border-black p-2 bg-gray-50">
            <span className="text-[8px] font-bold uppercase block text-gray-600 mb-1 border-b border-gray-300 pb-0.5">
              CÁLCULO DO IMPOSTO
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-[10px]">
              <div>
                <span className="text-[8px] text-gray-500 block">BASE CÁLC. ICMS</span>
                <span className="font-bold">{nfe.valorTotalFormatado}</span>
              </div>
              <div>
                <span className="text-[8px] text-gray-500 block">VALOR DO ICMS</span>
                <span className="font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(nfe.valorTotal * 0.18)}
                </span>
              </div>
              <div>
                <span className="text-[8px] text-gray-500 block">VALOR FRETE</span>
                <span className="font-bold">R$ 0,00</span>
              </div>
              <div>
                <span className="text-[8px] text-gray-500 block">TOTAL PRODUTOS</span>
                <span className="font-bold">{nfe.valorTotalFormatado}</span>
              </div>
              <div className="bg-emerald-100 p-1 border border-emerald-300 rounded">
                <span className="text-[8px] text-emerald-800 block font-bold">TOTAL DA NOTA</span>
                <span className="font-bold text-xs text-emerald-900">{nfe.valorTotalFormatado}</span>
              </div>
            </div>
          </div>

          {/* Itens do Produto */}
          <div className="border border-black">
            <div className="bg-gray-200 px-2 py-1 font-bold text-[9px] uppercase border-b border-black">
              DADOS DOS PRODUTOS / SERVIÇOS
            </div>
            <table className="w-full text-[10px] text-left">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-100 text-[8px] uppercase text-gray-600">
                  <th className="p-1">Cód.</th>
                  <th className="p-1">Descrição</th>
                  <th className="p-1">NCM</th>
                  <th className="p-1">CFOP</th>
                  <th className="p-1">UN</th>
                  <th className="p-1 text-right">Qtd</th>
                  <th className="p-1 text-right">V.Unit</th>
                  <th className="p-1 text-right">V.Total</th>
                </tr>
              </thead>
              <tbody>
                {nfe.itens.map((item, idx) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="p-1 font-mono">00{idx + 1}</td>
                    <td className="p-1 font-semibold">{item.descricao}</td>
                    <td className="p-1 font-mono">{item.ncm}</td>
                    <td className="p-1 font-mono">{item.cfop}</td>
                    <td className="p-1">{item.unidade}</td>
                    <td className="p-1 text-right font-bold">{item.quantidade}</td>
                    <td className="p-1 text-right">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorUnitario)}
                    </td>
                    <td className="p-1 text-right font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Dados Adicionais */}
          <div className="border border-black p-2 text-[9px] text-gray-700 bg-gray-50">
            <span className="font-bold block uppercase text-[8px] text-gray-600 mb-0.5">DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES</span>
            <p>
              Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI.
              Emissão automática autorizada via Robô Assistente de Voz com integração Bancária ({nfe.banco.toUpperCase()}).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
