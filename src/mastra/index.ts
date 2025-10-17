
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';
import docsSyncWorkflow from './workflows/docs-sync-workflow';
import { docsAgent } from './agents/docs-agent';
import type { RequestListener } from 'http';

export const mastra = new Mastra({
  workflows: { weatherWorkflow, docsSyncWorkflow },
  agents: { weatherAgent, docsAgent },
  storage: new LibSQLStore({
    // stores observability, scores, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: {
    // Telemetry is deprecated and will be removed in the Nov 4th release
    enabled: false,
  },
  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true },
  },
  server: {
    apiRoutes: [
      {
        path: '/api/webhooks/github',
        method: 'POST',
        createHandler: async ({ mastra }) => {
          const handler: RequestListener = async (req, res) => {
            try {
              const chunks: Uint8Array[] = [];
              for await (const chunk of req) chunks.push(chunk as Uint8Array);
              const bodyRaw = Buffer.concat(chunks).toString('utf8');
              const body = bodyRaw ? JSON.parse(bodyRaw) : {};

              // Only handle release events with "published" action
              const event = req.headers['x-github-event'];
              if (event !== 'release' || body.action !== 'published') {
                res.statusCode = 200;
                res.end('ignored');
                return;
              }

              const repoFull: string = body?.repository?.full_name || '';
              const [owner, repo] = repoFull.split('/');
              const releaseNotes: string | undefined = body?.release?.body || undefined;

              const workflow = mastra.getWorkflow('docsSyncWorkflow');
              const run = await workflow.createRunAsync();
              const result = await run.start({
                inputData: {
                  owner,
                  repo,
                  releaseNotes,
                  baseBranch: process.env.DOCS_BASE_BRANCH || 'main',
                  docsBranchPrefix: process.env.DOCS_BRANCH_PREFIX || 'docs/update-',
                  slackChannel: process.env.SLACK_CHANNEL || '#docs',
                },
              });

              res.statusCode = 200;
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(e?.message || 'error');
            }
          };
          return handler;
        },
      },
    ],
  },
});
