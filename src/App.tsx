import React, { useState } from 'react';
import type { BankProvider, ChatMessage, CompanyProfile, Installment, NFeData } from './types';
import { Header } from './components/Header';
import { ChatView } from './components/ChatView';
import { VoiceMicBar } from './components/VoiceMicBar';
import { NFeModal } from './components/NFeModal';
import { BoletoModal } from './components/BoletoModal';
import { PayloadModal } from './components/PayloadModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { criarNFeDeComando, interpretarComandoVoz } from './utils/aiParser';
import { speechEngine } from './utils/speechEngine';

export const App: React.FC = () => {
  // Dados da Empresa Emitente Padrão
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

  const [selectedNFeForDanfe, setSelectedNFeForDanfe] = useState<NFeData | null>(null);
  const [selectedParcelaForBoleto, setSelectedParcelaForBoleto] = useState<{ parcela: Installment; nfe: NFeData } | null>(null);
  const [selectedPayloadBanco, setSelectedPayloadBanco] = useState<{ payload: object; parcela: Installment } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [blingAlert, setBlingAlert] = useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      localStorage.setItem('bling_auth_code', code);
      setBlingAlert(`Código de autorização OAuth do Bling recebido com sucesso!`);
      speechEngine.playBeep('success');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Mensagens do Chat
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Mensagem inicial de boas-vindas demonstrando o robô pronto
    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Comando exemplo pronto para demonstrar
    const cmdExemplo = 'Olha, eu quero criar uma nota fiscal de venda de produtos da minha empresa para a empresa Silva Materiais no valor de R$ 3.000 em 3 parcelas';
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
              'Você pode simplesmente **falar no microfone** dizendo o que vendeu, para qual empresa e a quantidade de parcelas. Eu calculo as parcelas na hora, divido os centavos sem erro e já gero a prévia da **Nota Fiscal (NF-e)** e a **Linha Digitável / Boletos** para o seu banco!\n\n' +
              'Veja um exemplo prático pronto abaixo:',
        timestamp: agora,
        nfeData: nfeDemo,
        quickActions: [
          { label: '🎙️ Testar outro comando por voz', action: 'start_voice' },
          { label: '📄 Ver DANFE da Nota', action: 'view_demo_danfe' },
          { label: '🏦 Trocar Banco para Asaas', action: 'mudar_banco_asaas' },
        ],
      }
    ];
  });

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

  // Processar comando de voz ou texto
  const handleProcessUserCommand = (textoComando: string, isFromVoice: boolean = false) => {
    if (!textoComando.trim()) return;

    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `usr-${Date.now()}`;

    // Adiciona mensagem do usuário no chat
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textoComando,
      timestamp: agora,
      isAudio: isFromVoice,
    };

    setMessages((prev) => [...prev, userMsg]);

    // O Robô interpreta com IA e calcula NF-e + Parcelas + Códigos Bancários
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
          { label: '💳 Ver 1º Boleto Registrado', action: `boleto_1` },
          { label: '🔄 Dividir em 4x', action: `Dividir essa nota de ${parsed.destinatarioNome} em 4 parcelas` },
        ],
      };

      setMessages((prev) => [...prev, botMsg]);

      // Toca som de sucesso e fala em português se TTS estiver ativo
      speechEngine.playBeep('success');
      if (ttsEnabled) {
        speechEngine.speak(
          `Nota fiscal para ${parsed.destinatarioNome} preparada em ${parsed.quantidadeParcelas} parcelas. Os códigos bancários estão prontos para envio!`
        );
      }
    }, 450);
  };

  // Iniciar gravação de voz
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

  // Parar gravação de voz
  const handleStopListening = () => {
    speechEngine.stopListening();
    setIsListening(false);
    if (listeningTranscript.trim().length > 3) {
      handleProcessUserCommand(listeningTranscript, true);
    }
  };

  // Tratamento de ações rápidas clicadas nos balões
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
    if (actionText === 'mudar_banco_asaas') {
      handleSelectBanco('asaas');
      handleProcessUserCommand('Quero emitir a nota no Banco Asaas');
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

    // Se for texto livre de comando rápido
    handleProcessUserCommand(actionText);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-brand-500 selection:text-black">
      {/* Header Superior Mobile */}
      <Header
        bancoAtual={bancoAtual}
        onSelectBanco={handleSelectBanco}
        ttsEnabled={ttsEnabled}
        onToggleTts={handleToggleTts}
        onOpenSettings={() => setIsSettingsOpen(true)}
        empresaNome={company.nomeFantasia || company.razaoSocial}
      />

      {/* Alerta de Integração Bling OAuth */}
      {blingAlert && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-lg">
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

      {/* Área Central de Conversa (Chat & Cards) */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatView
          messages={messages}
          bancoAtual={bancoAtual}
          onViewDanfe={(nfe) => setSelectedNFeForDanfe(nfe)}
          onEmitirNFe={(nfe) => {
            // Atualiza status da nota nas mensagens
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
      </main>

      {/* Barra Flutuante Inferior de Microfone e Entrada */}
      <VoiceMicBar
        isListening={isListening}
        onStartListening={handleStartListening}
        onStopListening={handleStopListening}
        onSendMessage={(text) => handleProcessUserCommand(text, false)}
        listeningTranscript={listeningTranscript}
      />

      {/* Modais da Aplicação */}
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
        />
      )}
    </div>
  );
};

export default App;
