import pc from 'picocolors';
import path from 'node:path';

// Dupe Emerald & Mint Color Palette
export const emerald = (str: string) => `\x1b[38;2;16;185;129m${str}\x1b[0m`;
export const emeraldBold = (str: string) => `\x1b[1;38;2;16;185;129m${str}\x1b[0m`;
export const mint = (str: string) => `\x1b[38;2;52;211;153m${str}\x1b[0m`;
export const dimEmerald = (str: string) => `\x1b[38;2;6;95;70m${str}\x1b[0m`;

// Aliases for compatibility
export const coral = emerald;
export const coralBold = emeraldBold;
export const dimCoral = dimEmerald;

export function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/**
 * Strips all ANSI CSI, OSC, and styling escape codes from strings
 */
export function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    .replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, '')
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
    .replace(/\x1b[PX^_][^\x1b]*\x1b\\/g, '')
    .replace(/\x1b[()][AB012]/g, '');
}

/**
 * Creates an OSC 8 clickable terminal hyperlink
 */
export function terminalLink(url: string, text?: string): string {
  const displayText = text || url;
  return `\x1b]8;;${url}\x1b\\${displayText}\x1b]8;;\x1b\\`;
}

export interface GeminiModelInfo {
  id: string;
  name: string;
  description: string;
}

export const AVAILABLE_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    description: 'Padrão Recomendado: Ultra estável, baixíssima latência, sem erros de 503 ou cota.',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    description: 'Equilíbrio: Excelente compromisso entre velocidade, inteligência de código e estabilidade.',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    description: 'Preview Oficial: Nova geração Gemini 3 oficial da Google em modo preview.',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    description: 'Frontier: Raciocínio profundo para arquiteturas complexas (sujeito à cota da sua conta).',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Experimental: Thinking budget avançado (pode apresentar instabilidade/503 na Google).',
  },
];

/**
 * Renders the Dupe CLI Welcome Banner Box with pixel-perfect alignment
 */
