import { type FunctionDeclaration, Type } from '@google/genai';

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'Search',
    description: 'Searches for files or lists directories matching a glob pattern (e.g. "**" or "src/**").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pattern: {
          type: Type.STRING,
          description: 'The glob pattern or directory to search, defaults to "**".',
        },
      },
    },
  },
  {
    name: 'Read',
    description: 'Reads the entire content of a file.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'The path of the file to read.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'Write',
    description: 'Creates or edits a file with the provided text content.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'The file path to create or write to (e.g. "index.html" or "src/app.ts").',
        },
        content: {
          type: Type.STRING,
          description: 'The full text content to write into the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'Bash',
    description: 'Executes a shell command in the current directory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: {
          type: Type.STRING,
          description: 'The shell command to run (e.g. "git status", "npm test").',
        },
      },
      required: ['command'],
    },
  },
];
