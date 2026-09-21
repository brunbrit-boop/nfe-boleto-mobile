import React, { useState } from 'react';
import type {
  EmpresaTenant,
  CompanyProfile,
  BlingContaPagar,
  BlingContaReceber,
  BlingCliente,
  ChatMessage,
  NFeData,
  BankProvider,
  Installment,
} from '../../types';
import type { BtMenuOption } from './BtSidebar';
import { BtSidebar } from './BtSidebar';
import { BtHeader } from './BtHeader';
import { BtDashboardView } from './BtDashboardView';
import { BtReconciliationView } from './BtReconciliationView';
import { ContasPagarTab } from '../ContasPagarTab';
import { ContasReceberTab } from '../ContasReceberTab';
import { ClientesTab } from '../ClientesTab';
import { ChatView } from '../ChatView';
import { VoiceMicBar } from '../VoiceMicBar';
import { calcularIndicadoresBling } from '../../utils/blingDataAdapter';

interface BtBusinessSuiteProps {
  empresa: EmpresaTenant;
  company: CompanyProfile;
  bancoAtual: BankProvider;
  onSelectBanco: (banco: BankProvider) => void;
  onBackToEmpresas: () => void;
  onOpenSettings: () => void;

  // Dados do Bling da empresa
  contasPagar: BlingContaPagar[];
  contasReceber: BlingContaReceber[];
  clientes: BlingCliente[];
  carregandoBling: boolean;
  onRecarregarBling: () => void;

  // Robô Fiscal (Chat & Voz)
  messages: ChatMessage[];
  isListening: boolean;
  isSpeaking: boolean;
  listeningTranscript: string;
  onStartListening: () => void;
  onStopListening: () => void;
  onSendMessage: (text: string) => void;
  onQuickAction: (action: string) => void;
  onViewDanfe: (nfe: NFeData) => void;
  onViewBoleto: (parcela: Installment, nfe: NFeData) => void;
  onViewPayloadBanco: (payload: any, parcela: Installment) => void;
  onViewBoletoReceber: (conta: BlingContaReceber) => void;
  onEmitirNFe: (nfe: NFeData) => void;
  onEmitirParaCliente: (cliente: BlingCliente) => void;
}

