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
  terminalLink,
  emerald,
  mint,
} from './ui.js';
import {
  AVAILABLE_PERSONAS,
  PersonaType,
} from './prompt.js';
import {
  mouseSystem,
  promptWithMouse,
  renderButtonBar,
  ClickableRegion,
  ButtonDef,
} from './mouse.js';

async function checkOrPromptApiKey(rl: readline.Interface): Promise<string> {
  let apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    return apiKey.trim();
  }

  const aiStudioUrl = 'https://aistudio.google.com/app/apikey';
  console.log(pc.yellow('\n⚠️  Nenhuma GEMINI_API_KEY encontrada no ambiente ou no arquivo .env'));
  console.log(
    pc.dim('Você pode obter uma chave gratuita clicando em: ') +
    terminalLink(aiStudioUrl, pc.underline(mint(aiStudioUrl))) +
    '\n'
  );

  const enteredKey = await rl.question(pc.bold(emerald('Cole sua Gemini API Key aqui: ')));
  const cleanKey = enteredKey.trim();

  if (!cleanKey) {
    console.log(pc.red('\nChave não informada. Encerrando Dupe CLI.\n'));
    process.exit(1);
  }

  const envPath = path.resolve(process.cwd(), '.env');
  try {
    await fs.writeFile(envPath, `GEMINI_API_KEY=${cleanKey}\n`, 'utf-8');
    console.log(emerald('✔ Chave salva com sucesso em .env para as próximas execuções!\n'));
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

  console.log(pc.white(`Do you want to create ${pc.bold(fileName)}?`) + pc.dim(' (clique em uma opção ou digite 1, 2 ou 3)\n'));

  const buttons: ButtonDef[] = [
    { id: 'btn-yes', label: '1. Yes', value: '1', variant: 'emerald' },
    { id: 'btn-allow-all', label: '2. Allow All (Sessão)', value: '2', variant: 'secondary' },
    { id: 'btn-no', label: '3. No', value: '3', variant: 'danger' },
  ];

  const { renderedText: buttonBar, buttonsWithBounds } = renderButtonBar(buttons, 2);

  const lines: string[] = [];
  const buttonBarIdx = lines.length;
  lines.push(buttonBar);
  lines.push(''); // blank line
  const opt1Idx = lines.length;
  lines.push(pc.white(pc.bold('  ❯ 1. Yes')));
  const opt2Idx = lines.length;
  lines.push(pc.dim('    2. Yes, allow all edits in this directory/ during this session (shift+tab)'));
  const opt3Idx = lines.length;
  lines.push(pc.dim('    3. No'));
  lines.push(''); // blank line before prompt

  // Print menu
  for (const l of lines) {
    console.log(l);
  }

  // Calculate relative rows from prompt line (prompt is line 0)
  const totalLines = lines.length;
  const regions: ClickableRegion[] = [];

  // Register button bar buttons
  const buttonBarRelRow = buttonBarIdx - totalLines;
  for (const b of buttonsWithBounds) {
    regions.push({
      id: b.id,
      label: b.label,
      relativeRow: buttonBarRelRow,
      startCol: b.startCol,
      endCol: b.endCol,
      toleranceRows: 0,
      value: b.value,
    });
  }

  // Register full line options
  regions.push({
    id: 'line-yes',
    label: '1. Yes',
    relativeRow: opt1Idx - totalLines,
    toleranceRows: 0,
    value: '1',
  });
  regions.push({
    id: 'line-allow-all',
    label: '2. Allow All',
    relativeRow: opt2Idx - totalLines,
    toleranceRows: 0,
    value: '2',
  });
  regions.push({
    id: 'line-no',
    label: '3. No',
    relativeRow: opt3Idx - totalLines,
    toleranceRows: 0,
    value: '3',
  });

  const { answer } = await promptWithMouse(rl, pc.dim('❯ '), regions, {
    onRegionClicked: (reg) => {
      console.log(mint(`✔ [Selecionado]: ${reg.label || reg.value}`));
    },
  });

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

async function handlePersonaCommand(
  rl: readline.Interface,
  agent: CodeAgent,
  arg?: string
): Promise<void> {
  const cleanArg = arg?.trim().toLowerCase();

  if (cleanArg) {
    const num = parseInt(cleanArg, 10);
    if (!isNaN(num) && num >= 1 && num <= AVAILABLE_PERSONAS.length) {
      const selected = AVAILABLE_PERSONAS[num - 1];
      agent.setPersona(selected.id);
      console.log(emerald(`\n✔ Personalidade alterada para: ${pc.bold(selected.name)} (${selected.badge})\n`));
      return;
    }

    const found = AVAILABLE_PERSONAS.find(
      (p) => p.id === cleanArg || p.name.toLowerCase().includes(cleanArg) || p.badge.toLowerCase().includes(cleanArg)
    );
    if (found) {
      agent.setPersona(found.id);
      console.log(emerald(`\n✔ Personalidade alterada para: ${pc.bold(found.name)} (${found.badge})\n`));
      return;
    }
  }

  // Interactive selection menu with mouse and keyboard
  console.log(
    pc.white(pc.bold('\nPersonalidades da Dupe:')) +
    pc.dim(' (Clique em uma opção ou digite o número)\n')
  );

  const buttonDefs: ButtonDef[] = AVAILABLE_PERSONAS.map((p, idx) => ({
    id: `chip-persona-${idx + 1}`,
    label: `${idx + 1}. ${p.badge}`,
    value: String(idx + 1),
    variant: p.id === agent.getPersona() ? 'emerald' : 'secondary',
  }));

  const { renderedText: buttonBar, buttonsWithBounds } = renderButtonBar(buttonDefs, 2);

  const lines: string[] = [];
  const barLineIdx = lines.length;
  lines.push(buttonBar);
  lines.push(''); // blank line

  const personaLineRanges: Array<{ idx: number; startIdx: number; endIdx: number; id: string }> = [];

  AVAILABLE_PERSONAS.forEach((p, idx) => {
    const isCurrent = p.id === agent.getPersona();
    const bullet = isCurrent ? mint('●') : pc.dim('○');
    const badge = isCurrent ? mint(' (ativa)') : '';
    const num = idx + 1;

    const startIdx = lines.length;
    lines.push(`  ${bullet} ${pc.bold(`${num}. ${p.name}`)} - ${pc.dim(p.badge)}${badge}`);
    const endIdx = lines.length;
    lines.push(`     ${pc.dim(p.description)}`);

    personaLineRanges.push({ idx: num, startIdx, endIdx, id: p.id });
  });
  lines.push(''); // blank line before prompt

  for (const l of lines) {
    console.log(l);
  }

  const totalLines = lines.length;
  const regions: ClickableRegion[] = [];

  // Button bar buttons
  const barRelRow = barLineIdx - totalLines;
  for (const b of buttonsWithBounds) {
    regions.push({
      id: b.id,
      label: b.label,
      relativeRow: barRelRow,
      startCol: b.startCol,
      endCol: b.endCol,
      toleranceRows: 0,
      value: b.value,
    });
  }

  // Persona lines
  for (const r of personaLineRanges) {
    regions.push({
      id: `persona-${r.idx}`,
      label: r.id,
      relativeStartRow: r.startIdx - totalLines,
      relativeEndRow: r.endIdx - totalLines,
      toleranceRows: 0,
      value: String(r.idx),
    });
  }

  const promptText = pc.dim(`Escolha uma personalidade [1-${AVAILABLE_PERSONAS.length} ou Enter para manter]: `);
  const { answer: choice } = await promptWithMouse(rl, promptText, regions, {
    onRegionClicked: (reg) => {
      console.log(mint(`✔ [Selecionado]: ${reg.label || reg.value}`));
    },
  });

  const cleanChoice = choice.trim();
  if (!cleanChoice) {
    const current = AVAILABLE_PERSONAS.find((p) => p.id === agent.getPersona())?.name || agent.getPersona();
    console.log(pc.dim(`Mantida a personalidade atual: ${current}\n`));
    return;
  }

  const choiceNum = parseInt(cleanChoice, 10);
  if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= AVAILABLE_PERSONAS.length) {
    const selected = AVAILABLE_PERSONAS[choiceNum - 1];
    agent.setPersona(selected.id);
    console.log(emerald(`\n✔ Personalidade alterada para: ${pc.bold(selected.name)} (${selected.badge})\n`));
  } else {
    const found = AVAILABLE_PERSONAS.find(
      (p) => p.id === cleanChoice || p.name.toLowerCase().includes(cleanChoice) || p.badge.toLowerCase().includes(cleanChoice)
    );
    if (found) {
      agent.setPersona(found.id);
      console.log(emerald(`\n✔ Personalidade alterada para: ${pc.bold(found.name)} (${found.badge})\n`));
    }
  }
}

