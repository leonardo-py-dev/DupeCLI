import readline from 'node:readline/promises';
import { EventEmitter } from 'node:events';
import { stripAnsi } from './ui.js';

export interface MouseEvent {
  button: number; // 0 = left, 1 = middle, 2 = right, 64 = wheel up, 65 = wheel down
  col: number;    // 1-based column
  row: number;    // 1-based row
  type: 'press' | 'release';
}

export interface ClickableRegion {
  id: string;
  label?: string;
  row?: number;               // absolute 1-based row on terminal
  startRow?: number;          // absolute start row (multi-row region)
  endRow?: number;            // absolute end row (multi-row region)
  relativeRow?: number;       // relative to prompt row (e.g. -1 = 1 line above prompt)
  relativeStartRow?: number;  // relative multi-row start
  relativeEndRow?: number;    // relative multi-row end
  startCol?: number;          // 1-based start column (inclusive)
  endCol?: number;            // 1-based end column (inclusive)
  toleranceRows?: number;     // vertical click tolerance in rows (default 0)
  action?: () => void | Promise<void>;
  value?: string;             // text value to submit to readline
}

export interface ButtonDef {
  id: string;
  label: string;
  value: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'coral' | 'emerald';
  action?: () => void | Promise<void>;
}

// ANSI Escape Codes for Mouse Reporting
// 1000h: Report button click; 1006h: SGR decimal extended coordinates mode
const ENABLE_MOUSE_CODES = '\x1b[?1000h\x1b[?1006h';
const DISABLE_MOUSE_CODES = '\x1b[?1006l\x1b[?1000l';

