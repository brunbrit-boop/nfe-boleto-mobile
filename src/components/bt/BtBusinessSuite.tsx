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

// 9 Menus Réplicas 1:1 do BT Business
import { FinancesView } from './pages/FinancesView';
import { SuppliersView } from './pages/SuppliersView';
import { ClientsView } from './pages/ClientsView';
import { PurchasesView } from './pages/PurchasesView';
import { TasksView } from './pages/TasksView';
import { PatrimonyView } from './pages/PatrimonyView';
import { RegistrationView } from './pages/RegistrationView';
import { NotificationsView } from './pages/NotificationsView';
import { SettingsView } from './pages/SettingsView';

// Assistente Fiscal (Chat & Voz)
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
  onSelectBanco,
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
  // Padrão BT Business: Inicia na aba 'finances' (Financeiro)
  const [activeMenu, setActiveMenu] = useState<BtMenuOption>('finances');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const indicadores = calcularIndicadoresBling(contasPagar, contasReceber);

  const handleSelectMenu = (menu: BtMenuOption) => {
    setActiveMenu(menu);
  };

  return (
    <div className="flex h-screen w-full bg-[#f6f8f7] dark:bg-[#0c1a15] overflow-hidden font-['Manrope',sans-serif]">
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

      {/* Conteúdo Principal com Top Header e Área das Telas */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Cabeçalho do BT Business com breadcrumb e ações */}
        <BtHeader
          empresa={empresa}
          activeMenu={activeMenu}
          onOpenMobile={() => setMobileSidebarOpen(true)}
          onBackToEmpresas={onBackToEmpresas}
          onRefreshBling={onRecarregarBling}
          carregando={carregandoBling}
        />

        {/* Área de Visualização do Menu Ativo - Cópia 1:1 do BT Business */}
        <main className="flex-1 overflow-y-auto">
          {/* 1. Financeiro (FinancesView) */}
          {activeMenu === 'finances' && (
            <FinancesView
              contasPagar={contasPagar}
              contasReceber={contasReceber}
              onRefreshBling={onRecarregarBling}
              carregando={carregandoBling}
              onViewBoletoReceber={onViewBoletoReceber}
            />
          )}

          {/* 2. Fornecedores (SuppliersView) */}
          {activeMenu === 'suppliers' && (
            <SuppliersView clientesBling={clientes} />
          )}

          {/* 3. Clientes (ClientsView) */}
          {activeMenu === 'clients' && (
            <ClientsView
              clientesBling={clientes}
              onEmitirParaCliente={(cli) => {
                onEmitirParaCliente(cli);
                setActiveMenu('robo');
              }}
            />
          )}

          {/* 4. Compras (PurchasesView) */}
          {activeMenu === 'purchases' && (
            <PurchasesView />
          )}

          {/* 5. Tarefas (TasksView) */}
          {activeMenu === 'tasks' && (
            <TasksView />
          )}

          {/* 6. Patrimônio (PatrimonyView) */}
          {activeMenu === 'patrimony' && (
            <PatrimonyView />
          )}

          {/* 7. Cadastro (RegistrationView) */}
          {activeMenu === 'registration' && (
            <RegistrationView
              empresaAtiva={empresa}
              empresas={[empresa]}
            />
          )}

          {/* 8. Notificações (NotificationsView) */}
          {activeMenu === 'notifications' && (
            <NotificationsView />
          )}

          {/* 9. Configurações (SettingsView) */}
          {activeMenu === 'settings' && (
            <SettingsView
              empresa={empresa}
              bancoAtual={bancoAtual}
              onSelectBanco={onSelectBanco}
              onOpenModalSettings={onOpenSettings}
            />
          )}

          {/* 10. Robô Fiscal & Voz (ChatView & Voice) */}
          {activeMenu === 'robo' && (
            <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 to-indigo-950/30 border border-purple-500/20 text-xs text-purple-200 flex items-center justify-between">
                <span>
                  🎙️ <b>Robô Fiscal Ativo:</b> Fale ou digite comandos em linguagem natural (ex: <i>"Emitir nota de 3000 em 3x para Silva Materiais"</i>).
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                  IA SEFAZ & FEBRABAN
                </span>
              </div>

              <div className="bg-white dark:bg-[#10221c] border border-slate-200 dark:border-[#1a382e] rounded-2xl shadow-sm overflow-hidden h-[620px] flex flex-col">
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
        </main>
      </div>
    </div>
  );
};
