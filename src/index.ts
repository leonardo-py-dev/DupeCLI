#!/usr/bin/env node
import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';
import { CodeAgent } from './agent.js';
import {
  renderWelcomeCard,
  renderFileCreationPreview,
  AVAILABLE_MODELS,
} from './ui.js';

async function checkOrPromptApiKey(rl: readline.Interface): Promise<string> {
  let apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    return apiKey.trim();
  }

  console.log(pc.yellow('\n⚠️  Nenhuma GEMINI_API_KEY encontrada no ambiente ou no arquivo .env'));
  console.log(pc.dim('Você pode obter uma chave gratuita em: ') + pc.underline(pc.cyan('https://aistudio.google.com/app/apikey')) + '\n');

  const enteredKey = await rl.question(pc.bold(pc.cyan('Cole sua Gemini API Key aqui: ')));
  const cleanKey = enteredKey.trim();

  if (!cleanKey) {
    console.log(pc.red('\nChave não informada. Encerrando CLI.\n'));
    process.exit(1);
  }

  const envPath = path.resolve(process.cwd(), '.env');
  try {
    await fs.writeFile(envPath, `GEMINI_API_KEY=${cleanKey}\n`, 'utf-8');
    console.log(pc.green('✔ Chave salva com sucesso em .env para as próximas execuções!\n'));
  } catch {
    // Continua mesmo se não conseguir salvar
  }

  process.env.GEMINI_API_KEY = cleanKey;
  return cleanKey;
}

async function confirmFileWrite(
  rl: readline.Interface,
  agent: CodeAgent,
  filePath: string,
  content: string
): Promise<boolean> {
  const fileName = path.basename(filePath);
  renderFileCreationPreview(filePath, content);

  console.log(pc.white(`Do you want to create ${pc.bold(fileName)}?`));
  console.log(pc.white(pc.bold('❯ 1. Yes')));
  console.log(pc.dim('  2. Yes, allow all edits in this directory/ during this session (shift+tab)'));
  console.log(pc.dim('  3. No\n'));

  const answer = await rl.question(pc.dim('❯ '));
  const clean = answer.trim().toLowerCase();

  if (clean === '2') {
    agent.allowAllEdits = true;
    console.log(pc.dim('  ✔ Permissão concedida para todas as edições nesta sessão.\n'));
    return true;
  }

  if (clean === '3' || clean === 'no' || clean === 'n') {
    return false;
  }

  // Padrão: 1 ou Enter
  return true;
}

