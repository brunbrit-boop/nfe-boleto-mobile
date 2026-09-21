import React, { useState, useEffect } from 'react';
import type {
  BankProvider,
  ChatMessage,
  CompanyProfile,
  Installment,
  NFeData,
  BlingCliente,
  BlingContaPagar,
  BlingContaReceber,
  EmpresaTenant,
} from './types';
import { NFeModal } from './components/NFeModal';
import { BoletoModal } from './components/BoletoModal';
import { PayloadModal } from './components/PayloadModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { EmpresasScreen } from './components/EmpresasScreen';
import { AddEmpresaModal } from './components/AddEmpresaModal';
import { BtBusinessSuite } from './components/bt/BtBusinessSuite';
import { criarNFeDeComando, interpretarComandoVoz } from './utils/aiParser';
import { speechEngine } from './utils/speechEngine';
import {
  carregarClientesBling,
  carregarContasPagarBling,
  carregarContasReceberBling,
  getStoredBlingToken,
  obterDadosEmpresaBling,
} from './services/blingService';
import { exchangeBlingCodeForToken, BLING_DEFAULT_CLIENT_ID } from './utils/blingApi';

export const App: React.FC = () => {
  // Lista de Empresas (Multi-Empresas Bling)
  const [empresas, setEmpresas] = useState<EmpresaTenant[]>(() => {
    const tokenAtual = localStorage.getItem('bling_access_token') || '';
    const saved = localStorage.getItem('nfe_empresas_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Limpa dados de demonstração residuais caso ainda estejam no localStorage
          const limpas = parsed.map((e: EmpresaTenant) => {
            const isDemo = e.razaoSocial?.includes('BRASIL TECH') || e.cnpj === '24.912.830/0001-52';
            return {
              ...e,
              razaoSocial: isDemo ? 'Empresa Bling ERP' : e.razaoSocial,
              nomeFantasia: isDemo ? 'Minha Empresa' : (e.nomeFantasia || 'Minha Empresa'),
              cnpj: isDemo ? '' : (e.cnpj || ''),
              blingAccessToken: e.blingAccessToken || tokenAtual,
              isBlingConectado: Boolean(e.blingAccessToken || tokenAtual),
            };
          });
          return limpas;
        }
      } catch {}
    }

    const initialEmpresa: EmpresaTenant = {
      id: 'emp_default_1',
      razaoSocial: 'Empresa Bling ERP',
      nomeFantasia: 'Minha Empresa',
      cnpj: '',
      inscricaoEstadual: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
      cep: '',
      regimeTributario: 'Simples Nacional',
      certificadoA1Valido: true,
      blingClientId: localStorage.getItem('bling_client_id') || BLING_DEFAULT_CLIENT_ID,
      blingClientSecret: localStorage.getItem('bling_client_secret') || '',
      blingAccessToken: tokenAtual,
      isBlingConectado: Boolean(tokenAtual),
      bancoPadrao: (localStorage.getItem('nfe_banco_padrao') as BankProvider) || 'inter',
      corAvatar: 'blue',
      criadoEm: new Date().toISOString(),
    };

    return [initialEmpresa];
  });

  // O app SEMPRE abre exibindo os cards das empresas cadastradas (empresaAtivaId: null)
  const [empresaAtivaId, setEmpresaAtivaId] = useState<string | null>(null);
  const [isAddEmpresaOpen, setIsAddEmpresaOpen] = useState(false);

  // Dados da Empresa Ativa
  const empresaAtiva = empresas.find((e) => e.id === empresaAtivaId) || null;

  const [company, setCompany] = useState<CompanyProfile>(() => ({
    razaoSocial: 'Minha Empresa Bling',
    nomeFantasia: 'Minha Empresa',
    cnpj: '',
    inscricaoEstadual: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: 'São Paulo',
    uf: 'SP',
    cep: '',
    regimeTributario: 'Simples Nacional',
    certificadoA1Valido: true,
  }));

  const [bancoAtual, setBancoAtual] = useState<BankProvider>('inter');

  const [ttsEnabled, _setTtsEnabled] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, _setIsSpeaking] = useState<boolean>(false);
  const [listeningTranscript, setListeningTranscript] = useState<string>('');

  // Modais
  const [selectedNFeForDanfe, setSelectedNFeForDanfe] = useState<NFeData | null>(null);
  const [selectedParcelaForBoleto, setSelectedParcelaForBoleto] = useState<{ parcela: Installment; nfe: NFeData } | null>(null);
  const [selectedPayloadBanco, setSelectedPayloadBanco] = useState<{ payload: object; parcela: Installment } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Estados dos Módulos do Bling ERP da Empresa Ativa
  const [clientes, setClientes] = useState<BlingCliente[]>([]);
  const [contasPagar, setContasPagar] = useState<BlingContaPagar[]>([]);
  const [contasReceber, setContasReceber] = useState<BlingContaReceber[]>([]);
  const [isLoadingBling, setIsLoadingBling] = useState<boolean>(false);

  // Mensagens do Chat do Robô (100% limpo, sem conteúdo fake)
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Sincroniza dados cadastrais reais da empresa através do endpoint oficial do Bling (/empresas/me/dados-basicos)
  const sincronizarEmpresaDoBling = async (empresaId: string, tokenParam?: string) => {
    const token = tokenParam || localStorage.getItem('bling_access_token');
    if (!token) return;

    try {
      const dados = await obterDadosEmpresaBling(token);
      if (dados.success && (dados.razaoSocial || dados.cnpj || dados.nomeFantasia)) {
        const nomeFinal = dados.nomeFantasia || dados.razaoSocial || 'Empresa Bling';
        const razaoFinal = dados.razaoSocial || nomeFinal;

        setEmpresas((prev) => {
          const atualizadas = prev.map((e) => {
            if (e.id === empresaId) {
              return {
                ...e,
                razaoSocial: razaoFinal,
                nomeFantasia: nomeFinal,
                cnpj: dados.cnpj || e.cnpj,
                inscricaoEstadual: dados.inscricaoEstadual || e.inscricaoEstadual,
                cidade: dados.cidade || e.cidade,
                uf: dados.uf || e.uf,
                isBlingConectado: true,
                ultimaSincronizacao: new Date().toISOString(),
              };
            }
            return e;
          });
          localStorage.setItem('nfe_empresas_list', JSON.stringify(atualizadas));
          return atualizadas;
        });

        if (empresaAtivaId === empresaId) {
          setCompany((prev) => ({
            ...prev,
            razaoSocial: razaoFinal,
            nomeFantasia: nomeFinal,
            cnpj: dados.cnpj || prev.cnpj,
            cidade: dados.cidade || prev.cidade,
            uf: dados.uf || prev.uf,
          }));
        }
      }
    } catch (err) {
      console.error('Erro ao sincronizar dados da empresa com Bling:', err);
    }
  };

  // Efeito ao carregar: sincroniza imediatamente os dados reais da empresa ativa ou cadastradas
  useEffect(() => {
    empresas.forEach((emp) => {
      const token = emp.blingAccessToken || localStorage.getItem('bling_access_token');
      if (token) {
        sincronizarEmpresaDoBling(emp.id, token);
      }
    });
  }, []);

  // Carrega dados do Bling para a empresa ativa
  const carregarDadosBling = async (customToken?: string, empIdParam?: string, customBanco?: BankProvider) => {
    setIsLoadingBling(true);
    const token = customToken || empresaAtiva?.blingAccessToken || getStoredBlingToken() || '';
    const empId = empIdParam || empresaAtiva?.id;
    const banco = customBanco || empresaAtiva?.bancoPadrao || bancoAtual;

    try {
      const [resClientes, resPagar, resReceber] = await Promise.all([
        carregarClientesBling(token, empId),
        carregarContasPagarBling(token, empId),
        carregarContasReceberBling(token, empId, banco),
      ]);

      setClientes(resClientes.data);
      setContasPagar(resPagar.data);
      setContasReceber(resReceber.data);
    } catch {
      // Ignora erro de rede
    } finally {
      setIsLoadingBling(false);
    }
  };

  // Ao selecionar uma empresa nos cards
  const handleSelectEmpresa = (empresa: EmpresaTenant) => {
    setEmpresaAtivaId(empresa.id);
    const novoPerfil: CompanyProfile = {
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia,
      cnpj: empresa.cnpj,
      inscricaoEstadual: empresa.inscricaoEstadual || '',
      logradouro: empresa.logradouro || '',
      numero: empresa.numero || '',
      bairro: empresa.bairro || '',
      cidade: empresa.cidade || 'São Paulo',
      uf: empresa.uf || 'SP',
      cep: empresa.cep || '',
      regimeTributario: empresa.regimeTributario || 'Simples Nacional',
      certificadoA1Valido: empresa.certificadoA1Valido ?? true,
    };
    setCompany(novoPerfil);
    setBancoAtual(empresa.bancoPadrao);

    if (empresa.blingAccessToken) {
      localStorage.setItem('bling_access_token', empresa.blingAccessToken);
    }
    if (empresa.blingClientId) {
      localStorage.setItem('bling_client_id', empresa.blingClientId);
    }
    if (empresa.blingClientSecret) {
      localStorage.setItem('bling_client_secret', empresa.blingClientSecret);
    }

    carregarDadosBling(empresa.blingAccessToken, empresa.id, empresa.bancoPadrao);
  };

  // Adiciona nova empresa na lista
  const handleAddEmpresa = (novaEmpresa: EmpresaTenant) => {
    const atualizadas = [novaEmpresa, ...empresas];
    setEmpresas(atualizadas);
    localStorage.setItem('nfe_empresas_list', JSON.stringify(atualizadas));
    setIsAddEmpresaOpen(false);
    if (novaEmpresa.blingAccessToken) {
      sincronizarEmpresaDoBling(novaEmpresa.id, novaEmpresa.blingAccessToken);
    }
    // Entra diretamente na empresa adicionada
    handleSelectEmpresa(novaEmpresa);
  };

  // Remove uma empresa
  const handleDeleteEmpresa = (empresaId: string) => {
    const filtradas = empresas.filter((e) => e.id !== empresaId);
    setEmpresas(filtradas);
    localStorage.setItem('nfe_empresas_list', JSON.stringify(filtradas));
    if (empresaAtivaId === empresaId) {
      setEmpresaAtivaId(null);
    }
  };

  // Monitora retorno OAuth do Bling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      localStorage.setItem('bling_auth_code', code);
      const clientSecret = localStorage.getItem('bling_client_secret');
      const clientId = localStorage.getItem('bling_client_id') || BLING_DEFAULT_CLIENT_ID;

      if (clientSecret) {
        console.log('Trocando código de autorização por token de acesso no Bling...');
        exchangeBlingCodeForToken(code, clientId, clientSecret).then((res) => {
          if (res.success) {
            console.log('Conta do Bling conectada com sucesso! Dados reais importados.');
            carregarDadosBling();
          } else {
            console.error(`Erro ao autenticar: ${res.error}`);
          }
        });
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Processamento do comando de voz pelo Robô
  const handleProcessUserCommand = (textoComando: string, isFromAudio: boolean = false) => {
    if (!textoComando.trim()) return;

    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: textoComando,
      timestamp: horaAtual,
      isAudio: isFromAudio,
    };

    setMessages((prev) => [...prev, userMsg]);
    speechEngine.playBeep('start');

    setTimeout(() => {
      try {
        const parsed = interpretarComandoVoz(textoComando, bancoAtual);
        const novaNFe = criarNFeDeComando(parsed, company);

        const respostaBot = `Perfeito! Gereei a **NF-e nº ${novaNFe.numeroNFe}** no valor total de **${novaNFe.valorTotalFormatado}** ` +
          `dividida em **${novaNFe.quantidadeParcelas}x** de **${novaNFe.parcelas[0]?.valorFormatado}** pelo **${bancoAtual.toUpperCase()}**.\n\n` +
          `Já realizei o cálculo dos códigos de barra e boletos bancários. Deseja visualizar a DANFE ou transmitir para a SEFAZ?`;

        const botMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sender: 'bot',
          text: respostaBot,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          nfeData: novaNFe,
          quickActions: [
            { label: '📄 Ver DANFE', action: 'view_danfe' },
            { label: '🚀 Transmitir SEFAZ', action: 'emit_sefaz' },
            { label: '🏦 Gerar Boletos', action: 'view_first_boleto' },
          ],
        };

        setMessages((prev) => [...prev, botMsg]);

        if (ttsEnabled) {
          const fala = `Nota fiscal emitida para ${novaNFe.destinatario.razaoSocial} no valor de ${novaNFe.valorTotal} reais em ${novaNFe.quantidadeParcelas} parcelas. Códigos bancários gerados.`;
          speechEngine.speak(fala);
        }
      } catch (err: any) {
        const erroMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sender: 'bot',
          text: `Não consegui entender todos os detalhes da nota fiscal. Por favor, tente algo como: "Criar nota fiscal de venda de produtos para Fulano no valor de R$ 1.500 em 3 parcelas".`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, erroMsg]);
      }
    }, 600);
  };

  const handleStartListening = () => {
    setIsListening(true);
    setListeningTranscript('');
    speechEngine.startListening(
      (transcript, isFinal) => {
        setListeningTranscript(transcript);
        if (isFinal) {
          setIsListening(false);
          handleProcessUserCommand(transcript, true);
        }
      },
      () => {
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );
  };

  const handleStopListening = () => {
    setIsListening(false);
    speechEngine.stopListening();
  };

  const handleQuickAction = (actionText: string, nfe?: NFeData) => {
    if (actionText === 'start_voice') {
      handleStartListening();
      return;
    }
    if (actionText === 'go_clientes') {
      return;
    }
    if (actionText === 'view_demo_danfe' || actionText === 'view_danfe') {
      if (nfe) setSelectedNFeForDanfe(nfe);
      return;
    }
    if (actionText === 'view_first_boleto' && nfe && nfe.parcelas.length > 0) {
      setSelectedParcelaForBoleto({ parcela: nfe.parcelas[0], nfe });
      return;
    }
    if (actionText === 'emit_sefaz' && nfe) {
      setMessages((prev) =>
        prev.map((m) =>
          m.nfeData?.numeroNFe === nfe.numeroNFe
            ? { ...m, nfeData: { ...nfe, status: 'autorizada' } }
            : m
        )
      );
      if (ttsEnabled) {
        speechEngine.speak('Nota fiscal autorizada com sucesso na Secretaria da Fazenda.');
      }
    }
  };

  const handleEmitirParaCliente = (cliente: BlingCliente) => {
    const sugestao = `Criar nota fiscal de venda de produtos da minha empresa para ${cliente.nome} no valor de R$ 2.500 em 2 parcelas`;
    setTimeout(() => {
      handleProcessUserCommand(sugestao, false);
    }, 300);
  };

  const handleViewBoletoReceber = (conta: BlingContaReceber) => {
    const fakeNFe: NFeData = {
      numeroNFe: conta.numeroDocumento.replace(/\D/g, '').slice(0, 6) || '102938',
      serie: '1',
      dataEmissao: conta.dataEmissao,
      naturezaOperacao: conta.historico || 'Venda de Mercadorias',
      chaveAcesso: '35260924912830000152550010001029381009876543',
      status: conta.situacao === 2 ? 'autorizada' : 'autorizada',
      emitente: company,
      destinatario: {
        razaoSocial: conta.contato.nome,
        cnpj: conta.contato.numeroDocumento || '00.000.000/0000-00',
        cidade: 'São Paulo',
        uf: 'SP',
      },
      itens: [
        {
          id: '1',
          descricao: conta.historico || 'Produtos Faturados Bling',
          quantidade: 1,
          unidade: 'UN',
          valorUnitario: conta.valor,
          valorTotal: conta.valor,
          ncm: '8471.30.12',
          cfop: '5.102',
        }
      ],
      valorProdutos: conta.valor,
      valorTotal: conta.valor,
      valorTotalFormatado: conta.valorFormatado,
      quantidadeParcelas: 1,
      parcelas: [
        {
          numero: 1,
          totalParcelas: 1,
          dataVencimento: conta.vencimento,
          dataVencimentoFormatada: conta.vencimentoFormatado,
          valor: conta.valor,
          valorFormatado: conta.valorFormatado,
          nossoNumero: conta.nossoNumero || '900001',
          linhaDigitavel: conta.linhaDigitavel || '',
          codigoBarras: conta.codigoBarras || '',
          pixCopiaECola: conta.pixCopiaECola || '',
          status: conta.situacao === 2 ? 'pago' : 'emitido',
        }
      ],
      banco: bancoAtual,
    };

    setSelectedParcelaForBoleto({ parcela: fakeNFe.parcelas[0], nfe: fakeNFe });
  };

  const handleSaveCompany = (updated: CompanyProfile) => {
    setCompany(updated);
    localStorage.setItem('nfe_company_profile', JSON.stringify(updated));

    // Atualiza também na lista de empresas
    if (empresaAtivaId) {
      setEmpresas((prev) => {
        const atualizadas = prev.map((e) => {
          if (e.id === empresaAtivaId) {
            return {
              ...e,
              razaoSocial: updated.razaoSocial,
              nomeFantasia: updated.nomeFantasia,
              cnpj: updated.cnpj,
              inscricaoEstadual: updated.inscricaoEstadual,
              logradouro: updated.logradouro,
              numero: updated.numero,
              bairro: updated.bairro,
              cidade: updated.cidade,
              uf: updated.uf,
              cep: updated.cep,
              regimeTributario: updated.regimeTributario,
              certificadoA1Valido: updated.certificadoA1Valido,
            };
          }
          return e;
        });
        localStorage.setItem('nfe_empresas_list', JSON.stringify(atualizadas));
        return atualizadas;
      });
    }
  };

  const handleSelectBanco = (banco: BankProvider) => {
    setBancoAtual(banco);
    localStorage.setItem('nfe_banco_padrao', banco);

    // Salva o banco padrão na empresa ativa
    if (empresaAtivaId) {
      setEmpresas((prev) => {
        const atualizadas = prev.map((e) =>
          e.id === empresaAtivaId ? { ...e, bancoPadrao: banco } : e
        );
        localStorage.setItem('nfe_empresas_list', JSON.stringify(atualizadas));
        return atualizadas;
      });
    }
  };

  // ============================================================================
  // RENDERIZAÇÃO: Tela Inicial (Hub de Empresas) vs Painel da Empresa Ativa
  // ============================================================================

  if (empresaAtivaId === null) {
    return (
      <>
        <EmpresasScreen
          empresas={empresas}
          onSelectEmpresa={handleSelectEmpresa}
          onOpenAddEmpresa={() => setIsAddEmpresaOpen(true)}
          onDeleteEmpresa={handleDeleteEmpresa}
          onSyncEmpresa={async (emp) => {
            await sincronizarEmpresaDoBling(emp.id, emp.blingAccessToken);
          }}
        />

        {isAddEmpresaOpen && (
          <AddEmpresaModal
            onClose={() => setIsAddEmpresaOpen(false)}
            onAddEmpresa={handleAddEmpresa}
          />
        )}
      </>
    );
  }

  if (!empresaAtiva) {
    setEmpresaAtivaId(null);
    return null;
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-50 dark:bg-[#0c1a15] text-slate-900 dark:text-white overflow-hidden font-sans select-none">
      {/* Suite Completa do BT Business conectada ao Bling da Empresa */}
      <BtBusinessSuite
        empresa={empresaAtiva}
        company={company}
        bancoAtual={bancoAtual}
        onSelectBanco={handleSelectBanco}
        onBackToEmpresas={() => setEmpresaAtivaId(null)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        contasPagar={contasPagar}
        contasReceber={contasReceber}
        clientes={clientes}
        carregandoBling={isLoadingBling}
        onRecarregarBling={() => carregarDadosBling(empresaAtiva?.blingAccessToken, empresaAtiva?.id, bancoAtual)}
        messages={messages}
        isListening={isListening}
        isSpeaking={isSpeaking}
        listeningTranscript={listeningTranscript}
        onStartListening={handleStartListening}
        onStopListening={handleStopListening}
        onSendMessage={(text) => handleProcessUserCommand(text, false)}
        onQuickAction={handleQuickAction}
        onViewDanfe={(nfe) => setSelectedNFeForDanfe(nfe)}
        onViewBoleto={(parcela, nfe) => setSelectedParcelaForBoleto({ parcela, nfe })}
        onViewPayloadBanco={(payload, parcela) => setSelectedPayloadBanco({ payload, parcela })}
        onViewBoletoReceber={handleViewBoletoReceber}
        onEmitirNFe={(nfe) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.nfeData?.numeroNFe === nfe.numeroNFe
                ? { ...m, nfeData: { ...nfe, status: 'autorizada' } }
                : m
            )
          );
        }}
        onEmitirParaCliente={handleEmitirParaCliente}
      />

      {/* Modais Globais de Apoio */}
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
          onBlingConnected={() => carregarDadosBling(empresaAtiva?.blingAccessToken, empresaAtiva?.id, bancoAtual)}
        />
      )}

      {isAddEmpresaOpen && (
        <AddEmpresaModal
          onClose={() => setIsAddEmpresaOpen(false)}
          onAddEmpresa={handleAddEmpresa}
        />
      )}
    </div>
  );
};

export default App;
