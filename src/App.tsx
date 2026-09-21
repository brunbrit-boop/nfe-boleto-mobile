import React, { useState, useEffect } from 'react';
import type { ActiveTab, BankProvider, ChatMessage, CompanyProfile, Installment, NFeData, BlingCliente, BlingContaPagar, BlingContaReceber, ResumoFinanceiro } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ChatView } from './components/ChatView';
import { VoiceMicBar } from './components/VoiceMicBar';
import { ClientesTab } from './components/ClientesTab';
import { ContasPagarTab } from './components/ContasPagarTab';
import { ContasReceberTab } from './components/ContasReceberTab';
import { NFeModal } from './components/NFeModal';
import { BoletoModal } from './components/BoletoModal';
import { PayloadModal } from './components/PayloadModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { criarNFeDeComando, interpretarComandoVoz } from './utils/aiParser';
import { speechEngine } from './utils/speechEngine';
import { carregarClientesBling, carregarContasPagarBling, carregarContasReceberBling, getStoredBlingToken } from './services/blingService';
import { exchangeBlingCodeForToken, BLING_DEFAULT_CLIENT_ID } from './utils/blingApi';

export const App: React.FC = () => {
  // Aba Ativa (Padrão: Robô)
  const [activeTab, setActiveTab] = useState<ActiveTab>('robo');

  // Dados da Empresa Emitente
  const [company, setCompany] = useState<CompanyProfile>(() => {
    const saved = localStorage.getItem('nfe_company_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      razaoSocial: 'BRASIL TECH & COMERCIO LTDA',
      nomeFantasia: 'Brasil Tech Distribuidora',
      cnpj: '24.912.830/0001-52',
      inscricaoEstadual: '114.920.381.119',
      logradouro: 'Avenida Paulista',
      numero: '1578',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01310-200',
      regimeTributario: 'Simples Nacional',
      certificadoA1Valido: true,
    };
  });

  const [bancoAtual, setBancoAtual] = useState<BankProvider>(() => {
    return (localStorage.getItem('nfe_banco_padrao') as BankProvider) || 'inter';
  });

  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [listeningTranscript, setListeningTranscript] = useState<string>('');

  // Modais
  const [selectedNFeForDanfe, setSelectedNFeForDanfe] = useState<NFeData | null>(null);
  const [selectedParcelaForBoleto, setSelectedParcelaForBoleto] = useState<{ parcela: Installment; nfe: NFeData } | null>(null);
  const [selectedPayloadBanco, setSelectedPayloadBanco] = useState<{ payload: object; parcela: Installment } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [blingAlert, setBlingAlert] = useState<string | null>(null);

  // Estados dos Módulos do Bling ERP
  const [clientes, setClientes] = useState<BlingCliente[]>([]);
  const [contasPagar, setContasPagar] = useState<BlingContaPagar[]>([]);
  const [resumoPagar, setResumoPagar] = useState<ResumoFinanceiro>({ totalAberto: 0, totalLiquidado: 0, totalVencido: 0, qtdRegistros: 0 });
  const [contasReceber, setContasReceber] = useState<BlingContaReceber[]>([]);
  const [resumoReceber, setResumoReceber] = useState<ResumoFinanceiro>({ totalAberto: 0, totalLiquidado: 0, totalVencido: 0, qtdRegistros: 0 });
  const [isLoadingBling, setIsLoadingBling] = useState<boolean>(false);
  const [isBlingLive, setIsBlingLive] = useState<boolean>(false);

  // Mensagens do Chat do Robô
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const cmdExemplo = 'Criar nota fiscal de venda de produtos da minha empresa para Silva Materiais no valor de R$ 3.000 em 3 parcelas';
    const parsed = interpretarComandoVoz(cmdExemplo, 'inter');
    const nfeDemo = criarNFeDeComando(parsed, {
      razaoSocial: 'BRASIL TECH & COMERCIO LTDA',
      nomeFantasia: 'Brasil Tech',
      cnpj: '24.912.830/0001-52',
      inscricaoEstadual: '114.920.381.119',
      logradouro: 'Avenida Paulista',
      numero: '1578',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01310-200',
      regimeTributario: 'Simples Nacional',
      certificadoA1Valido: true,
    });

    return [
      {
        id: 'msg-welcome',
        sender: 'bot',
        text: 'Olá! Sou seu **Robô Fiscal & Bancário Inteligente** 🤖.\n\n' +
              'Todos os dados de **Clientes**, **Contas a Pagar** e **Contas a Receber** estão integrados com o seu **Bling ERP**.\n\n' +
              'Você pode simplesmente **falar no microfone** dizendo o que vendeu e a quantidade de parcelas. O robô emite a NF-e e já gera os códigos bancários do seu banco!\n\n' +
              'Veja uma simulação pronta abaixo:',
        timestamp: agora,
        nfeData: nfeDemo,
        quickActions: [
          { label: '🎙️ Testar comando por voz', action: 'start_voice' },
          { label: '📄 Ver DANFE da Nota', action: 'view_demo_danfe' },
          { label: '👥 Ver Clientes do Bling', action: 'go_clientes' },
        ],
      }
    ];
  });

  // Carrega dados iniciais do Bling
  const carregarDadosBling = async () => {
    setIsLoadingBling(true);
    try {
      const [resClientes, resPagar, resReceber] = await Promise.all([
        carregarClientesBling(),
        carregarContasPagarBling(),
        carregarContasReceberBling(),
      ]);

      setClientes(resClientes.data);
      setContasPagar(resPagar.data);
      setResumoPagar(resPagar.resumo);
      setContasReceber(resReceber.data);
      setResumoReceber(resReceber.resumo);
      setIsBlingLive(resClientes.isLive || resPagar.isLive || resReceber.isLive);
    } catch {
      // Ignora erro de rede
    } finally {
      setIsLoadingBling(false);
    }
  };

  useEffect(() => {
    carregarDadosBling();
  }, []);

  // Monitora retorno OAuth do Bling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      localStorage.setItem('bling_auth_code', code);
      const clientSecret = localStorage.getItem('bling_client_secret');
      const clientId = localStorage.getItem('bling_client_id') || BLING_DEFAULT_CLIENT_ID;

      if (clientSecret) {
        setBlingAlert('Trocando código de autorização por token de acesso no Bling...');
        exchangeBlingCodeForToken(code, clientId, clientSecret).then((res) => {
          if (res.success) {
            setBlingAlert('Conta do Bling conectada com sucesso! Dados reais importados.');
            speechEngine.playBeep('success');
            carregarDadosBling();
          } else {
            setBlingAlert(`Código recebido! Para autenticar, confirme o Client Secret ou cole o Token de Acesso nas configurações.`);
            speechEngine.playBeep('error');
            setIsSettingsOpen(true);
          }
        });
      } else {
        setBlingAlert('Autorização do Bling recebida! Insira seu Client Secret ou Token de Acesso para sincronizar.');
        speechEngine.playBeep('start');
        setIsSettingsOpen(true);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSelectBanco = (banco: BankProvider) => {
    setBancoAtual(banco);
    localStorage.setItem('nfe_banco_padrao', banco);
    speechEngine.playBeep('start');
  };

  const handleToggleTts = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    speechEngine.setTtsEnabled(next);
    if (!next) {
      speechEngine.stopSpeaking();
    }
  };

  const handleSaveCompany = (updated: CompanyProfile) => {
    setCompany(updated);
    localStorage.setItem('nfe_company_profile', JSON.stringify(updated));
    speechEngine.playBeep('success');
  };

  // Processamento de comando do Robô
  const handleProcessUserCommand = (textoComando: string, isFromVoice: boolean = false) => {
    if (!textoComando.trim()) return;

    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `usr-${Date.now()}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textoComando,
      timestamp: agora,
      isAudio: isFromVoice,
    };

    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const parsed = interpretarComandoVoz(textoComando, bancoAtual);
      const nfe = criarNFeDeComando(parsed, company);

      const botMsgId = `bot-${Date.now()}`;
      const botMsg: ChatMessage = {
        id: botMsgId,
        sender: 'bot',
        text: parsed.mensagemResposta,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        nfeData: nfe,
        quickActions: [
          { label: '📄 Visualizar DANFE (PDF)', action: `danfe_${nfe.numeroNFe}` },
          { label: '💳 Ver 1º Boleto', action: `boleto_1` },
          { label: '📈 Ver no Contas a Receber', action: 'go_receber' },
        ],
      };

      setMessages((prev) => [...prev, botMsg]);
      speechEngine.playBeep('success');
      if (ttsEnabled) {
        speechEngine.speak(
          `Nota fiscal para ${parsed.destinatarioNome} preparada em ${parsed.quantidadeParcelas} parcelas. Os códigos bancários estão prontos para envio!`
        );
      }
    }, 450);
  };

  const handleStartListening = () => {
    setListeningTranscript('');
    setIsListening(true);

    speechEngine.startListening(
      (transcript, isFinal) => {
        setListeningTranscript(transcript);
        if (isFinal && transcript.trim().length > 3) {
          setIsListening(false);
          handleProcessUserCommand(transcript, true);
        }
      },
      (err) => {
        setIsListening(false);
        setListeningTranscript('');
        alert(err);
      },
      () => {
        setIsListening(false);
      }
    );
  };

  const handleStopListening = () => {
    speechEngine.stopListening();
    setIsListening(false);
    if (listeningTranscript.trim().length > 3) {
      handleProcessUserCommand(listeningTranscript, true);
    }
  };

  // Ação ao clicar em "Emitir NF-e" na aba de Clientes
  const handleEmitirParaCliente = (cliente: BlingCliente) => {
    setActiveTab('robo');
    const comando = `Quero emitir uma nota fiscal de venda para a empresa ${cliente.fantasia || cliente.nome} no valor de R$ 2.400 em 3 parcelas`;
    handleProcessUserCommand(comando, false);
  };

  // Visualizar boleto a partir do Contas a Receber
  const handleViewBoletoReceber = (conta: BlingContaReceber) => {
    const parcelaSimulada: Installment = {
      numero: 1,
      totalParcelas: 1,
      dataVencimento: conta.vencimento,
      dataVencimentoFormatada: conta.vencimentoFormatado,
      valor: conta.valor,
      valorFormatado: conta.valorFormatado,
      nossoNumero: conta.nossoNumero || '17/00000910241',
      linhaDigitavel: conta.linhaDigitavel || '07790.00116 70000.076987 52123.456700 6 16060000033334',
      codigoBarras: conta.codigoBarras || '0779616060000033334001170000076985212345670',
      pixCopiaECola: conta.pixCopiaECola || '',
      status: conta.situacao === 2 ? 'pago' : 'emitido',
    };

    const nfeSimulada: NFeData = {
      numeroNFe: conta.numeroDocumento.replace(/\D/g, '') || '6081',
      serie: '1',
      dataEmissao: conta.dataEmissao,
      naturezaOperacao: 'VENDA DE MERCADORIAS',
      chaveAcesso: '35260924912830000152550010000060811464053968',
      status: 'autorizada',
      emitente: company,
      destinatario: {
        razaoSocial: conta.contato.nome,
        cnpj: conta.contato.numeroDocumento || '14.289.471/0001-35',
        cidade: 'São Paulo',
        uf: 'SP',
      },
      itens: [
        {
          id: 'i1',
          descricao: conta.historico || 'Venda de Mercadorias',
          quantidade: 1,
          unidade: 'UN',
          valorUnitario: conta.valor,
          valorTotal: conta.valor,
          ncm: '8481.80.99',
          cfop: '5.102',
        }
      ],
      valorProdutos: conta.valor,
      valorTotal: conta.valor,
      valorTotalFormatado: conta.valorFormatado,
      quantidadeParcelas: 1,
      parcelas: [parcelaSimulada],
      banco: bancoAtual,
    };

    setSelectedParcelaForBoleto({ parcela: parcelaSimulada, nfe: nfeSimulada });
  };

  const handleQuickAction = (actionText: string) => {
    if (actionText === 'start_voice') {
      handleStartListening();
      return;
    }
    if (actionText === 'view_demo_danfe') {
      if (messages[0]?.nfeData) {
        setSelectedNFeForDanfe(messages[0].nfeData);
      }
      return;
    }
    if (actionText === 'go_clientes') {
      setActiveTab('clientes');
      return;
    }
    if (actionText === 'go_receber') {
      setActiveTab('receber');
      return;
    }
    if (actionText.startsWith('danfe_')) {
      const num = actionText.replace('danfe_', '');
      const found = messages.find(m => m.nfeData?.numeroNFe === num)?.nfeData;
      if (found) setSelectedNFeForDanfe(found);
      return;
    }
    if (actionText === 'boleto_1') {
      const lastNfe = [...messages].reverse().find(m => m.nfeData)?.nfeData;
      if (lastNfe && lastNfe.parcelas.length > 0) {
        setSelectedParcelaForBoleto({ parcela: lastNfe.parcelas[0], nfe: lastNfe });
      }
      return;
    }
    handleProcessUserCommand(actionText);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Header Superior Claro */}
      <Header
        bancoAtual={bancoAtual}
        onSelectBanco={handleSelectBanco}
        ttsEnabled={ttsEnabled}
        onToggleTts={handleToggleTts}
        onOpenSettings={() => setIsSettingsOpen(true)}
        empresaNome={company.nomeFantasia || company.razaoSocial}
        isBlingConnected={isBlingLive || !!getStoredBlingToken()}
      />

      {/* Alerta de Retorno OAuth do Bling */}
      {blingAlert && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span>🟢</span>
            <span>{blingAlert}</span>
          </div>
          <button
            onClick={() => setBlingAlert(null)}
            className="text-white/80 hover:text-white text-sm font-black px-1.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner Informativo quando Bling não estiver conectado */}
      {!isBlingLive && !getStoredBlingToken() && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs flex items-center justify-between text-amber-900 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Bling não conectado:</strong> Insira o Token de Acesso ou Client Secret para sincronizar seus clientes e contas reais.
            </span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg transition shrink-0 ml-2 shadow-sm active:scale-95"
          >
            Conectar Bling
          </button>
        </div>
      )}

      {/* Conteúdo Principal Alternado pelas 4 Abas */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Aba 1: Robô */}
        {activeTab === 'robo' && (
          <>
            <ChatView
              messages={messages}
              bancoAtual={bancoAtual}
              onViewDanfe={(nfe) => setSelectedNFeForDanfe(nfe)}
              onEmitirNFe={(nfe) => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.nfeData?.numeroNFe === nfe.numeroNFe
                      ? { ...m, nfeData: { ...nfe, status: 'autorizada' } }
                      : m
                  )
                );
              }}
              onViewBoleto={(parcela, nfe) => setSelectedParcelaForBoleto({ parcela, nfe })}
              onViewPayloadBanco={(payload, parcela) => setSelectedPayloadBanco({ payload, parcela })}
              onQuickAction={handleQuickAction}
            />

            <VoiceMicBar
              isListening={isListening}
              onStartListening={handleStartListening}
              onStopListening={handleStopListening}
              onSendMessage={(text) => handleProcessUserCommand(text, false)}
              listeningTranscript={listeningTranscript}
            />
          </>
        )}

        {/* Aba 2: Clientes */}
        {activeTab === 'clientes' && (
          <ClientesTab
            clientes={clientes}
            isLoading={isLoadingBling}
            isLive={isBlingLive}
            onRefresh={carregarDadosBling}
            onEmitirParaCliente={handleEmitirParaCliente}
          />
        )}

        {/* Aba 3: Contas a Pagar */}
        {activeTab === 'pagar' && (
          <ContasPagarTab
            contas={contasPagar}
            resumo={resumoPagar}
            isLoading={isLoadingBling}
            isLive={isBlingLive}
            onRefresh={carregarDadosBling}
          />
        )}

        {/* Aba 4: Contas a Receber */}
        {activeTab === 'receber' && (
          <ContasReceberTab
            contas={contasReceber}
            resumo={resumoReceber}
            isLoading={isLoadingBling}
            isLive={isBlingLive}
            onRefresh={carregarDadosBling}
            onViewBoletoReceber={handleViewBoletoReceber}
          />
        )}
      </main>

      {/* Barra de Navegação Inferior com as 4 Abas */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        badgeCounts={{
          clientes: clientes.length,
          pagar: contasPagar.filter(c => c.situacao === 1).length,
          receber: contasReceber.filter(c => c.situacao === 1).length,
        }}
      />

      {/* Modais */}
      {selectedNFeForDanfe && (
        <NFeModal
          nfe={selectedNFeForDanfe}
          onClose={() => setSelectedNFeForDanfe(null)}
        />
      )}

      {selectedParcelaForBoleto && (
        <BoletoModal
          parcela={selectedParcelaForBoleto.parcela}
          nfe={selectedParcelaForBoleto.nfe}
          banco={bancoAtual}
          onClose={() => setSelectedParcelaForBoleto(null)}
        />
      )}

      {selectedPayloadBanco && (
        <PayloadModal
          payload={selectedPayloadBanco.payload}
          parcela={selectedPayloadBanco.parcela}
          onClose={() => setSelectedPayloadBanco(null)}
        />
      )}

      {isSettingsOpen && (
        <CompanySettingsModal
          company={company}
          onSave={handleSaveCompany}
          onClose={() => setIsSettingsOpen(false)}
          onBlingConnected={carregarDadosBling}
        />
      )}
    </div>
  );
};

export default App;