async function handleModelCommand(
  rl: readline.Interface,
  agent: CodeAgent,
  arg?: string
): Promise<void> {
  const cleanArg = arg?.trim();

  // Caso 1: Usuário passou argumento direto (ex: /model gemini-3.5-flash ou /model 2)
  if (cleanArg) {
    const num = parseInt(cleanArg, 10);
    if (!isNaN(num) && num >= 1 && num <= AVAILABLE_MODELS.length) {
      const selected = AVAILABLE_MODELS[num - 1].id;
      agent.setModel(selected);
      console.log(emerald(`\n✔ Modelo alterado para: ${pc.bold(selected)}\n`));
      return;
    }

    // Nome customizado direto
    agent.setModel(cleanArg);
    console.log(emerald(`\n✔ Modelo alterado para: ${pc.bold(cleanArg)}\n`));
    return;
  }

  // Caso 2: Menu interativo
  console.log(
    pc.white(pc.bold('\nModelos Gemini Disponíveis:')) +
    pc.dim(' (Clique em qualquer modelo ou digite o número)\n')
  );

  const buttonDefs: ButtonDef[] = AVAILABLE_MODELS.map((m, idx) => ({
    id: `chip-${idx + 1}`,
    label: `${idx + 1}. ${m.name.replace('Gemini ', '')}`,
    value: String(idx + 1),
    variant: m.id === agent.getModel() ? 'emerald' : 'secondary',
  }));
  buttonDefs.push({
    id: `chip-${AVAILABLE_MODELS.length + 1}`,
    label: `${AVAILABLE_MODELS.length + 1}. Buscar API`,
    value: String(AVAILABLE_MODELS.length + 1),
    variant: 'secondary',
  });

  const { renderedText: modelButtonBar, buttonsWithBounds: modelButtons } = renderButtonBar(buttonDefs, 2);

  const lines: string[] = [];
  const barLineIdx = lines.length;
  lines.push(modelButtonBar);
  lines.push(''); // blank line

  const modelLineRanges: Array<{ idx: number; startIdx: number; endIdx: number; id: string }> = [];

  AVAILABLE_MODELS.forEach((m, idx) => {
    const isCurrent = m.id === agent.getModel();
    const bullet = isCurrent ? mint('●') : pc.dim('○');
    const badge = isCurrent ? mint(' (ativo)') : '';
    const num = idx + 1;

    const startIdx = lines.length;
    lines.push(`  ${bullet} ${pc.bold(`${num}. ${m.id}`)}${badge}`);
    const endIdx = lines.length;
    lines.push(`     ${pc.dim(m.description)}`);

    modelLineRanges.push({ idx: num, startIdx, endIdx, id: m.id });
  });

  const optRemoteIdx = lines.length;
  lines.push(pc.dim(`  ○ ${AVAILABLE_MODELS.length + 1}. Consultar todos os modelos ativos na sua conta da API (tempo real)...`));
  const optCustomIdx = lines.length;
  lines.push(pc.dim(`  ○ ${AVAILABLE_MODELS.length + 2}. Digitar outro modelo manualmente...`));
  lines.push(''); // blank line before prompt

  // Print menu
  for (const l of lines) {
    console.log(l);
  }

  // Register clickable regions
  const totalLines = lines.length;
  const regions: ClickableRegion[] = [];

  // 1. Horizontal chip buttons
  const barRelRow = barLineIdx - totalLines;
  for (const b of modelButtons) {
    regions.push({
      id: b.id,
      label: b.label,
      relativeRow: barRelRow,
      startCol: b.startCol,
      endCol: b.endCol,
      toleranceRows: 0,
      value: b.value,
    });
  }

  // 2. Clickable model lines
  for (const r of modelLineRanges) {
    regions.push({
      id: `model-${r.idx}`,
      label: r.id,
      relativeStartRow: r.startIdx - totalLines,
      relativeEndRow: r.endIdx - totalLines,
      toleranceRows: 0,
      value: String(r.idx),
    });
  }

  // 3. Option lines
  regions.push({
    id: `model-opt-remote`,
    label: 'Consultar API remota',
    relativeRow: optRemoteIdx - totalLines,
    toleranceRows: 0,
    value: String(AVAILABLE_MODELS.length + 1),
  });
  regions.push({
    id: `model-opt-custom`,
    label: 'Digitar modelo manualmente',
    relativeRow: optCustomIdx - totalLines,
    toleranceRows: 0,
    value: String(AVAILABLE_MODELS.length + 2),
  });

  const promptText = pc.dim(`Escolha uma opção [1-${AVAILABLE_MODELS.length + 2} ou Enter para manter]: `);
  const { answer: choice } = await promptWithMouse(rl, promptText, regions, {
    onRegionClicked: (reg) => {
      console.log(mint(`✔ [Selecionado]: ${reg.label || reg.value}`));
    },
  });

  const cleanChoice = choice.trim();

  if (!cleanChoice) {
    console.log(pc.dim(`Mantido o modelo atual: ${agent.getModel()}\n`));
    return;
  }

  const choiceNum = parseInt(cleanChoice, 10);
  if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= AVAILABLE_MODELS.length) {
    const selected = AVAILABLE_MODELS[choiceNum - 1].id;
    agent.setModel(selected);
    console.log(emerald(`\n✔ Modelo alterado para: ${pc.bold(selected)}\n`));
  } else if (choiceNum === AVAILABLE_MODELS.length + 1) {
    console.log(mint('\nConsultando modelos disponíveis na API do Google...'));
    const remoteModels = await agent.listRemoteModels();
    if (remoteModels.length === 0) {
      console.log(pc.yellow('Não foi possível listar os modelos da API remota. Verifique sua chave.\n'));
      return;
    }

    console.log(pc.bold('\nModelos retornados pela sua conta (clique em qualquer um ou digite o número):'));
    const remoteLines: string[] = [];
    const remoteRegions: ClickableRegion[] = [];
    const displayModels = remoteModels.slice(0, 20);

    displayModels.forEach((name, i) => {
      remoteLines.push(`  ${mint(String(i + 1).padStart(2, ' '))}. ${name}`);
    });
    remoteLines.push(''); // blank line

    for (const rlLine of remoteLines) {
      console.log(rlLine);
    }

    const totalRemoteLines = remoteLines.length;
    displayModels.forEach((name, i) => {
      remoteRegions.push({
        id: `remote-${i + 1}`,
        label: name,
        relativeRow: i - totalRemoteLines,
        toleranceRows: 0,
        value: String(i + 1),
      });
    });

    const subPrompt = pc.dim('\nDigite o número ou clique no modelo: ');
    const { answer: subChoice } = await promptWithMouse(rl, subPrompt, remoteRegions, {
      onRegionClicked: (reg) => {
        console.log(mint(`✔ [Selecionado]: ${reg.label || reg.value}`));
      },
    });

    const subClean = subChoice.trim();
    const subNum = parseInt(subClean, 10);
    if (!isNaN(subNum) && subNum >= 1 && subNum <= displayModels.length) {
      const selected = displayModels[subNum - 1];
      agent.setModel(selected);
      console.log(emerald(`\n✔ Modelo alterado para: ${pc.bold(selected)}\n`));
    } else if (subClean) {
      agent.setModel(subClean);
      console.log(emerald(`\n✔ Modelo alterado para: ${pc.bold(subClean)}\n`));
    }
  } else if (choiceNum === AVAILABLE_MODELS.length + 2) {
    const custom = await rl.question(pc.dim('Digite o ID do modelo (ex: gemini-3.5-flash): '));
    const cleanCustom = custom.trim();
    if (cleanCustom) {
      agent.setModel(cleanCustom);
      console.log(emerald(`\n✔ Modelo alterado para: ${pc.bold(cleanCustom)}\n`));
    }
  } else {
    // Tratado como nome direto digitado
    agent.setModel(cleanChoice);
    console.log(emerald(`\n✔ Modelo alterado para: ${pc.bold(cleanChoice)}\n`));
  }
}

