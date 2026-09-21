# 🤖 Robô Fiscal & Boletos por Voz (Mobile PWA)

> Aplicação mobile com inteligência artificial para emissão automatizada de **Notas Fiscais Eletrônicas (NF-e)** de venda, divisão inteligente de parcelas e geração instantânea de **Boletos Bancários Febraban** e **Bolepix** via comandos de voz e texto.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

## 🌟 Funcionalidades Principais

- 🎙️ **Comandos por Voz em Linguagem Natural**: Basta falar *"Olha, eu quero criar uma nota fiscal de venda de produtos da minha empresa para a empresa Silva Materiais no valor de R$ 3.000 em 3 parcelas"*.
- 🗣️ **Síntese de Fala (Text-to-Speech)**: O robô responde em voz alta em português do Brasil após processar e emitir os documentos.
- 📄 **Emissão de NF-e e DANFE SEFAZ**:
  - Geração de Chave de Acesso de 44 dígitos no padrão SEFAZ.
  - Visualizador oficial do DANFE com impressão e exportação para PDF.
- 💳 **Motor Financeiro & Parcelamento Febraban**:
  - Divisão exata de parcelas sem perda de centavos (dízima balanceada na 1ª parcela).
  - Cálculo automático de datas de vencimento (30, 60, 90 dias) prorrogando para dias úteis bancários em finais de semana.
  - Geração de **Linha Digitável (47 dígitos)** e **Código de Barras Febraban (44 dígitos)**.
  - Geração de **Pix Copia e Cola (Bolepix)** com QR Code integrado.
  - Payload JSON estruturado pronto para envio às APIs do **Banco Inter, Asaas, Cora, Itaú, Bradesco e Sicoob**.
- 🟢 **Integração com Bling ERP (API v3 / OAuth 2.0)**:
  - Captura automática do `code` de autorização de redirecionamento.
  - URL de Callback pronta para aprovação e liberação no painel de desenvolvedores do Bling.

---

## 🚀 Como Hospedar na Vercel

1. Faça o fork ou clone deste repositório no seu GitHub.
2. Acesse [vercel.com](https://vercel.com) e clique em **Add New Project**.
3. Importe o repositório `nfe-boleto-mobile`.
4. Mantenha o Framework Preset como **Vite** (já configurado via `vercel.json`).
5. Clique em **Deploy**!

A Vercel fornecerá uma URL pública com SSL:
```
https://nfe-boleto-mobile.vercel.app
```

---

## 🔑 Configuração no Bling ERP

Para que o Bling libere as credenciais da API v3 no seu painel de desenvolvedor:

1. Acesse o portal de desenvolvedores do Bling e crie o seu aplicativo.
2. No campo **URL do Aplicativo**, informe:
   ```
   https://seu-app.vercel.app
   ```
3. No campo **URL de Redirecionamento (Callback URI)**, informe:
   ```
   https://seu-app.vercel.app/oauth/callback
   ```
4. Salve e copie o **Client ID** e o **Client Secret** fornecidos pelo Bling.
5. No app, clique no ícone de **Configurações ⚙️** e informe as credenciais.

---

## 🛠️ Tecnologias Utilizadas

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v3** (Interface dark moderna e responsiva para celular)
- **Web Speech API** (STT para escuta do microfone e TTS para fala)
- **Febraban Engine** (Cálculo de módulos 10/11, fator de vencimento e linhas digitáveis)
- **Lucide Icons** & **Canvas Confetti**
