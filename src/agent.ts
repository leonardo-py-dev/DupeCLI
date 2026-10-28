import { GoogleGenAI, createPartFromFunctionResponse } from '@google/genai';
import { toolDeclarations } from './tools/definitions.js';
import { executeTool } from './tools/handlers.js';
import {
  printAssistantThought,
  printToolStart,
  printToolResult,
  mint,
  emerald,
} from './ui.js';
import { buildSystemInstruction, PersonaType } from './prompt.js';
import pc from 'picocolors';

export interface AgentOptions {
  apiKey?: string;
  model?: string;
  persona?: PersonaType;
}

export type ConfirmWriteCallback = (filePath: string, content: string) => Promise<boolean>;

export class CodeAgent {
  private ai: GoogleGenAI;
  private chat: any;
  private model: string;
  private persona: PersonaType;
  public allowAllEdits = false;

  constructor(options: AgentOptions = {}) {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY não foi encontrada! Defina no arquivo .env ou informe na inicialização.'
      );
    }

    this.ai = new GoogleGenAI({ apiKey });
    // Default to ultra-stable gemini-3.5-flash-lite
    this.model = options.model || 'gemini-3.5-flash-lite';
    this.persona = options.persona || 'senior';
    this.initChat();
  }

  private initChat() {
    const systemInstruction = buildSystemInstruction(this.persona);

    this.chat = this.ai.chats.create({
      model: this.model,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });
  }

  public async run(
    userPrompt: string,
    onConfirmWrite?: ConfirmWriteCallback
  ): Promise<void> {
    try {
      let response = await this.chat.sendMessage({ message: userPrompt });

      // ReAct loop
      while (true) {
        const parts = response.candidates?.[0]?.content?.parts || [];
        const functionCalls = response.functionCalls || [];

        // Print any text thoughts emitted before tool calls
        for (const part of parts) {
          if (part.text && part.text.trim().length > 0) {
            printAssistantThought(part.text.trim());
            console.log('');
          }
        }

        // If no tool calls, the model has finished
        if (!functionCalls || functionCalls.length === 0) {
          break;
        }

        const functionResponses = [];

        for (const call of functionCalls) {
          const fnName = call.name;
          const fnArgs = (call.args as Record<string, any>) || {};
          const fnId = call.id || '';

          // Format arguments for display
          let argsDisplay = '';
          const isSearchOrRead = fnName === 'Search' || fnName === 'Read';

          if (fnName === 'Search') {
            argsDisplay = `pattern: "${fnArgs.pattern || '**'}"`;
          } else if (fnName === 'Read') {
            argsDisplay = fnArgs.path || '';
          } else if (fnName === 'Write') {
            argsDisplay = `/${fnArgs.path || ''}`.replace('//', '/');
          } else if (fnName === 'Bash') {
            argsDisplay = `command: "${fnArgs.command || ''}"`;
          } else {
            argsDisplay = JSON.stringify(fnArgs);
          }

          printToolStart(fnName, argsDisplay, isSearchOrRead);

          // Confirmation check for file writes
          if (fnName === 'Write' && onConfirmWrite && !this.allowAllEdits) {
            const confirmed = await onConfirmWrite(fnArgs.path, fnArgs.content);
            if (!confirmed) {
              const cancelResult = {
                success: false,
                error: 'User declined to create this file.',
                summary: 'Write cancelled by user',
              };
              printToolResult(cancelResult.summary);
              console.log('');
              functionResponses.push(
                createPartFromFunctionResponse(fnId, fnName, cancelResult)
              );
              continue;
            }
          }

          // Execute tool
          const result = await executeTool(fnName, fnArgs);
          const summary = (result.summary as string) || (result.success ? 'Success' : (result.error as string));
          printToolResult(summary);
          console.log('');

          functionResponses.push(
            createPartFromFunctionResponse(fnId, fnName, result)
          );
        }

        // Send results back to LLM
        response = await this.chat.sendMessage({ message: functionResponses });
      }
    } catch (error: any) {
      const errMsg = error.message || '';
      // Automatic model fallback if model experiences high demand (503) or exhausted quota (429)
      if (
        (errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('404')) &&
        this.model !== 'gemini-3.5-flash-lite'
      ) {
        console.log(
          pc.yellow(
            `\n⚠️  O modelo "${this.model}" está temporariamente indisponível na API (${
              errMsg.includes('503') ? '503 Alta Demanda' : errMsg.includes('429') ? '429 Cota Esgotada' : 'Indisponível'
            }).`
          )
        );
        console.log(mint(`⚡ Alternando automaticamente para "gemini-3.5-flash-lite" (ultra estável)...\n`));
        this.setModel('gemini-3.5-flash-lite');
        return await this.run(userPrompt, onConfirmWrite);
      }

      console.log(pc.red(`\n❌ Erro: ${error.message}\n`));
    }
  }

  public resetChat() {
    this.initChat();
  }

  public getModel(): string {
    return this.model;
  }

  public setModel(newModel: string): void {
    this.model = newModel;
    this.initChat();
  }

  public getPersona(): PersonaType {
    return this.persona;
  }

  public setPersona(newPersona: PersonaType): void {
    this.persona = newPersona;
    this.initChat();
  }

  public async listRemoteModels(): Promise<string[]> {
    try {
      const response = await this.ai.models.list();
      const models: string[] = [];
      for await (const m of response) {
        if (m.name && m.name.toLowerCase().includes('gemini')) {
          models.push(m.name.replace(/^models\//, ''));
        }
      }
      return models;
    } catch {
      return [];
    }
  }
}
