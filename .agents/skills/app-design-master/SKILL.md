---
name: app-design-master
description: Diretrizes obrigatórias de UI/UX minimalista para criação e evolução de aplicativos. Usar sempre que criar ou modificar telas, botões, cards, diálogos e navegação. Enfatiza textos curtos (máximo 2 a 3 palavras), proibição de textos explicativos secundários desnecessários, priorização de ícones e layouts limpos para telas compactas.
---

# Mestre de Criação de Apps (UI/UX Minimalista)

Este documento define a cartilha de estilo, usabilidade e concisão visual para todos os aplicativos desenvolvidos no Antigravity. Todos os agentes devem consultar e seguir estas regras rigorosamente ao desenhar ou alterar componentes de interface.

---

## 1. Filosofia Central: "Menos é Mais"
- **Sem Enrolação Visual**: Telas de aplicativos profissionais devem ser limpas, diretas e intuitivas.
- **Proibido Explicar o Óbvio**: Nunca adicione textos explicativos secundários, subtítulos cinzas ou avisos redundantes para funções que o usuário já compreende intuitivamente.
- **Foco na Agilidade**: Menos leitura significa operação mais rápida, especialmente em dispositivos compactos, smartphones e maquininhas POS.

---

## 2. Nomenclatura e Textos (Naming)
- **Regra de Ouro (Títulos e Botões)**: Máximo de **2 a 3 palavras**.
  -  **Correto**: "Gerenciar Portaria", "Alterar PIN", "Sair da Conta", "Nova Encomenda".
  - ❌ **Evitar**: "Gerenciar Porteiros e Escalas de Plantão da Equipe", "Alterar PIN de Administrador (4 Dígitos)", "Desconectar condomínio ou trocar de aparelho".
- **Sem Parênteses Explicativos**: Não coloque instruções entre parênteses dentro de botões ou títulos. Deixe a instrução (se necessária) apenas no diálogo de ação quando o usuário clicar.
- **Textos Secundários Apenas Quando Críticos**: Subtítulos cinzas ou notas explicativas só devem existir se houver risco real de perda de dados irreversível ou ambiguidade severa. Caso contrário, delete.

---

## 3. Priorização de Ícones
- **Ícones Valem Mais que Parágrafos**: Sempre combine um ícone universal com um label curto em vez de usar texto longo.
  - Ícone de crachá/usuários + "Gerenciar Portaria".
  - Ícone de chave/cadeado + "Alterar PIN".
  - Ícone de logout + "Sair da Conta".
- **Sem Ícones Decorativos Desnecessários**: O ícone deve ter propósito funcional e orientar o olho do usuário rapidamente.

---

## 4. Estrutura de Layout e Densidade
- **Ações Diretas sem Inflar**: Se uma seção é apenas um ponto de partida para outra tela ou modal, use um botão ou item de lista limpo diretamente. Não crie um card volumoso com cabeçalho, ícone gigante e botão aninhado dentro dele.
- **Evitar Poluição de Bordas e Sombras**: Manter superfícies limpas, bordas sutis (1.dp) e espaçamentos consistentes (8.dp a 16.dp).
- **Projetado para Telas Compactas**: Menos rolagem vertical desnecessária. O conteúdo principal deve estar acessível logo ao abrir a tela.

---

## 5. Como Revisitar e Expandir Esta Skill
Esta skill é um documento vivo:
- Toda nova diretriz visual ou preferência de experiência do usuário deve ser acrescentada diretamente neste arquivo sob uma nova seção temática.
- Para novos projetos: basta copiar esta pasta `app-design-master` da pasta `skills universais` para a pasta `.agents/skills/` do novo projeto.