async function handleModelCommand(
  rl: readline.Interface,
  agent: CodeAgent,
  arg?: string
): Promise<void> {
  const cleanArg = arg?.trim();

  // Caso 1: Usuário passou argumento direto (ex: /model gemini-2.5-pro ou /model 2)
  if (cleanArg) {
    const num = parseInt(cleanArg, 10);
    if (!isNaN(num) && num >= 1 && num <= AVAILABLE_MODELS.length) {
      const selected = AVAILABLE_MODELS[num - 1].id;
      agent.setModel(selected);
      console.log(pc.green(`\n✔ Modelo alterado para: ${pc.bold(selected)}\n`));
      return;
    }

    // Nome customizado direto
    agent.setModel(cleanArg);
    console.log(pc.green(`\n✔ Modelo alterado para: ${pc.bold(cleanArg)}\n`));
    return;
  }

  // Caso 2: Usuário digitou apenas /model -> Exibe menu interativo
  console.log(pc.white(pc.bold('\nModelos Gemini (Família 3):')));
  AVAILABLE_MODELS.forEach((m, idx) => {
    const isCurrent = m.id === agent.getModel();
    const bullet = isCurrent ? pc.cyan('●') : pc.dim('○');
    const badge = isCurrent ? pc.cyan(' (ativo)') : '';
    console.log(
      `  ${bullet} ${pc.bold(`${idx + 1}. ${m.id}`)}${badge}` +
      `\n     ${pc.dim(m.description)}`
    );
  });
  console.log(pc.dim(`  ○ ${AVAILABLE_MODELS.length + 1}. Consultar todos os modelos ativos na sua conta da API (tempo real)...`));
  console.log(pc.dim(`  ○ ${AVAILABLE_MODELS.length + 2}. Digitar outro modelo manualmente...\n`));

  const choice = await rl.question(pc.dim(`Escolha uma opção [1-${AVAILABLE_MODELS.length + 2} ou Enter para manter]: `));
  const cleanChoice = choice.trim();

  if (!cleanChoice) {
    console.log(pc.dim(`Mantido o modelo atual: ${agent.getModel()}\n`));
    return;
  }

  const choiceNum = parseInt(cleanChoice, 10);
  if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= AVAILABLE_MODELS.length) {
    const selected = AVAILABLE_MODELS[choiceNum - 1].id;
    agent.setModel(selected);
    console.log(pc.green(`\n✔ Modelo alterado para: ${pc.bold(selected)}\n`));
  } else if (choiceNum === AVAILABLE_MODELS.length + 1) {
    console.log(pc.cyan('\nConsultando modelos disponíveis na API do Google...'));
    const remoteModels = await agent.listRemoteModels();
    if (remoteModels.length === 0) {
      console.log(pc.yellow('Não foi possível listar os modelos da API remota. Verifique sua chave.\n'));
      return;
    }

    console.log(pc.bold('\nModelos retornados pela sua conta:'));
    remoteModels.slice(0, 20).forEach((name, i) => {
      console.log(`  ${pc.cyan(String(i + 1).padStart(2, ' '))}. ${name}`);
    });

    const subChoice = await rl.question(pc.dim('\nDigite o número ou o nome do modelo: '));
    const subClean = subChoice.trim();
    const subNum = parseInt(subClean, 10);
    if (!isNaN(subNum) && subNum >= 1 && subNum <= remoteModels.length) {
      const selected = remoteModels[subNum - 1];
      agent.setModel(selected);
      console.log(pc.green(`\n✔ Modelo alterado para: ${pc.bold(selected)}\n`));
    } else if (subClean) {
      agent.setModel(subClean);
      console.log(pc.green(`\n✔ Modelo alterado para: ${pc.bold(subClean)}\n`));
    }
  } else if (choiceNum === AVAILABLE_MODELS.length + 2) {
    const custom = await rl.question(pc.dim('Digite o ID do modelo (ex: gemini-3.8-flash): '));
    const cleanCustom = custom.trim();
    if (cleanCustom) {
      agent.setModel(cleanCustom);
      console.log(pc.green(`\n✔ Modelo alterado para: ${pc.bold(cleanCustom)}\n`));
    }
  } else {
    // Tratado como nome direto digitado
    agent.setModel(cleanChoice);
    console.log(pc.green(`\n✔ Modelo alterado para: ${pc.bold(cleanChoice)}\n`));
  }
}

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    await checkOrPromptApiKey(rl);

    const agent = new CodeAgent();

    console.clear();
    renderWelcomeCard({
      version: 'v2.1.9',
      model: agent.getModel(),
      billing: 'API Usage Billing',
      folder: `~/${path.basename(process.cwd())}`,
    });

    while (true) {
      const userInput = await rl.question(pc.dim(') '));
      const trimmed = userInput.trim();

      if (!trimmed) {
        continue;
      }

      if (trimmed === '/exit' || trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log(pc.dim('\nAté logo! 👋\n'));
        break;
      }

      if (trimmed === '/clear') {
        agent.resetChat();
        console.clear();
        renderWelcomeCard({
          version: 'v2.1.9',
          model: agent.getModel(),
          billing: 'API Usage Billing',
          folder: `~/${path.basename(process.cwd())}`,
        });
        continue;
      }

      if (trimmed.startsWith('/model')) {
        const parts = trimmed.split(/\s+/);
        const modelArg = parts.slice(1).join(' ');
        await handleModelCommand(rl, agent, modelArg);
        continue;
      }

      console.log('');
      await agent.run(trimmed, async (filePath, content) => {
        return await confirmFileWrite(rl, agent, filePath, content);
      });
      console.log('');
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(pc.red('Erro fatal:'), err);
  process.exit(1);
});