export function renderWelcomeCard(options?: {
  version?: string;
  model?: string;
  billing?: string;
  folder?: string;
  mouseEnabled?: boolean;
  persona?: string;
}): void {
  const version = options?.version || 'v1.0.0';
  const model = options?.model || 'gemini-3.5-flash-lite';
  const billing = options?.billing || 'API Usage Billing';
  const folder = options?.folder || `~/${path.basename(process.cwd())}`;
  const isMouseOn = options?.mouseEnabled ?? true;
  const personaDisplay = options?.persona || 'Sênior';

  const leftWidth = 40;
  const rightWidth = 56;
  const totalInnerWidth = leftWidth + 1 + rightWidth; // + 1 for divider '│'

  // Top border: ╭─ Dupe v1.0.0 ──────────────────────────────────────────────╮
  const titlePart = ` Dupe ${version} `;
  const titleVisibleLen = stripAnsi(titlePart).length;
  const remainingDashes = Math.max(2, totalInnerWidth - titleVisibleLen - 2);
  const topBorder = emerald('╭─') + emerald(pc.bold(' Dupe ')) + pc.dim(version) + ' ' + emerald('─'.repeat(remainingDashes) + '╮');

  const padR = (str: string, width: number) => {
    const visible = stripAnsi(str).length;
    if (visible > width) {
      const clean = stripAnsi(str).slice(0, width - 3) + '...';
      return clean + ' '.repeat(Math.max(0, width - stripAnsi(clean).length));
    }
    return str + ' '.repeat(Math.max(0, width - visible));
  };

  const centerIn = (str: string, width: number) => {
    const visible = stripAnsi(str).length;
    if (visible > width) {
      const clean = stripAnsi(str).slice(0, width - 3) + '...';
      return clean;
    }
    const leftPad = Math.floor((width - visible) / 2);
    const rightPad = width - visible - leftPad;
    return ' '.repeat(Math.max(0, leftPad)) + str + ' '.repeat(Math.max(0, rightPad));
  };

  // Futuristic Cyber Robot mascot (exact 11 chars width)
  const mascotLines = [
    emerald('    █▄█    '),
    emerald('  ▄█████▄  '),
    emerald('  █ ') + mint('■') + emerald(' █ ') + mint('■') + emerald(' █  '),
    emerald('  █▄▄▄▄▄█  '),
    emerald('   ▀   ▀   '),
  ];

  const leftCol: string[] = [
    centerIn(pc.bold(pc.white('Welcome to Dupe!')), leftWidth),
    ' '.repeat(leftWidth),
    centerIn(mascotLines[0], leftWidth),
    centerIn(mascotLines[1], leftWidth),
    centerIn(mascotLines[2], leftWidth),
    centerIn(mascotLines[3], leftWidth),
    centerIn(mascotLines[4], leftWidth),
    ' '.repeat(leftWidth),
    centerIn(pc.dim(`${model} · ${personaDisplay}`), leftWidth),
    centerIn(mint(folder), leftWidth),
  ];

  const rightCol: string[] = [
    padR(' ' + emerald('Tips for getting started'), rightWidth),
    padR(' ' + pc.white('Ask Dupe to create code, inspect files or run tests'), rightWidth),
    ' '.repeat(rightWidth),
    padR(' ' + pc.dim('─'.repeat(rightWidth - 3)), rightWidth),
    padR(' ' + emerald('Mouse, Teclado & Personalidades'), rightWidth),
    padR(' ' + pc.white('Use /model para IA, /persona para modo de resposta'), rightWidth),
    padR(' ' + pc.dim('Clique nos botões ou use atalhos numéricos 1-6'), rightWidth),
    ' '.repeat(rightWidth),
    padR(' ' + emerald('Recent activity'), rightWidth),
    padR(' ' + pc.dim('No recent activity'), rightWidth),
  ];

  const bottomBorder = emerald('╰' + '─'.repeat(totalInnerWidth) + '╯');

  console.log('\n' + topBorder);
  for (let i = 0; i < leftCol.length; i++) {
    console.log(emerald('│') + leftCol[i] + emerald('│') + rightCol[i] + emerald('│'));
  }
  console.log(bottomBorder);

  const alternateModel = model === 'gemini-3.5-flash-lite' ? 'gemini-3.5-flash' : 'gemini-3.5-flash-lite';
  const mouseBadge = isMouseOn
    ? mint('🖱️ Mouse: Ativo (1-6)')
    : pc.dim('○ Mouse: Inativo');

  console.log(pc.dim(`\n💡 Dupe CLI · /model para ${alternateModel} · /persona para estilo · ${mouseBadge}\n`));
}

/**
 * Bullet points styling
 */
export function printAssistantThought(text: string) {
  console.log(`${mint('●')} ${text}`);
}

export function printToolStart(toolName: string, argsStr: string, isSearchOrRead = false) {
  const bullet = isSearchOrRead ? emerald('●') : mint('●');
  console.log(`${bullet} ${emeraldBold(toolName)}(${pc.dim(argsStr)})`);
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
        .replace(/(<\/?[a-zA-Z0-9\-!]+)/g, pc.cyan('$1'))
        .replace(/(>)/g, pc.cyan('$1'))
        // Attributes: lang=, charset=, name=, content=
        .replace(/(\s+)([a-zA-Z\-:]+)(=)/g, (_, sp, attr, eq) => `${sp}${mint(attr)}${pc.dim(eq)}`)
        // Attribute values: "..." or '...'
        .replace(/(".*?"|'.*?')/g, (match) => pc.yellow(match));

      return highlighted;
    })
    .join('\n');
}

/**
 * Renders file creation preview box with line numbers
 */
export function renderFileCreationPreview(filePath: string, content: string): void {
  printHorizontalDivider();
  console.log(emerald(pc.bold(`\nCreate file ${filePath}\n`)));

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