// Regex patterns for ANSI sequences
const MOUSE_SGR_REGEX = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
const CURSOR_POS_REGEX = /\x1b\[(\d+);(\d+)R/g;

class MouseSystem extends EventEmitter {
  private hookInstalled = false;
  private mouseEnabled = true;
  private activeRegions: ClickableRegion[] = [];
  private currentPromptRow: number | null = null;
  private currentRl: readline.Interface | null = null;
  private cursorEmitter = new EventEmitter();

  constructor() {
    super();
  }

  public init(): void {
    if (this.hookInstalled) return;
    this.hookInstalled = true;

    this.installStdinHook();
    this.setupExitHandlers();

    // Ensure raw mode is enabled if TTY so that mouse events and cursor reports arrive immediately
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      try {
        process.stdin.setRawMode(true);
      } catch {
        // Ignore
      }
    }

    this.enable();
  }

  public enable(): void {
    this.mouseEnabled = true;
    try {
      if (process.stdout.isTTY) {
        process.stdout.write(ENABLE_MOUSE_CODES);
      }
    } catch {
      // Ignore if stdout is closed
    }
  }

  public disable(): void {
    this.mouseEnabled = false;
    try {
      if (process.stdout.isTTY) {
        process.stdout.write(DISABLE_MOUSE_CODES);
      }
    } catch {
      // Ignore
    }
  }

  public isEnabled(): boolean {
    return this.mouseEnabled;
  }

  public setEnabled(enabled: boolean): void {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }

  private setupExitHandlers(): void {
    const cleanup = () => {
      this.disable();
      try {
        process.stdout.write('\x1b[?25h'); // restore cursor
      } catch {
        // Ignore
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(0);
    });
  }

  private installStdinHook(): void {
    const originalEmit = process.stdin.emit;
    const self = this;

    process.stdin.emit = function (event: string | symbol, ...args: any[]): boolean {
      if (event === 'data' && args[0]) {
        const buffer = args[0] as Buffer;
        const str = buffer.toString('utf-8');

        let hasIntercepted = false;
        let cleanStr = str;

        // 1. Intercept Cursor Position Report \x1b[row;colR
        CURSOR_POS_REGEX.lastIndex = 0;
        let cursorMatch: RegExpExecArray | null;
        while ((cursorMatch = CURSOR_POS_REGEX.exec(str)) !== null) {
          hasIntercepted = true;
          const row = parseInt(cursorMatch[1], 10);
          const col = parseInt(cursorMatch[2], 10);
          self.cursorEmitter.emit('cursor', { row, col });
        }
        if (hasIntercepted) {
          cleanStr = cleanStr.replace(CURSOR_POS_REGEX, '');
        }

        // 2. Intercept SGR Mouse Sequence \x1b[<btn;col;rowM or m
        MOUSE_SGR_REGEX.lastIndex = 0;
        let mouseMatch: RegExpExecArray | null;
        let mouseFound = false;
        while ((mouseMatch = MOUSE_SGR_REGEX.exec(str)) !== null) {
          mouseFound = true;
          hasIntercepted = true;
          const button = parseInt(mouseMatch[1], 10);
          const col = parseInt(mouseMatch[2], 10);
          const row = parseInt(mouseMatch[3], 10);
          const type = mouseMatch[4] === 'M' ? 'press' : 'release';

          const eventPayload: MouseEvent = { button, col, row, type };
          self.emit('mouse', eventPayload);

          // Handle left click press
          if (self.mouseEnabled && button === 0 && type === 'press') {
            self.handleLeftClick(col, row);
          }
        }
        if (mouseFound) {
          cleanStr = cleanStr.replace(MOUSE_SGR_REGEX, '');
        }

        // If ANSI cursor or mouse sequence was intercepted, don't pass raw bytes to readline
        if (hasIntercepted) {
          if (!cleanStr) {
            return true;
          }
          args[0] = Buffer.from(cleanStr, 'utf-8');
        }
      }

      return originalEmit.apply(this, [event, ...args]);
    };
  }

  public queryCursorPosition(timeoutMs = 120): Promise<{ row: number; col: number } | null> {
    return new Promise((resolve) => {
      if (!process.stdout.isTTY) {
        return resolve(null);
      }

      // Ensure stdin is in raw mode so the terminal's response is emitted immediately
      if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
        try {
          process.stdin.setRawMode(true);
        } catch {
          // Ignore
        }
      }

      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          removeListener();
          resolve(null);
        }
      }, timeoutMs);

      const onCursor = (pos: { row: number; col: number }) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          removeListener();
          resolve(pos);
        }
      };

      const removeListener = () => {
        this.cursorEmitter.off('cursor', onCursor);
      };

      this.cursorEmitter.once('cursor', onCursor);
      try {
        process.stdout.write('\x1b[6n');
      } catch {
        resolve(null);
      }
    });
  }

  public setActiveRegions(regions: ClickableRegion[], promptRow?: number, rl?: readline.Interface): void {
    this.activeRegions = regions;
    this.currentPromptRow = promptRow ?? null;
    this.currentRl = rl ?? null;
  }

  public setPromptRow(row: number): void {
    this.currentPromptRow = row;
  }

  public clearActiveRegions(): void {
    this.activeRegions = [];
    this.currentPromptRow = null;
    this.currentRl = null;
  }

  private handleLeftClick(col: number, row: number): void {
    if (this.activeRegions.length === 0) {
      return;
    }

    const basePromptRow = this.currentPromptRow ?? (process.stdout.rows || 24);

    // If click is on the prompt row itself, NEVER trigger buttons above it
    if (row === basePromptRow) {
      return;
    }

    for (const region of this.activeRegions) {
      let minRow: number;
      let maxRow: number;

      if (region.startRow !== undefined && region.endRow !== undefined) {
        minRow = region.startRow;
        maxRow = region.endRow;
      } else if (region.row !== undefined) {
        minRow = region.row;
        maxRow = region.row;
      } else if (region.relativeStartRow !== undefined && region.relativeEndRow !== undefined) {
        minRow = basePromptRow + region.relativeStartRow;
        maxRow = basePromptRow + region.relativeEndRow;
      } else if (region.relativeRow !== undefined) {
        minRow = basePromptRow + region.relativeRow;
        maxRow = basePromptRow + region.relativeRow;
      } else {
        continue;
      }

      // Default tolerance is 0 so it never bleeds into adjacent lines
      const tol = region.toleranceRows ?? 0;
      const effectiveMinRow = Math.max(1, minRow - tol);
      // Strictly prevent regions above prompt from reaching prompt row
      const effectiveMaxRow =
        region.relativeRow !== undefined && region.relativeRow < 0
          ? Math.min(basePromptRow - 1, maxRow + tol)
          : maxRow + tol;

      const minCol = region.startCol ?? 1;
      const maxCol = region.endCol ?? (process.stdout.columns || 999);

      if (row >= effectiveMinRow && row <= effectiveMaxRow && col >= minCol && col <= maxCol) {
        // Matched region!
        this.executeRegion(region);
        return;
      }
    }
  }

  private executeRegion(region: ClickableRegion): void {
    this.emit('regionClicked', region);

    if (region.action) {
      try {
        region.action();
      } catch (err) {
        // Ignore action error
      }
    }

    if (region.value !== undefined && this.currentRl) {
      const rlAny = this.currentRl as any;
      try {
        // Clear any partial user typing before submitting the clicked value
        if (typeof rlAny.line === 'string') {
          rlAny.line = '';
          rlAny.cursor = 0;
        }
      } catch {
        // Ignore
      }
      this.currentRl.write(`${region.value}\r`);
    }
  }
}

