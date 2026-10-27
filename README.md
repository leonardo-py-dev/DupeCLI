# 🚀 Gemini Code CLI

Uma CLI interativa de assistência de código para o terminal no estilo do **Claude Code** e **Codex CLI**, construída em **Node.js + TypeScript** utilizando a **Família Gemini 3** (padrão: `gemini-3.8-flash`) e o padrão de **Agent Loop (ReAct)** com **Function Calling**.

---

## 🏗️ Como Funciona a Arquitetura (Por trás dos panos)

Ferramentas como Claude Code e Codex CLI utilizam um ciclo contínuo de raciocínio e execução local:

```
[ Usuário digita ] ──> [ Gemini API ]
                             │
                             ├─ Solicita Tool Call (ex: readFile, runCommand)
                             ▼
                    [ Execução Local no seu PC ]
                             │
                             ▼
                    [ Envia resultado para o Gemini ]
                             │
                             ▼
                    [ Gemini formula a resposta final ou chama outra tool ]
```

### Componentes:
- **`src/agent.ts`**: O coração do agente. Gerencia o histórico de chat e executa o ciclo de ferramentas até que o modelo decida que tem a resposta final.
- **`src/tools/definitions.ts`**: Declarações OpenAPI das ferramentas que o Gemini pode chamar.
- **`src/tools/handlers.ts`**: Implementação das funções no seu sistema operacional (`readFile`, `writeFile`, `listDirectory`, `runCommand`).
- **`src/index.ts`**: Interface interativa de linha de comando (REPL) com estilo e cores.

---

## 🛠️ Ferramentas Nativas Disponíveis

| Ferramenta | Descrição |
|---|---|
| `readFile` | Lê o conteúdo completo de arquivos do projeto. |
| `writeFile` | Cria ou edita arquivos (cria pastas automaticamente). |
| `listDirectory` | Lista arquivos e pastas ignorando `node_modules` e `.git`. |
| `runCommand` | Executa comandos no PowerShell / Terminal local (`git`, `npm test`, etc.). |

---

## 🚀 Como Executar

### 1. Obtenha sua Gemini API Key
Se ainda não tiver, crie uma chave gratuita no [Google AI Studio](https://aistudio.google.com/app/apikey).

### 2. Inicie a CLI
Você pode iniciar diretamente com:
```bash
npm start
```
*(Se for a primeira vez e você não tiver criado o `.env`, a própria CLI solicitará que você cole sua chave e salvará para você).*

Ou se preferir definir manualmente:
```bash
# Crie seu arquivo .env com a chave:
cp .env.example .env
# Adicione sua chave no .env: GEMINI_API_KEY=sua_chave_aqui
```

### 3. Modo Desenvolvimento (com hot-reload)
```bash
npm run dev
```

---

## 💡 Exemplos de Uso no Terminal

Ao abrir o terminal, você verá o prompt interativo `❯`:

- **Explorar código:**
  ```text
  ❯ Quais arquivos existem neste diretório?
  ```
- **Criar novos recursos:**
  ```text
  ❯ Crie um arquivo fibonacci.ts com função recursiva e com memoization
  ```
- **Executar e testar:**
  ```text
  ❯ Execute o fibonacci.ts usando tsx e me mostre o resultado
  ```
- **Comandos internos:**
  - `/model` - Exibe menu interativo para alternar entre modelos Gemini (ou `/model gemini-2.5-pro`).
  - `/clear` - Reinicia o histórico e inicia uma nova sessão com o card de boas-vindas.
  - `/help` - Exibe comandos úteis.
  - `/exit` - Encerra a CLI.

---

## 🧩 Como Adicionar Novas Ferramentas

Para adicionar uma nova ferramenta (ex: `searchFiles` ou `gitDiff`):
1. Adicione a assinatura do schema em `src/tools/definitions.ts`.
2. Adicione a função executora em `src/tools/handlers.ts`.
3. O Gemini automaticamente saberá como e quando usá-la!
