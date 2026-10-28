# ⚡ Dupe CLI

Uma CLI de assistência de código com IA para o terminal inspirada no **Claude Code**, construída em **Node.js + TypeScript** utilizando a **Família Gemini 3** (padrão: `gemini-3.8-flash`), padrão **Agent Loop (ReAct)** com **Function Calling**, paleta futurista **Esmeralda & Menta**, e **suporte híbrido a mouse e teclado**.

---

## 🧠 System Prompt Adaptado do Claude Code

A Dupe utiliza uma arquitetura de prompt estruturada em 4 etapas inspirada no Claude Code:

1. **Exploração & Descoberta (Look Before Leaping):** Inspeciona arquivos (`Search`, `Read`, `listDirectory`) antes de propor qualquer modificação. Nunca assume ou inventa código às cegas.
2. **Implementação Atômica & Robusta:** Código sempre completo e modular, sem comentários preguiçosos (`// TODO`), com TypeScript estrito, Clean Code e tratamento de erros.
3. **Verificação Proativa:** Proatividade para rodar testes, builds ou comandos no terminal com `Bash` e corrigir erros automaticamente caso algo quebre.
4. **Resumo Claro & Pragmático:** Explica de forma concisa o que foi feito e os comandos para rodar ou testar.
5. **Idioma Adaptativo:** Responde naturalmente no idioma do usuário (português do Brasil por padrão), mantendo termos técnicos de engenharia em inglês.

---

## 🎭 Personalidades Alternáveis (`/persona`)

Você pode mudar a postura e o estilo de resposta da Dupe a qualquer momento com o comando `/persona` (ou clicando no botão `[ 🎭 2. /persona ]`):

| Personalidade | Identificador | Estilo de Comunicação |
|---|---|---|
| **Engenheiro Sênior** *(Padrão)* | `senior` | Direto ao ponto, pragmático, 1 frase de contexto e foco em entrega técnica. |
| **Pair Programmer** | `mentor` | Explica decisões de arquitetura, boas práticas, trade-offs e ensina enquanto constrói. |
| **Hacker Minimalista** | `hacker` | Respostas telegráficas, zero enrolação, foco estrito em código e comandos. |

---

## 🖱️ Interação Híbrida (Mouse & Teclado)

Barra de atalhos rápidos interativa no topo do prompt `dupe ❯ `:

```text
[ ⚡ 1. /model ]  [ 🎭 2. /persona ]  [ 🧹 3. /clear ]  [ 💡 4. Sugestões ]  [ 🖱️ 5. /mouse ]  [ 🚪 6. /exit ]
```

- **Clique direto no botão** com o mouse.
- Ou digite o número correspondente (`1` a `6`).
- Ou digite o comando tradicional (ex: `/persona mentor`, `/model gemini-3.1-pro`).

---

## 🚀 Como Executar

### 1. Obtenha sua Gemini API Key
Crie uma chave gratuita no [Google AI Studio](https://aistudio.google.com/app/apikey).

### 2. Inicie a CLI
```bash
npm start
```
*(Se for a primeira vez e você não tiver criado o `.env`, a própria CLI solicitará que você cole sua chave e salvará para você).*

---

## 💡 Comandos Internos

- `/persona` - Exibe menu interativo para alternar o estilo da IA (`senior`, `mentor`, `hacker`).
- `/model` - Alterna entre os modelos Gemini (`gemini-3.8-flash`, `gemini-3.1-pro`, etc.).
- `/clear` - Reinicia a sessão de chat e exibe o card de boas-vindas com o modelo e a personalidade ativa.
- `/mouse` - Alterna ou exibe o status de captura do mouse (`on`/`off`).
- `/exit` - Encerra a Dupe CLI.