export const mouseSystem = new MouseSystem();

/**
 * Renders styled button badges with Dupe Emerald palette
 */
export function renderButtonBadge(
  label: string,
  variant: 'primary' | 'secondary' | 'danger' | 'success' | 'coral' | 'emerald' = 'secondary'
): string {
  switch (variant) {
    case 'emerald':
    case 'coral':
    case 'primary':
      // Dupe Emerald badge (esmeralda vibrante com texto preto em negrito)
      return `\x1b[48;2;16;185;129m\x1b[30m\x1b[1m ${label} \x1b[0m`;
    case 'success':
      return `\x1b[48;2;5;150;105m\x1b[97m\x1b[1m ${label} \x1b[0m`;
    case 'danger':
      return `\x1b[48;2;225;29;72m\x1b[97m\x1b[1m ${label} \x1b[0m`;
    case 'secondary':
    default:
      // Dark slate com texto menta
      return `\x1b[48;2;20;35;30m\x1b[38;2;167;243;208m ${label} \x1b[0m`;
  }
}

/**
 * Renders a horizontal bar of clickable buttons, calculating exact column spans for each button
 */
export function renderButtonBar(
  buttons: ButtonDef[],
  indent = 2
): {
  renderedText: string;
  buttonsWithBounds: Array<ButtonDef & { startCol: number; endCol: number }>;
} {
  const gap = '  ';
  let currentCol = 1 + indent;
  const buttonsWithBounds: Array<ButtonDef & { startCol: number; endCol: number }> = [];

  const pieces: string[] = [];

  for (const btn of buttons) {
    const renderedBadge = renderButtonBadge(btn.label, btn.variant || 'secondary');
    const visibleLength = stripAnsi(renderedBadge).length;
    const startCol = currentCol;
    const endCol = startCol + visibleLength - 1;

    buttonsWithBounds.push({
      ...btn,
      startCol,
      endCol,
    });

    pieces.push(renderedBadge);
    currentCol = endCol + 1 + gap.length;
  }

  const renderedText = ' '.repeat(indent) + pieces.join(gap);
  return { renderedText, buttonsWithBounds };
}

/**
 * Enhanced prompt that registers mouse clickable regions during the question
 */
export async function promptWithMouse(
  rl: readline.Interface,
  promptText: string,
  regions: ClickableRegion[],
  options?: {
    knownPromptRow?: number;
    onRegionClicked?: (region: ClickableRegion) => void;
  }
): Promise<{ answer: string; clickedRegion?: ClickableRegion }> {
  mouseSystem.init();

  let clickedRegion: ClickableRegion | undefined;

  const onRegionClicked = (reg: ClickableRegion) => {
    clickedRegion = reg;
    if (options?.onRegionClicked) {
      options.onRegionClicked(reg);
    }
  };

  mouseSystem.once('regionClicked', onRegionClicked);

  // Determine prompt row: prefer explicit known row, then cursor query, then fallback
  let promptRow: number;
  if (options?.knownPromptRow !== undefined) {
    promptRow = options.knownPromptRow;
  } else {
    const pos = await mouseSystem.queryCursorPosition(80);
    promptRow = pos?.row ?? (process.stdout.rows || 24);
  }

  mouseSystem.setActiveRegions(regions, promptRow, rl);

  try {
    const rawAnswer = await rl.question(promptText);
    return {
      answer: rawAnswer.trim(),
      clickedRegion,
    };
  } finally {
    mouseSystem.off('regionClicked', onRegionClicked);
    mouseSystem.clearActiveRegions();
  }
}
