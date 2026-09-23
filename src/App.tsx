import React, { useState, useEffect, useRef } from 'react';
import type {
  BankProvider,
  ChatMessage,
  CompanyProfile,
  Installment,
  NFeData,
  BlingCliente,
  BlingFornecedor,
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
  obterDadosEmpresaBling,
  sincronizarEmpresaBlingCompleto,
  obterClientesCacheLocal,
  obterFornecedoresCacheLocal,
  obterContasPagarCacheLocal,
  obterContasReceberCacheLocal,
} from './services/blingService';
import {
  exchangeBlingCodeForToken,
} from './utils/blingApi';

export const App: React.FC = () => {
  // Lista de Empresas (Multi-Empresas Bling)
  const [empresas, setEmpresas] = useState<EmpresaTenant[]>(() => {
    const tokenAtual = localStorage.getItem('bling_access_token') || '';
    const refreshTokenAtual = localStorage.getItem('bling_refresh_token') || undefined;
    const clientIdAtual = localStorage.getItem('bling_client_id') || '';
    const clientSecretAtual = localStorage.getItem('bling_client_secret') || '';
    const saved = localStorage.getItem('nfe_empresas_list');

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Limpa dados de demonstração residuais caso ainda estejam no localStorage
          const limpas = parsed.map((e: EmpresaTenant) => {
            const isDemo = e.razaoSocial?.includes('BRASIL TECH') || e.cnpj === '24.912.830/0001-52';
            // Recupera credenciais isoladas da empresa ou backfill da empresa inicial caso não tenha
            const token = e.blingAccessToken || (e.id === 'emp_default_1' ? tokenAtual : '') || '';
            const rToken = e.blingRefreshToken || (e.id === 'emp_default_1' ? refreshTokenAtual : undefined);
            const cId = e.blingClientId || (e.id === 'emp_default_1' ? clientIdAtual : '') || '';
            const cSec = e.blingClientSecret || (e.id === 'emp_default_1' ? clientSecretAtual : '') || '';

            // Se possui token ou refresh token, a integração permanece conectada
            const temChaveValida = Boolean(token || rToken);
            const isConectado = temChaveValida && e.isBlingConectado !== false;

            return {
              ...e,
              razaoSocial: isDemo ? 'Empresa Bling ERP' : e.razaoSocial,
              nomeFantasia: isDemo ? 'Minha Empresa' : (e.nomeFantasia || 'Minha Empresa'),
              cnpj: isDemo ? '' : (e.cnpj || ''),
              blingAccessToken: token,
              blingRefreshToken: rToken,
              blingClientId: cId,
              blingClientSecret: cSec,
              isBlingConectado: isConectado,
              isBlingExpirado: false, // Reset preventivo no boot: auto-refresh tratará reativamente
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
      blingClientId: clientIdAtual,
      blingClientSecret: clientSecretAtual,
      blingAccessToken: tokenAtual,
      blingRefreshToken: refreshTokenAtual,
      isBlingConectado: Boolean(tokenAtual || refreshTokenAtual),
      isBlingExpirado: false,
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
  const [fornecedores, setFornecedores] = useState<BlingFornecedor[]>([]);
  const [contasPagar, setContasPagar] = useState<BlingContaPagar[]>([]);
  const [contasReceber, setContasReceber] = useState<BlingContaReceber[]>([]);
  const [isLoadingBling, setIsLoadingBling] = useState<boolean>(false);

  // Mensagens do Chat do Robô (100% limpo, sem conteúdo fake)
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Mantém estado das empresas sincronizado quando tokens expiram ou são renovados
  useEffect(() => {
    const handleEmpresasUpdated = () => {
      const raw = localStorage.getItem('nfe_empresas_list');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEmpresas(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('nfe_empresas_updated', handleEmpresasUpdated);
    return () => window.removeEventListener('nfe_empresas_updated', handleEmpresasUpdated);
  }, []);

  // Sincroniza dados cadastrais reais da empresa através do endpoint oficial do Bling (/empresas/me/dados-basicos)
  const sincronizarEmpresaDoBling = async (empresaId: string, tokenParam?: string) => {
    const targetEmpresa = empresas.find((e) => e.id === empresaId);
    const token = (tokenParam || targetEmpresa?.blingAccessToken || '').trim();
    if (!token) return;

    try {
      const dados = await obterDadosEmpresaBling(token, empresaId);
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
                isBlingExpirado: false,
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

  // Sincronização sob demanda apenas para a empresa ativa (evita chamadas concorrentes contra o Bling)
  useEffect(() => {
    if (empresaAtivaId) {
      const ativa = empresas.find((e) => e.id === empresaAtivaId);
      if (ativa?.blingAccessToken && !ativa.isBlingExpirado && !ativa.cnpj) {
        sincronizarEmpresaDoBling(ativa.id, ativa.blingAccessToken.trim());
      }
    }
  }, [empresaAtivaId]);

  // Listener para sincronização em background e atualizações de cache
  useEffect(() => {
    const handleSyncUpdate = () => {
      const saved = localStorage.getItem('nfe_empresas_list');
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) {
            setEmpresas(list);
          }
        } catch {}
      }
    };
    window.addEventListener('bling_sync_update', handleSyncUpdate);
    window.addEventListener('storage', handleSyncUpdate);
    return () => {
      window.removeEventListener('bling_sync_update', handleSyncUpdate);
      window.removeEventListener('storage', handleSyncUpdate);
    };
  }, []);

  // Carrega dados do Bling para a empresa ativa com Local-First rigoroso
  const carregarDadosBling = async (customToken?: string, empIdParam?: string, _customBanco?: BankProvider, forceSync: boolean = false) => {
    const empId = empIdParam || empresaAtiva?.id;
    const token = (customToken !== undefined ? customToken : (empresaAtiva?.blingAccessToken || '')).trim();

    if (!empId) return;

    // 1. Local-First: Carrega IMEDIATAMENTE do cache local (0ms de espera e 0 requisições)
    const clientesCache = obterClientesCacheLocal(empId);
    const fornecedoresCache = obterFornecedoresCacheLocal(empId);
    const pagarCache = obterContasPagarCacheLocal(empId);
    const receberCache = obterContasReceberCacheLocal(empId);

    setClientes(clientesCache);
    setFornecedores(fornecedoresCache);
    setContasPagar(pagarCache);
    setContasReceber(receberCache);

    // Se esta empresa não tem token próprio configurado, encerra
    if (!token) {
      setIsLoadingBling(false);
      return;
    }

    // Se os dados locais estiverem vazios ou foi solicitada sincronização explícita:
    const precisaSincronizar = forceSync || (clientesCache.length === 0 && pagarCache.length === 0);
    if (precisaSincronizar) {
      const empAlvo = empresas.find((e) => e.id === empId) || (empresaAtiva?.id === empId ? empresaAtiva : null);
      if (empAlvo) {
        setIsLoadingBling(true);
        try {
          const res = await sincronizarEmpresaBlingCompleto(empAlvo);
          if (res.sucesso) {
            setClientes(res.clientes);
            setFornecedores(res.fornecedores);
            setContasPagar(obterContasPagarCacheLocal(empId));
            setContasReceber(obterContasReceberCacheLocal(empId));
          }
        } catch {
          // Erro de rede tratado silenciosamente
        } finally {
          setIsLoadingBling(false);
        }
      }
    } else {
      setIsLoadingBling(false);
    }
  };

  // Ao selecionar uma empresa nos cards
  const handleSelectEmpresa = (empresa: EmpresaTenant) => {
    setEmpresaAtivaId(empresa.id);
    localStorage.setItem('nfe_empresa_ativa_id', empresa.id);

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

    // Atualiza ou limpa as credenciais ativas do navegador estritamente para esta empresa
    if (empresa.blingAccessToken) {
      localStorage.setItem('bling_access_token', empresa.blingAccessToken);
    } else {
      localStorage.removeItem('bling_access_token');
    }

    if (empresa.blingClientId) {
      localStorage.setItem('bling_client_id', empresa.blingClientId);
    } else {
      localStorage.removeItem('bling_client_id');
    }

    if (empresa.blingClientSecret) {
      localStorage.setItem('bling_client_secret', empresa.blingClientSecret);
    } else {
      localStorage.removeItem('bling_client_secret');
    }

    if (empresa.blingRefreshToken) {
      localStorage.setItem('bling_refresh_token', empresa.blingRefreshToken);
    } else {
      localStorage.removeItem('bling_refresh_token');
    }

    // Carrega instantaneamente do cache local
    const clientesCache = obterClientesCacheLocal(empresa.id);
    const fornecedoresCache = obterFornecedoresCacheLocal(empresa.id);
    const pagarCache = obterContasPagarCacheLocal(empresa.id);
    const receberCache = obterContasReceberCacheLocal(empresa.id);

    setClientes(clientesCache);
    setFornecedores(fornecedoresCache);
    setContasPagar(pagarCache);
    setContasReceber(receberCache);

    // Se tiver token mas nunca sincronizou (cache zerado), dispara sincronização gradual em background
    if (empresa.blingAccessToken && clientesCache.length === 0 && pagarCache.length === 0) {
      sincronizarEmpresaBlingCompleto(empresa).then((res) => {
        if (res.sucesso) {
          setClientes(res.clientes);
          setFornecedores(res.fornecedores);
          setContasPagar(obterContasPagarCacheLocal(empresa.id));
          setContasReceber(obterContasReceberCacheLocal(empresa.id));
        }
      });
    }
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

  // Trava para evitar que o React StrictMode ou re-renders executem o mesmo código OAuth duas vezes
  const codeJaProcessadoRef = useRef<string | null>(null);

  // Monitora retorno OAuth do Bling e vincula estritamente à empresa alvo (via state ou pending ID)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const stateParam = params.get('state');

    if (code) {
      if (codeJaProcessadoRef.current === code) {
        return;
      }
      codeJaProcessadoRef.current = code;

      // Limpa imediatamente da URL para evitar requisições concorrentes ou re-execuções
      window.history.replaceState({}, document.title, window.location.pathname);

      localStorage.setItem('bling_auth_code', code);
      const pendingEmpresaId = localStorage.getItem('bling_oauth_pending_empresa_id');
      const targetEmpresaId = stateParam && stateParam !== 'login' && stateParam !== 'cb9768157cff9aef9675a82bdd68c5e4' 
        ? stateParam 
        : (pendingEmpresaId || empresaAtivaId);

      localStorage.removeItem('bling_oauth_pending_empresa_id');

      const rawList = localStorage.getItem('nfe_empresas_list');
      let listaEmpresas: EmpresaTenant[] = [];
      if (rawList) {
        try {
          listaEmpresas = JSON.parse(rawList);
        } catch {}
      }

      // Recupera credenciais isoladas da empresa que estava pendente de conexão
      let pendingCreds: { clientId?: string; clientSecret?: string } = {};
      if (targetEmpresaId) {
        const rawPending = localStorage.getItem(`bling_pending_${targetEmpresaId}`);
        if (rawPending) {
          try {
            pendingCreds = JSON.parse(rawPending);
          } catch {}
        }
      }

      const existingTarget = listaEmpresas.find((e) => e.id === targetEmpresaId) || empresas.find((e) => e.id === targetEmpresaId);

      const clientSecret = pendingCreds.clientSecret || existingTarget?.blingClientSecret || (targetEmpresaId === 'emp_default_1' ? localStorage.getItem('bling_client_secret') : '') || '';
      const clientId = pendingCreds.clientId || existingTarget?.blingClientId || (targetEmpresaId === 'emp_default_1' ? localStorage.getItem('bling_client_id') : '') || '';

      console.log('Trocando código de autorização por token de acesso no Bling para a empresa:', targetEmpresaId);
      exchangeBlingCodeForToken(code, clientId, clientSecret, targetEmpresaId || undefined).then(async (res) => {
        if (targetEmpresaId) {
          localStorage.removeItem(`bling_pending_${targetEmpresaId}`);
        }

        if (res.success && res.accessToken) {
          console.log('Conta do Bling conectada com sucesso! Token gerado:', res.accessToken.slice(0, 10));

          // Busca dados cadastrais da empresa recém-conectada
          let dadosBling: any = null;
          try {
            dadosBling = await obterDadosEmpresaBling(res.accessToken, targetEmpresaId || undefined);
          } catch {}

          const nomeDetectado = dadosBling?.nomeFantasia || dadosBling?.razaoSocial;
          const cnpjDetectado = dadosBling?.cnpj;

          setEmpresas((prev) => {
            let found = false;
            const atualizadas = prev.map((e) => {
              if (targetEmpresaId && e.id === targetEmpresaId) {
                found = true;
                return {
                  ...e,
                  nomeFantasia: nomeDetectado || e.nomeFantasia,
                  razaoSocial: dadosBling?.razaoSocial || e.razaoSocial,
                  cnpj: cnpjDetectado || e.cnpj,
                  cidade: dadosBling?.cidade || e.cidade,
                  uf: dadosBling?.uf || e.uf,
                  blingAccessToken: res.accessToken || '',
                  blingRefreshToken: res.refreshToken || e.blingRefreshToken,
                  blingClientId: clientId,
                  blingClientSecret: clientSecret,
                  blingTokenExpiresAt: res.expiresAt || (Date.now() + 21600 * 1000),
                  isBlingConectado: true,
                  isBlingExpirado: false,
                  ultimaSincronizacao: new Date().toISOString(),
                };
              }
              return e;
            });

            // Se for uma nova empresa que estava sendo adicionada
            if (!found && targetEmpresaId) {
              const nova: EmpresaTenant = {
                id: targetEmpresaId,
                nomeFantasia: nomeDetectado || 'Empresa Bling ERP',
                razaoSocial: dadosBling?.razaoSocial || nomeDetectado || 'Empresa Bling ERP',
                cnpj: cnpjDetectado || '00.000.000/0001-00',
                cidade: dadosBling?.cidade || 'São Paulo',
                uf: dadosBling?.uf || 'SP',
                bancoPadrao: 'inter',
                corAvatar: 'emerald',
                regimeTributario: 'Simples Nacional',
                certificadoA1Valido: true,
                criadoEm: new Date().toISOString(),
                blingAccessToken: res.accessToken || '',
                blingRefreshToken: res.refreshToken,
                blingClientId: clientId,
                blingClientSecret: clientSecret,
                blingTokenExpiresAt: res.expiresAt || (Date.now() + 21600 * 1000),
                isBlingConectado: true,
                isBlingExpirado: false,
                ultimaSincronizacao: new Date().toISOString(),
              };
              atualizadas.push(nova);
            }

            localStorage.setItem('nfe_empresas_list', JSON.stringify(atualizadas));

            // Seleciona a empresa recém-conectada e atualiza o estado com isolamento
            const recemConectada = atualizadas.find((e) => e.id === targetEmpresaId);
            if (recemConectada) {
              handleSelectEmpresa(recemConectada);
              carregarDadosBling(res.accessToken, recemConectada.id, undefined, true);
            }

            return atualizadas;
          });

          alert(`🎉 Sucesso! A conta do Bling da empresa "${nomeDetectado || 'Empresa Bling'}" foi conectada com sucesso sem alterar as outras!`);
        } else {
          console.error(`Erro ao autenticar: ${res.error}`);
          alert(`⚠️ Aviso ao autenticar no Bling:\n\n${res.error}\n\nDica: Se você possui duas contas diferentes no Bling, faça logout da conta atual no Bling antes de autorizar a segunda empresa.`);
        }
      });
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

  const handleSaveCompany = (
    updated: CompanyProfile,
    blingTokens?: {
      token: string;
      clientId: string;
      clientSecret: string;
      refreshToken?: string;
      expiresAt?: number;
    }
  ) => {
    setCompany(updated);
    localStorage.setItem('nfe_company_profile', JSON.stringify(updated));

    // Atualiza também na lista de empresas
    if (empresaAtivaId) {
      setEmpresas((prev) => {
        const atualizadas = prev.map((e) => {
          if (e.id === empresaAtivaId) {
            const tokenFinal = blingTokens?.token !== undefined
              ? blingTokens.token
              : (e.blingAccessToken || localStorage.getItem('bling_access_token') || '');
            const cId = blingTokens?.clientId !== undefined
              ? blingTokens.clientId
              : (e.blingClientId || localStorage.getItem('bling_client_id') || '');
            const cSec = blingTokens?.clientSecret !== undefined
              ? blingTokens.clientSecret
              : (e.blingClientSecret || localStorage.getItem('bling_client_secret') || '');
            const rToken = blingTokens?.refreshToken !== undefined
              ? blingTokens.refreshToken
              : (e.blingRefreshToken || localStorage.getItem('bling_refresh_token') || '');
            const expAt = blingTokens?.expiresAt !== undefined
              ? blingTokens.expiresAt
              : (e.blingTokenExpiresAt || (localStorage.getItem('bling_expires_at') ? Number(localStorage.getItem('bling_expires_at')) : undefined));

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
              blingAccessToken: tokenFinal,
              blingClientId: cId,
              blingClientSecret: cSec,
              blingRefreshToken: rToken,
              blingTokenExpiresAt: expAt,
              isBlingConectado: Boolean(tokenFinal),
              isBlingExpirado: false,
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
            const res = await sincronizarEmpresaBlingCompleto(emp);
            if (res.sucesso && empresaAtivaId === emp.id) {
              setClientes(res.clientes);
              setFornecedores(res.fornecedores);
              setContasPagar(obterContasPagarCacheLocal(emp.id));
              setContasReceber(obterContasReceberCacheLocal(emp.id));
            }
          }}
          onDisconnectBling={(empId) => {
            setEmpresas((prev) => {
              const atualizadas = prev.map((e) =>
                e.id === empId
                  ? {
                      ...e,
                      blingAccessToken: '',
                      blingRefreshToken: undefined,
                      blingTokenExpiresAt: undefined,
                      isBlingConectado: false,
                    }
                  : e
              );
              localStorage.setItem('nfe_empresas_list', JSON.stringify(atualizadas));
              return atualizadas;
            });
          }}
          onUpdateEmpresaBanco={(empId, banco) => {
            setEmpresas((prev) => {
              const atualizadas = prev.map((e) =>
                e.id === empId ? { ...e, bancoPadrao: banco } : e
              );
              localStorage.setItem('nfe_empresas_list', JSON.stringify(atualizadas));
              return atualizadas;
            });
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
        fornecedores={fornecedores}
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
          empresa={empresaAtiva || undefined}
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