export const BtBusinessSuite: React.FC<BtBusinessSuiteProps> = ({
  empresa,
  bancoAtual,
  onBackToEmpresas,
  onOpenSettings,
  contasPagar,
  contasReceber,
  clientes,
  carregandoBling,
  onRecarregarBling,
  messages,
  isListening,
  listeningTranscript,
  onStartListening,
  onStopListening,
  onSendMessage,
  onQuickAction,
  onViewDanfe,
  onViewBoleto,
  onViewPayloadBanco,
  onViewBoletoReceber,
  onEmitirNFe,
  onEmitirParaCliente,
}) => {
  const [activeMenu, setActiveMenu] = useState<BtMenuOption>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const indicadores = calcularIndicadoresBling(contasPagar, contasReceber);

  const handleSelectMenu = (menu: BtMenuOption) => {
    if (menu === 'config') {
      onOpenSettings();
    } else {
      setActiveMenu(menu);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-[#0c1a15] overflow-hidden">
      {/* Barra Lateral do BT Business */}
      <BtSidebar
        empresa={empresa}
        activeMenu={activeMenu}
        onSelectMenu={handleSelectMenu}
        onBackToEmpresas={onBackToEmpresas}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        totalPagarAberto={indicadores.totalPagarAberto}
        totalReceberAberto={indicadores.totalReceberAberto}
      />

      {/* Conteúdo Principal com Top Header e Área Scrollável */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Cabeçalho do BT Business */}
        <BtHeader
          empresa={empresa}
          activeMenu={activeMenu}
          onOpenMobile={() => setMobileSidebarOpen(true)}
          onBackToEmpresas={onBackToEmpresas}
          onRefreshBling={onRecarregarBling}
          carregando={carregandoBling}
        />

        {/* Área de Visualização do Módulo Selecionado */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-7xl mx-auto w-full">
            {/* 1. Visão Geral / Dashboard Executivo */}
            {activeMenu === 'dashboard' && (
              <BtDashboardView
                contasPagar={contasPagar}
                contasReceber={contasReceber}
                clientes={clientes}
                onNavigateToTab={(tab) => {
                  if (tab === 'robo') setActiveMenu('robo');
                  else if (tab === 'pagar') setActiveMenu('pagar');
                  else if (tab === 'receber') setActiveMenu('receber');
                  else if (tab === 'clientes') setActiveMenu('clientes');
                  else if (tab === 'conciliacao') setActiveMenu('conciliacao');
                }}
              />
            )}

            {/* 2. Contas a Pagar (Bling ERP) */}
            {activeMenu === 'pagar' && (
              <ContasPagarTab
                contas={contasPagar}
                resumo={{
                  totalAberto: indicadores.totalPagarAberto,
                  totalLiquidado: indicadores.totalPagarLiquidado,
                  totalVencido: indicadores.totalPagarVencido,
                  qtdRegistros: contasPagar.length,
                }}
                isLoading={carregandoBling}
                isLive={empresa.isBlingConectado}
                onRefresh={onRecarregarBling}
              />
            )}

            {/* 3. Contas a Receber (Bling ERP) */}
            {activeMenu === 'receber' && (
              <ContasReceberTab
                contas={contasReceber}
                resumo={{
                  totalAberto: indicadores.totalReceberAberto,
                  totalLiquidado: indicadores.totalReceberLiquidado,
                  totalVencido: indicadores.totalReceberVencido,
                  qtdRegistros: contasReceber.length,
                }}
                isLoading={carregandoBling}
                isLive={empresa.isBlingConectado}
                onRefresh={onRecarregarBling}
                onViewBoletoReceber={onViewBoletoReceber}
              />
            )}

            {/* 4. Conciliação & Extrato Bancário */}
            {activeMenu === 'conciliacao' && (
              <BtReconciliationView
                contasPagar={contasPagar}
                contasReceber={contasReceber}
              />
            )}

            {/* 5. Clientes & Fornecedores */}
            {activeMenu === 'clientes' && (
              <ClientesTab
                clientes={clientes}
                isLoading={carregandoBling}
                isLive={empresa.isBlingConectado}
                onRefresh={onRecarregarBling}
                onEmitirParaCliente={(cli) => {
                  onEmitirParaCliente(cli);
                  setActiveMenu('robo');
                }}
              />
            )}

            {/* 6. Robô Fiscal & Comandos por Voz */}
            {activeMenu === 'robo' && (
              <div className="space-y-4 max-w-4xl mx-auto">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 to-indigo-950/30 border border-purple-500/20 text-xs text-purple-200 flex items-center justify-between">
                  <span>
                    🎙️ <b>Robô Fiscal Ativo:</b> Fale ou digite comandos em linguagem natural (ex: <i>"Emitir nota de 3000 em 3x para Silva Materiais"</i>).
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                    IA SEFAZ & FEBRABAN
                  </span>
                </div>

                <div className="bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] rounded-2xl shadow-sm overflow-hidden h-[600px] flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4">
                    <ChatView
                      messages={messages}
                      bancoAtual={bancoAtual}
                      onViewDanfe={onViewDanfe}
                      onEmitirNFe={onEmitirNFe}
                      onViewBoleto={onViewBoleto}
                      onViewPayloadBanco={onViewPayloadBanco}
                      onQuickAction={onQuickAction}
                    />
                  </div>
                  <VoiceMicBar
                    isListening={isListening}
                    onStartListening={onStartListening}
                    onStopListening={onStopListening}
                    onSendMessage={onSendMessage}
                    listeningTranscript={listeningTranscript}
                  />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