async function showInteractiveSuggestions(rl: readline.Interface): Promise<string | null> {
  const suggestions = [
    'Crie uma página web moderna com tema escuro, botões animados e responsividade',
    'Analise todos os arquivos deste repositório e explique sua arquitetura',
    'Crie um script TypeScript para manipular arquivos e dados JSON',
    'Crie uma suíte completa de testes unitários para os módulos existentes',
  ];

  console.log(pc.bold(mint('\n💡 Sugestões Rápidas:')) + pc.dim(' (Clique em uma opção ou digite o número)\n'));

  const lines: string[] = [];
  suggestions.forEach((sug, i) => {
    lines.push(`  ${mint(`[ ${i + 1} ]`)} ${pc.white(sug)}`);
  });
  lines.push(pc.dim('  [ 0 ] Cancelar e voltar'));
  lines.push(''); // blank line

  for (const l of lines) {
    console.log(l);
  }

  const totalLines = lines.length;
  const regions: ClickableRegion[] = [];
  suggestions.forEach((sug, i) => {
    regions.push({
      id: `sug-${i + 1}`,
      label: sug,
      relativeRow: i - totalLines,
      toleranceRows: 0,
      value: String(i + 1),
    });
  });
  regions.push({
    id: 'sug-cancel',
    label: 'Cancelar',
    relativeRow: suggestions.length - totalLines,
    toleranceRows: 0,
    value: '0',
  });

  const { answer } = await promptWithMouse(
    rl,
    pc.dim('Escolha uma opção [1-4 ou 0]: '),
    regions,
    {
      onRegionClicked: (reg) => {
        console.log(mint(`✔ [Selecionado]: ${reg.label || reg.value}`));
      },
    }
  );

  const clean = answer.trim();
  const num = parseInt(clean, 10);
  if (!isNaN(num) && num >= 1 && num <= suggestions.length) {
    return suggestions[num - 1];
  }
  return null;
}

