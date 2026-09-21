import React, { useState } from 'react';
import { X, Printer, Copy, Check, QrCode, CreditCard } from 'lucide-react';
import type { BankProvider, Installment, NFeData } from '../types';
import { BANKS } from '../utils/financeEngine';
import { speechEngine } from '../utils/speechEngine';

interface BoletoModalProps {
  parcela: Installment | null;
  nfe: NFeData | null;
  banco: BankProvider;
  onClose: () => void;
}

export const BoletoModal: React.FC<BoletoModalProps> = ({
  parcela,
  nfe,
  banco,
  onClose,
}) => {
  const [copiedLinha, setCopiedLinha] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);

  if (!parcela || !nfe) return null;

  const bankConfig = BANKS[banco];

  const handleCopyLinha = () => {
    navigator.clipboard.writeText(parcela.linhaDigitavel);
    setCopiedLinha(true);
    speechEngine.playBeep('start');
    setTimeout(() => setCopiedLinha(false), 2000);
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(parcela.pixCopiaECola);
    setCopiedPix(true);
    speechEngine.playBeep('start');
    setTimeout(() => setCopiedPix(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white text-black w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-sans">
        {/* Header de Controle */}
        <div className="bg-slate-900 text-slate-100 px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-bold">
              Boleto Registrado • Parcela {parcela.numero} de {parcela.totalParcelas}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corpo do Boleto Padrão Febraban */}
        <div className="p-4 sm:p-6 overflow-y-auto text-[11px] leading-tight space-y-3 print:p-0">
          {/* Cabeçalho do Banco */}
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{bankConfig.logoIcon}</span>
              <div>
                <h3 className="text-base font-black tracking-tight">{bankConfig.name}</h3>
                <span className="text-[10px] text-gray-500 font-semibold">Carteira de Cobrança Registrada</span>
              </div>
            </div>
            <div className="text-center px-3 border-x-2 border-black">
              <span className="text-lg font-extrabold">{bankConfig.code}-9</span>
            </div>
            <div className="flex-1 text-right pl-3">
              <span className="font-mono text-xs font-bold tracking-tight text-gray-900 block">
                {parcela.linhaDigitavel}
              </span>
            </div>
          </div>

          {/* Recibo do Pagador / Dados do Boleto */}
          <table className="w-full border-collapse border border-black text-[10px]">
            <tbody>
              {/* Linha 1 */}
              <tr>
                <td className="border border-black p-1.5 w-3/4">
                  <span className="text-[8px] text-gray-500 block uppercase">Local de Pagamento</span>
                  <span className="font-semibold">PAGÁVEL EM QUALQUER BANCO OU CANAIS DIGITAIS ATÉ O VENCIMENTO</span>
                </td>
                <td className="border border-black p-1.5 bg-amber-50">
                  <span className="text-[8px] text-amber-800 block uppercase font-bold">Vencimento</span>
                  <span className="font-black text-xs text-amber-900">{parcela.dataVencimentoFormatada}</span>
                </td>
              </tr>

              {/* Linha 2 */}
              <tr>
                <td className="border border-black p-1.5">
                  <span className="text-[8px] text-gray-500 block uppercase">Beneficiário</span>
                  <span className="font-bold">{nfe.emitente.razaoSocial}</span>
                  <span className="text-[9px] text-gray-600 block">CNPJ: {nfe.emitente.cnpj}</span>
                </td>
                <td className="border border-black p-1.5">
                  <span className="text-[8px] text-gray-500 block uppercase">Agência / Código Beneficiário</span>
                  <span className="font-mono font-semibold">{bankConfig.agencyDefault} / {bankConfig.convenioDefault}</span>
                </td>
              </tr>

              {/* Linha 3 */}
              <tr>
                <td className="border border-black p-1.5">
                  <div className="grid grid-cols-4 gap-2 text-[9px]">
                    <div>
                      <span className="text-[8px] text-gray-500 block">Data Doc.</span>
                      <span>{new Date().toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-gray-500 block">Nº Documento</span>
                      <span className="font-mono font-bold">NF{nfe.numeroNFe}-{parcela.numero}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-gray-500 block">Espécie Doc.</span>
                      <span>DM</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-gray-500 block">Aceite</span>
                      <span>N</span>
                    </div>
                  </div>
                </td>
                <td className="border border-black p-1.5">
                  <span className="text-[8px] text-gray-500 block uppercase">Nosso Número</span>
                  <span className="font-mono font-bold">{parcela.nossoNumero}</span>
                </td>
              </tr>

              {/* Linha 4 */}
              <tr>
                <td className="border border-black p-1.5">
                  <div className="grid grid-cols-4 gap-2 text-[9px]">
                    <div>
                      <span className="text-[8px] text-gray-500 block">Uso do Banco</span>
                      <span>CIP 000</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-gray-500 block">Carteira</span>
                      <span>17</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-gray-500 block">Espécie</span>
                      <span>R$</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-gray-500 block">Quantidade</span>
                      <span>-</span>
                    </div>
                  </div>
                </td>
                <td className="border border-black p-1.5 bg-emerald-50">
                  <span className="text-[8px] text-emerald-800 block uppercase font-bold">Valor do Documento</span>
                  <span className="font-black text-sm text-emerald-900">{parcela.valorFormatado}</span>
                </td>
              </tr>

              {/* Linha 5: Instruções e Pagador */}
              <tr>
                <td className="border border-black p-2 align-top h-28 bg-gray-50">
                  <span className="text-[8px] text-gray-500 block uppercase font-bold mb-1">
                    Instruções de Responsabilidade do Beneficiário
                  </span>
                  <p className="text-[10px] text-gray-700 leading-normal">
                    • Cobrança referente à <strong>Parcela {parcela.numero} de {parcela.totalParcelas}</strong> da <strong>NF-e Nº {nfe.numeroNFe}</strong>.<br/>
                    • Após o vencimento, cobrar multa de 2,00% e juros de 1,00% ao mês.<br/>
                    • Boleto Híbrido com recebimento instantâneo via Pix ou compensação Febraban.<br/>
                    • Não receber após 30 dias do vencimento.
                  </p>
                </td>
                <td className="border border-black p-2 align-top bg-gray-50">
                  <div className="text-[9px] space-y-1">
                    <div>
                      <span className="text-[8px] text-gray-500 block">(-) Desconto / Abatimento</span>
                      <span>-</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-gray-500 block">(+) Juros / Multa</span>
                      <span>-</span>
                    </div>
                    <div className="pt-1 border-t border-gray-300">
                      <span className="text-[8px] text-gray-800 block font-bold">(=) Valor Cobrado</span>
                      <span className="font-bold text-xs">{parcela.valorFormatado}</span>
                    </div>
                  </div>
                </td>
              </tr>

              {/* Linha 6: Dados do Pagador */}
              <tr>
                <td colSpan={2} className="border border-black p-2">
                  <span className="text-[8px] text-gray-500 block uppercase font-bold">Pagador</span>
                  <div className="flex flex-col sm:flex-row justify-between text-[10px]">
                    <div>
                      <span className="font-bold text-xs">{nfe.destinatario.razaoSocial}</span>
                      <span className="text-gray-600 block">CNPJ / CPF: {nfe.destinatario.cnpj}</span>
                      <span className="text-gray-600 block">{nfe.destinatario.cidade} - {nfe.destinatario.uf}</span>
                    </div>
                    <div className="text-right text-[9px] text-gray-500 mt-1 sm:mt-0">
                      <span>Sacador/Avalista: -</span>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Área de Pagamento: QR Code Pix + Código de Barras Febraban */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-dashed border-gray-400">
            {/* Bolepix: QR Code Pix */}
            <div className="flex items-center gap-3 p-2 border border-gray-300 rounded-xl bg-gray-50 shrink-0">
              <div className="w-16 h-16 bg-white p-1 rounded-lg border border-gray-300 flex items-center justify-center">
                <QrCode className="w-14 h-14 text-slate-800" />
              </div>
              <div className="text-[10px]">
                <span className="font-bold block text-teal-800 uppercase flex items-center gap-1">
                  <span>Pague com Pix</span>
                  <span className="text-[8px] bg-teal-100 text-teal-700 px-1 rounded">Instantâneo</span>
                </span>
                <span className="text-gray-500 text-[9px] block">Aponte a câmera do seu banco</span>
                <button
                  onClick={handleCopyPix}
                  className="mt-1 flex items-center gap-1 text-[9px] font-bold px-2 py-1 bg-teal-700 text-white rounded hover:bg-teal-600 transition"
                >
                  {copiedPix ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPix ? 'Copiado!' : 'Pix Copia e Cola'}</span>
                </button>
              </div>
            </div>

            {/* Código de Barras Febraban Realista */}
            <div className="flex-1 w-full flex flex-col items-center sm:items-end">
              <span className="text-[9px] font-mono text-gray-500 mb-1">{parcela.codigoBarras}</span>
              {/* Barras Febraban Simuladas em CSS */}
              <div className="h-12 w-full max-w-[320px] flex items-stretch gap-[1.5px] bg-white p-1">
                {parcela.codigoBarras.split('').map((char, i) => {
                  const val = parseInt(char, 10) || 1;
                  const isBlack = (i + val) % 2 === 0;
                  const widthClass = val > 5 ? 'w-1' : 'w-[1.5px]';
                  return (
                    <div
                      key={i}
                      className={`h-full ${widthClass} ${isBlack ? 'bg-black' : 'bg-transparent'}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Botão de Cópia da Linha Digitável */}
          <div className="pt-2 flex items-center justify-between gap-2">
            <div className="text-[10px] text-gray-500 font-mono truncate">
              {parcela.linhaDigitavel}
            </div>
            <button
              onClick={handleCopyLinha}
              className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition shrink-0"
            >
              {copiedLinha ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLinha ? 'Linha Copiada!' : 'Copiar Linha'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
