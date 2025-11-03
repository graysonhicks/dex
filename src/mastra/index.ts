
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';
import docsSyncWorkflow from './workflows/docs-sync-workflow';
import { docsAgent } from './agents/docs-agent';

// Example workflows
import sequentialWorkflow from './workflows/examples/1-sequential-workflow';
import parallelWorkflow from './workflows/examples/2-parallel-workflow';
import branchWorkflow from './workflows/examples/3-branch-workflow';
import suspendResumeWorkflow from './workflows/examples/4-suspend-resume-workflow';
import foreachWorkflow from './workflows/examples/5-foreach-workflow';
import loopWorkflow from './workflows/examples/6-loop-workflow';
import nestedWorkflow from './workflows/examples/7-nested-workflow';
import mappingWorkflow from './workflows/examples/8-mapping-workflow';
import errorHandlingWorkflow from './workflows/examples/9-error-handling-workflow';

export const mastra = new Mastra({
  workflows: { 
    weatherWorkflow, 
    docsSyncWorkflow,
    // Example workflows
    sequentialWorkflow,
    parallelWorkflow,
    branchWorkflow,
    suspendResumeWorkflow,
    foreachWorkflow,
    loopWorkflow,
    nestedWorkflow,
    mappingWorkflow,
    errorHandlingWorkflow,
  },
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
  bundler: {
    externals: ['@slack/web-api'],
  },
  server: {
    apiRoutes: [
      {
        path: '/api/webhooks/github',
        method: 'POST',
        createHandler: async ({ mastra }) => {
          return async (c) => {
            try {
              const body = await c.req.json().catch(() => ({}));

              // Only handle release events with "published" action
              const event = c.req.header('x-github-event');
              if (event !== 'release' || body.action !== 'published') {
                return c.text('ignored', 200);
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

              return c.json(result, 200);
            } catch (e: any) {
              return c.text(e?.message || 'error', 500);
            }
          };
        },
      },
    ],
  },
});
