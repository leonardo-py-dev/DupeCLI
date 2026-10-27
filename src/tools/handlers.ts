import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function handleSearch(args?: { pattern?: string }) {
  try {
    const targetDir = process.cwd();
    const ignoreList = new Set(['.git', 'node_modules', 'dist', '.gemini']);

    const matchedFiles: string[] = [];

    async function scan(dir: string, relPrefix = '') {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (ignoreList.has(entry.name)) continue;
        const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await scan(path.join(dir, entry.name), relPath);
        } else {
          matchedFiles.push(relPath);
        }
      }
    }

    await scan(targetDir);

    return {
      success: true,
      pattern: args?.pattern || '**',
      count: matchedFiles.length,
      files: matchedFiles,
      summary: `Found ${matchedFiles.length} file${matchedFiles.length === 1 ? '' : 's'}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to search files: ${err.message}`,
      summary: `Search failed: ${err.message}`,
    };
  }
}

export async function handleRead(args: { path: string }) {
  try {
    const resolvedPath = path.resolve(process.cwd(), args.path);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const lines = content.split('\n').length;
    return {
      success: true,
      path: args.path,
      content,
      totalLines: lines,
      summary: `Read ${lines} line${lines === 1 ? '' : 's'}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to read file "${args.path}": ${err.message}`,
      summary: `Read failed: ${err.message}`,
    };
  }
}

export async function handleWrite(args: { path: string; content: string }) {
  try {
    const resolvedPath = path.resolve(process.cwd(), args.path);
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(resolvedPath, args.content, 'utf-8');
    return {
      success: true,
      path: args.path,
      bytesWritten: Buffer.byteLength(args.content, 'utf-8'),
      summary: `Created file ${args.path}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to write to "${args.path}": ${err.message}`,
      summary: `Write failed: ${err.message}`,
    };
  }
}

export async function handleBash(args: { command: string }) {
  try {
    const { stdout, stderr } = await execAsync(args.command, {
      cwd: process.cwd(),
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 5,
      shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
    });

    return {
      success: true,
      command: args.command,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      summary: 'Executed with exit code 0',
    };
  } catch (err: any) {
    return {
      success: false,
      command: args.command,
      stdout: err.stdout?.toString().trim() || '',
      stderr: err.stderr?.toString().trim() || err.message,
      exitCode: err.code ?? 1,
      summary: `Failed with exit code ${err.code ?? 1}`,
    };
  }
}

export async function executeTool(name: string, args: any): Promise<Record<string, unknown>> {
  switch (name) {
    case 'Search':
    case 'listDirectory':
      return await handleSearch(args);
    case 'Read':
    case 'readFile':
      return await handleRead(args);
    case 'Write':
    case 'writeFile':
      return await handleWrite(args);
    case 'Bash':
    case 'runCommand':
      return await handleBash(args);
    default:
      return {
        success: false,
        error: `Unknown tool "${name}"`,
        summary: `Unknown tool "${name}"`,
      };
  }
}
