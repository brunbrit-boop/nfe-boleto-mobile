import React, { useState } from 'react';
import { CreditCard, Copy, Check, QrCode, Barcode, Code2, Share2 } from 'lucide-react';
import type { BankProvider, Installment, NFeData } from '../types';
import { BANKS, gerarPayloadIntegracaoBanco } from '../utils/financeEngine';
import { speechEngine } from '../utils/speechEngine';

interface InstallmentsCardProps {
  parcelas: Installment[];
  banco: BankProvider;
  nfe: NFeData;
  onViewBoleto: (parcela: Installment) => void;
  onViewPayloadBanco: (payload: object, parcela: Installment) => void;
}

export const InstallmentsCard: React.FC<InstallmentsCardProps> = ({
  parcelas,
  banco,
  nfe,
  onViewBoleto,
  onViewPayloadBanco,
}) => {
  const [copiedLinhaIdx, setCopiedLinhaIdx] = useState<number | null>(null);
  const [copiedPixIdx, setCopiedPixIdx] = useState<number | null>(null);

  const bankConfig = BANKS[banco];

  const handleCopyLinha = (linha: string, idx: number) => {
    navigator.clipboard.writeText(linha);
    setCopiedLinhaIdx(idx);
    speechEngine.playBeep('start');
    setTimeout(() => setCopiedLinhaIdx(null), 2000);
  };

  const handleCopyPix = (pix: string, idx: number) => {
    navigator.clipboard.writeText(pix);
    setCopiedPixIdx(idx);
    speechEngine.playBeep('start');
    setTimeout(() => setCopiedPixIdx(null), 2000);
  };

  const handleShareWhatsApp = () => {
    const texto = `Olá! Seguem os dados para pagamento referente à NF-e ${nfe.numeroNFe}:\n\n` +
      parcelas.map(p => `• Parcela ${p.numero}/${p.totalParcelas} (${p.dataVencimentoFormatada}): ${p.valorFormatado}\nLinha Digitável: ${p.linhaDigitavel}`).join('\n\n');
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden border-slate-700/80 shadow-lg mt-2">
      {/* Top Header com Identificação do Banco */}
      <div className={`px-4 py-2.5 flex items-center justify-between border-b ${bankConfig.badgeBg}`}>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-300" />
          <span className="text-xs font-bold text-slate-100">
            Divisão Automática: {parcelas.length}x Parcelas
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{bankConfig.logoIcon}</span>
          <span className={`text-[11px] font-bold ${bankConfig.badgeText}`}>
            {bankConfig.name}
          </span>
        </div>
      </div>

      {/* Lista das Parcelas com Códigos Febraban */}
      <div className="p-3.5 space-y-3">
        <div className="text-[11px] text-slate-400 flex items-center justify-between">
          <span>Vencimentos calculados com intervalo de 30 dias (dias úteis):</span>
          <span className="text-[10px] text-brand-400 font-semibold bg-brand-500/10 px-1.5 py-0.5 rounded">
            Centavos exatos
          </span>
        </div>

        <div className="space-y-2.5">
          {parcelas.map((parc, idx) => (
            <div
              key={parc.numero}
              className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 hover:border-slate-700 transition space-y-2"
            >
              {/* Cabeçalho da Parcela */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-brand-400 font-bold flex items-center justify-center text-[11px] border border-slate-700">
                    {parc.numero}
                  </span>
                  <div>
                    <span className="font-bold text-slate-200">
                      Parcela {parc.numero} de {parc.totalParcelas}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Vencimento: <strong className="text-slate-300">{parc.dataVencimentoFormatada}</strong>
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-slate-100">
                    {parc.valorFormatado}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    Nosso Nº {parc.nossoNumero}
                  </span>
                </div>
              </div>

              {/* Linha Digitável Febraban */}
              <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800/80 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block leading-none mb-1">
                    Linha Digitável (Código para enviar ao Banco):
                  </span>
                  <span className="text-[11px] font-mono font-medium text-emerald-300 tracking-tight block truncate">
                    {parc.linhaDigitavel}
                  </span>
                </div>
                <button
                  onClick={() => handleCopyLinha(parc.linhaDigitavel, idx)}
                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 border border-slate-700 transition"
                  title="Copiar Linha Digitável do Boleto"
                >
                  {copiedLinhaIdx === idx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Botões de Ações Rápidas da Parcela */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                <button
                  onClick={() => onViewBoleto(parc)}
                  className="flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/70 transition"
                  title="Visualizar Boleto Oficial com Código de Barras"
                >
                  <Barcode className="w-3 h-3 text-amber-400" />
                  <span>Ver Boleto</span>
                </button>

                <button
                  onClick={() => handleCopyPix(parc.pixCopiaECola, idx)}
                  className="flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/70 transition"
                  title="Copiar Código Pix Copia e Cola (Bolepix)"
                >
                  {copiedPixIdx === idx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Pix Copiado!</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-3 h-3 text-teal-400" />
                      <span>Copiar Pix</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    const payload = gerarPayloadIntegracaoBanco(banco, nfe.destinatario.razaoSocial, nfe.destinatario.cnpj, parc);
                    onViewPayloadBanco(payload, parc);
                  }}
                  className="flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/70 transition"
                  title="Ver Payload JSON da API do Banco ou Remessa"
                >
                  <Code2 className="w-3 h-3 text-blue-400" />
                  <span>API Banco</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Ação de Envio / Compartilhamento Geral */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleShareWhatsApp}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartilhar Códigos das Parcelas via WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
