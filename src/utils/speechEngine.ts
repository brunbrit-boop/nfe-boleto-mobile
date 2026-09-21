/**
 * Gerenciador de Áudio, Reconhecimento de Voz (STT) e Síntese de Fala (TTS)
 */

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

// Declaração de tipo para Web Speech API
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export class SpeechEngine {
  private recognition: any = null;
  private isListening: boolean = false;
  private audioCtx: AudioContext | null = null;
  private ttsEnabled: boolean = true;

  constructor() {
    const win = window as unknown as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRec) {
      this.recognition = new SpeechRec();
      this.recognition.lang = 'pt-BR';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
    }
  }

  public isSupported(): boolean {
    return !!this.recognition;
  }

  public setTtsEnabled(enabled: boolean) {
    this.ttsEnabled = enabled;
  }

  public getTtsEnabled(): boolean {
    return this.ttsEnabled;
  }

  /**
   * Toca um bip suave de início ou confirmação usando Web Audio API
   */
  public playBeep(tipo: 'start' | 'success' | 'error' = 'start') {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (tipo === 'start') {
        osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.2);
      } else if (tipo === 'success') {
        osc.frequency.setValueAtTime(523.25, this.audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, this.audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, this.audioCtx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.09, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.35);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.25);
      }
    } catch {
      // Ignora erro de áudio se bloqueado pelo browser
    }
  }

  /**
   * Inicia a escuta de voz do microfone
   */
  public startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (err: string) => void,
    onEnd: () => void
  ) {
    if (!this.recognition) {
      onError('Reconhecimento de voz não suportado neste navegador. Utilize o campo de texto ou o Google Chrome.');
      return;
    }

    if (this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignora
      }
    }

    this.playBeep('start');

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      onResult(text, !!finalTranscript);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.isListening = false;
      this.playBeep('error');
      onError(event.error === 'not-allowed' ? 'Permissão de microfone negada no navegador.' : `Erro no microfone: ${event.error}`);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    try {
      this.recognition.start();
    } catch (e: any) {
      this.isListening = false;
      onError('Não foi possível iniciar o microfone.');
    }
  }

  /**
   * Para a escuta do microfone
   */
  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignora
      }
      this.isListening = false;
    }
  }

  /**
   * Faz o robô falar em português (Text-to-Speech)
   */
  public speak(text: string) {
    if (!this.ttsEnabled || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel(); // Para fala anterior se houver

      // Remove markdown para voz limpa
      const textToSpeak = text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/R\$\s*([\d.]+),(\d{2})/g, '$1 reais e $2 centavos')
        .replace(/NF-e/gi, 'Nota Fiscal Eletrônica')
        .replace(/x\b/gi, 'vezes');

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05; // Velocidade agradável e dinâmica
      utterance.pitch = 1.0;

      // Tenta selecionar uma voz em português do Brasil
      const voices = window.speechSynthesis.getVoices();
      const ptBrVoice = voices.find(v => v.lang === 'pt-BR' || v.lang === 'pt_BR');
      if (ptBrVoice) {
        utterance.voice = ptBrVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignora se bloqueado
    }
  }

  public stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechEngine = new SpeechEngine();