function getPersonaName(personaId: PersonaType): string {
  return AVAILABLE_PERSONAS.find((p) => p.id === personaId)?.name || 'Sênior';
}

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    // Inicializa sistema de mouse
    mouseSystem.init();

    await checkOrPromptApiKey(rl);

    const agent = new CodeAgent();

    console.clear();
    renderWelcomeCard({
      version: 'v1.0.0',
      model: agent.getModel(),
      billing: 'API Usage Billing',
      folder: `~/${path.basename(process.cwd())}`,
      mouseEnabled: mouseSystem.isEnabled(),
      persona: getPersonaName(agent.getPersona()),
    });

    while (true) {
      // Barra de atalhos rápidos com 6 botões interativos
      const mainButtons: ButtonDef[] = [
        { id: 'btn-model', label: '⚡ 1. /model', value: '/model', variant: 'emerald' },
        { id: 'btn-persona', label: '🎭 2. /persona', value: '/persona', variant: 'secondary' },
        { id: 'btn-clear', label: '🧹 3. /clear', value: '/clear', variant: 'secondary' },
        { id: 'btn-sug', label: '💡 4. Sugestões', value: '__SUGGESTIONS__', variant: 'secondary' },
        { id: 'btn-mouse', label: '🖱️ 5. /mouse', value: '/mouse', variant: 'secondary' },
        { id: 'btn-exit', label: '🚪 6. /exit', value: '/exit', variant: 'secondary' },
      ];

      const { renderedText: actionBar, buttonsWithBounds } = renderButtonBar(mainButtons, 1);
      console.log(actionBar);

      // Regiões clicáveis com toleranceRows = 0 estrito para NUNCA invadir a linha do prompt
      const regions: ClickableRegion[] = buttonsWithBounds.map((b) => ({
        id: b.id,
        label: b.label,
        relativeRow: -1,
        startCol: b.startCol,
        endCol: b.endCol,
        toleranceRows: 0,
        value: b.value,
      }));

      const { answer: userInput } = await promptWithMouse(rl, mint('dupe ❯ '), regions, {
        onRegionClicked: (reg) => {
          if (reg.value !== '__SUGGESTIONS__') {
            console.log(mint(`✔ [Clique]: ${reg.label}`));
          }
        },
      });

      const trimmed = userInput.trim();

      if (!trimmed) {
        continue;
      }

      // Atalhos numéricos diretos (1 a 6) caso o usuário digite apenas o número
      let effectiveInput = trimmed;
      if (trimmed === '1') effectiveInput = '/model';
      else if (trimmed === '2') effectiveInput = '/persona';
      else if (trimmed === '3') effectiveInput = '/clear';
      else if (trimmed === '4') effectiveInput = '__SUGGESTIONS__';
      else if (trimmed === '5') effectiveInput = '/mouse';
      else if (trimmed === '6') effectiveInput = '/exit';

      // Atalho de sugestões rápidas
      if (effectiveInput === '__SUGGESTIONS__') {
        const selectedPrompt = await showInteractiveSuggestions(rl);
        if (selectedPrompt) {
          console.log(pc.bold(pc.white(`\n> ${selectedPrompt}\n`)));
          await agent.run(selectedPrompt, async (filePath, content) => {
            return await confirmFileWrite(rl, agent, filePath, content);
          });
          console.log('');
        }
        continue;
      }

      // Comando /persona ou /mode
      if (effectiveInput.startsWith('/persona') || effectiveInput.startsWith('/mode')) {
        const parts = effectiveInput.split(/\s+/);
        const personaArg = parts.slice(1).join(' ');
        await handlePersonaCommand(rl, agent, personaArg);
        continue;
      }

      // Comando /mouse
      if (effectiveInput.startsWith('/mouse')) {
        const parts = effectiveInput.split(/\s+/);
        const sub = parts[1]?.toLowerCase();

        if (sub === 'off' || sub === 'desativar') {
          mouseSystem.disable();
          console.log(pc.yellow('\n○ Suporte ao mouse desativado. Interação agora via teclado e números 1-6.\n'));
        } else if (sub === 'on' || sub === 'ativar') {
          mouseSystem.enable();
          console.log(emerald('\n✔ Suporte ao mouse ativado! Clique nos botões ou menus para interagir.\n'));
        } else {
          // Toggle
          const current = mouseSystem.isEnabled();
          const next = !current;
          mouseSystem.setEnabled(next);
          if (next) {
            console.log(emerald('\n✔ Modo Mouse ATIVADO! Agora você pode clicar em botões e menus.\n'));
          } else {
            console.log(pc.yellow('\n○ Modo Mouse DESATIVADO. Digite /mouse on para reativar.\n'));
          }
        }
        continue;
      }

      if (effectiveInput === '/exit' || effectiveInput.toLowerCase() === 'exit' || effectiveInput.toLowerCase() === 'quit') {
        console.log(pc.dim('\nAté logo! 👋\n'));
        break;
      }

      if (effectiveInput === '/clear') {
        agent.resetChat();
        console.clear();
        renderWelcomeCard({
          version: 'v1.0.0',
          model: agent.getModel(),
          billing: 'API Usage Billing',
          folder: `~/${path.basename(process.cwd())}`,
          mouseEnabled: mouseSystem.isEnabled(),
          persona: getPersonaName(agent.getPersona()),
        });
        continue;
      }

      if (effectiveInput.startsWith('/model')) {
        const parts = effectiveInput.split(/\s+/);
        const modelArg = parts.slice(1).join(' ');
        await handleModelCommand(rl, agent, modelArg);
        continue;
      }

      console.log('');
      await agent.run(effectiveInput, async (filePath, content) => {
        return await confirmFileWrite(rl, agent, filePath, content);
      });
      console.log('');
    }
  } finally {
    mouseSystem.disable();
    rl.close();
  }
}

main().catch((err) => {
  mouseSystem.disable();
  console.error(pc.red('Erro fatal:'), err);
  process.exit(1);
});
