import pc from 'picocolors';
import path from 'node:path';

// Claude Code Terracotta / Coral Color Palette
export const coral = (str: string) => `\x1b[38;2;217;119;87m${str}\x1b[0m`;
export const coralBold = (str: string) => `\x1b[1;38;2;217;119;87m${str}\x1b[0m`;
export const dimCoral = (str: string) => `\x1b[38;2;160;85;60m${str}\x1b[0m`;

export function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Renders the Claude Code v2.1.9 Welcome Banner Box
 */
export function renderWelcomeCard(options?: {
  version?: string;
  model?: string;
  billing?: string;
  folder?: string;
}): void {
  const version = options?.version || 'v2.1.9';
  const model = options?.model || 'gemini-3.8-flash';
  const billing = options?.billing || 'API Free Tier';
  const folder = options?.folder || `~/${path.basename(process.cwd())}`;

  const leftWidth = 38;
  const rightWidth = 54;
  const totalInnerWidth = leftWidth + 1 + rightWidth; // + 1 for divider '│'

  // Top border: ╭─ Claude Code v2.1.9 ──────────────────────────────────────╮
  const titlePart = ` Claude Code ${pc.dim(version)} `;
  const titleVisibleLen = stripAnsi(titlePart).length;
  const remainingDashes = Math.max(2, totalInnerWidth - titleVisibleLen - 2);
  const topBorder = coral('╭─') + coral(pc.bold(' Claude Code ')) + pc.dim(version) + ' ' + coral('─'.repeat(remainingDashes) + '╮');

  const padR = (str: string, width: number) => {
    const visible = stripAnsi(str).length;
    return str + ' '.repeat(Math.max(0, width - visible));
  };

  const centerIn = (str: string, width: number) => {
    const visible = stripAnsi(str).length;
    const leftPad = Math.floor((width - visible) / 2);
    const rightPad = width - visible - leftPad;
    return ' '.repeat(Math.max(0, leftPad)) + str + ' '.repeat(Math.max(0, rightPad));
  };

  const mascotLines = [
    coral('  █   █  '),
    coral('█████████'),
    coral('██ █ █ ██'),
    coral('█████████'),
    coral('  █   █  '),
  ];

  const leftCol: string[] = [
    centerIn(pc.white('Welcome back!'), leftWidth),
    ' '.repeat(leftWidth),
    centerIn(mascotLines[0], leftWidth),
    centerIn(mascotLines[1], leftWidth),
    centerIn(mascotLines[2], leftWidth),
    centerIn(mascotLines[3], leftWidth),
    centerIn(mascotLines[4], leftWidth),
    ' '.repeat(leftWidth),
    centerIn(pc.dim(`${model} · ${billing}`), leftWidth),
    centerIn(pc.dim(folder), leftWidth),
  ];

  const rightCol: string[] = [
    padR(' ' + coral('Tips for getting started'), rightWidth),
    padR(' ' + pc.white('Ask Claude to create a new app or clone a repository'), rightWidth),
    ' '.repeat(rightWidth),
    padR(' ' + pc.dim('─'.repeat(rightWidth - 3)), rightWidth),
    padR(' ' + coral('Recent activity'), rightWidth),
    padR(' ' + pc.dim('No recent activity'), rightWidth),
    ' '.repeat(rightWidth),
    ' '.repeat(rightWidth),
    ' '.repeat(rightWidth),
    ' '.repeat(rightWidth),
  ];

  const bottomBorder = coral('╰' + '─'.repeat(totalInnerWidth) + '╯');

  console.log('\n' + topBorder);
  for (let i = 0; i < leftCol.length; i++) {
    console.log(coral('│') + leftCol[i] + coral('│') + rightCol[i] + coral('│'));
  }
  console.log(bottomBorder);

  const alternateModel = model === 'gemini-3.8-flash' ? 'gemini-3.1-pro' : 'gemini-3.8-flash';
  console.log(pc.dim(`\n/model to try ${alternateModel}\n`));
}

export interface GeminiModelInfo {
  id: string;
  name: string;
  description: string;
}

export const AVAILABLE_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Padrão: Raciocínio adaptativo com thinking budget, ultra veloz e ideal para código.',
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    description: 'Frontier: Raciocínio profundo, arquitetura complexa de software e contexto longo.',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    description: 'Equilíbrio: Excelente compromisso entre velocidade e raciocínio multi-etapas.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    description: 'Leve: Baixíssima latência, ideal para tarefas rápidas e menor consumo.',
  },
];

/**
 * Bullet points styling matching Claude Code
 */
export function printAssistantThought(text: string) {
  console.log(`${pc.white('●')} ${text}`);
}

export function printToolStart(toolName: string, argsStr: string, isSearchOrRead = false) {
  const bullet = isSearchOrRead ? pc.green('●') : pc.white('●');
  console.log(`${bullet} ${pc.bold(toolName)}(${pc.dim(argsStr)})`);
}

export function printToolResult(resultSummary: string) {
  console.log(`  ${pc.dim('└')} ${pc.dim(resultSummary)}`);
}

export function printHorizontalDivider() {
  const width = Math.min(getTerminalWidth(), 84);
  console.log(pc.dim('─'.repeat(width)));
}

/**
 * Syntax highlighting for HTML/JS/CSS code preview
 */
export function highlightSyntax(code: string, language = 'html'): string {
  const lines = code.split('\n');
  return lines
    .map((line) => {
      // Tags
      let highlighted = line
        .replace(/(<\/?[a-zA-Z0-9\-!]+)/g, pc.magenta('$1'))
        .replace(/(>)/g, pc.magenta('$1'))
        // Attributes: lang=, charset=, name=, content=
        .replace(/(\s+)([a-zA-Z\-:]+)(=)/g, (_, sp, attr, eq) => `${sp}${pc.green(attr)}${pc.dim(eq)}`)
        // Attribute values: "..." or '...'
        .replace(/(".*?"|'.*?')/g, (match) => pc.yellow(match));

      return highlighted;
    })
    .join('\n');
}

/**
 * Renders the exact Claude Code file creation preview box with line numbers
 */
export function renderFileCreationPreview(filePath: string, content: string): void {
  printHorizontalDivider();
  console.log(pc.cyan(pc.bold(`\nCreate file ${filePath}\n`)));

  const lines = content.split('\n');
  const maxLinesToShow = 35;
  const linesToRender = lines.slice(0, maxLinesToShow);

  linesToRender.forEach((line, idx) => {
    const lineNum = pc.dim(String(idx + 1).padStart(3, ' '));
    const highlighted = highlightSyntax(line);
    console.log(`${lineNum} ${highlighted}`);
  });

  if (lines.length > maxLinesToShow) {
    console.log(pc.dim(`    ... (+${lines.length - maxLinesToShow} lines)`));
  }

  console.log('');
}
