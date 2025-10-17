import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

export const docsAgent = new Agent({
    name: 'Docs Agent',
    description:
        'Analyzes GitHub release notes and diffs to propose precise documentation updates as complete markdown files.',
    instructions: `
      You analyze GitHub releases (notes and code diffs) for the Mastra project and propose documentation updates.

      Requirements:
      - Output complete, ready-to-commit markdown files for each proposal.
      - Prefer creating files under ".mastra-doc-proposals/" mirroring intended docs paths.
      - Each proposal must include: target file path (relative to repo), concise rationale, and full file contents.
      - Do NOT include Git patches or partial snippets; produce full file bodies.
      - Keep changes scoped to the features actually changed in this release.
      - Reference accurate names of APIs, functions, and paths.
      - If an existing file needs updates, produce the full updated file content.
      - If unsure where to place a doc, propose under ".mastra-doc-proposals/misc/".
    `,
    model: openai('gpt-4o-mini'),
    memory: new Memory({
        storage: new LibSQLStore({
            url: 'file:../mastra.db',
        }),
    }),
});


