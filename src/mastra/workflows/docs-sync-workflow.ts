import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { docsAgent } from '../agents/docs-agent';
import {
    fetchReleaseContextTool,
    createDocsPullRequestTool,
    postSlackNotificationTool,
} from '../tools/github-docs-tools';

const fetchReleaseContextStep = createStep(fetchReleaseContextTool);

const draftDocsStep = createStep({
    id: 'draft-docs-proposals',
    description: 'Use docs agent to propose markdown changes based on release context',
    inputSchema: z.object({
        releaseNotes: z.string(),
        currentTag: z.string(),
        previousTag: z.string().nullable(),
        diffFiles: z.array(
            z.object({
                filename: z.string(),
                status: z.string(),
                additions: z.number(),
                deletions: z.number(),
                changes: z.number(),
                patch: z.string().optional(),
            }),
        ),
        owner: z.string(),
        repo: z.string(),
    }),
    outputSchema: z.object({
        files: z.array(
            z.object({
                path: z.string(),
                content: z.string(),
            }),
        ),
        prTitle: z.string(),
        prBody: z.string().optional(),
    }),
    execute: async ({ inputData }) => {
        const prompt = `You are provided a GitHub release context for the Mastra repo.

Current Tag: ${inputData.currentTag}
Previous Tag: ${inputData.previousTag ?? 'none'}

Release Notes:\n\n${inputData.releaseNotes}

Changed Files:\n${inputData.diffFiles
                .slice(0, 200)
                .map(
                    (f) => `- ${f.filename} (${f.status}) +${f.additions}/-${f.deletions} (${f.changes} changes)`,
                )
                .join('\n')}

Task: Propose complete markdown file updates that reflect the changes for this release. Output a JSON with shape:
{
  "files": [{"path": "docs/... .mdx", "content": "<full markdown>"}, ...],
  "prTitle": "...",
  "prBody": "..."
}
Only include files relevant to this release. If files already exist in the repo, produce the full updated content as you believe it should be after the release.
`;

        const res = await docsAgent.generate([
            { role: 'user', content: prompt },
        ], {
            maxSteps: 1,
            structuredOutput: {
                schema: z.object({
                    files: z.array(z.object({ path: z.string(), content: z.string() })),
                    prTitle: z.string(),
                    prBody: z.string().optional(),
                }),
            },
        });

        return res.object;
    },
});

const createPrStep = createStep(createDocsPullRequestTool);

const notifySlackStep = createStep(postSlackNotificationTool);

export const docsSyncWorkflow = createWorkflow({
    id: 'docs-sync-workflow',
    description: 'On release, draft docs changes, open PR, and post to Slack',
    inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
        tagName: z.string(),
        baseBranch: z.string().default('main'),
        docsBranchPrefix: z.string().default('docs/update-'),
        slackChannel: z.string(),
    }),
    outputSchema: z.object({
        prUrl: z.string(),
    }),
})
    .map(async ({ getInitData }) => {
        const init = getInitData();
        return {
            owner: init.owner,
            repo: init.repo,
            tagName: init.tagName,
        };
    })
    .then(fetchReleaseContextStep)
    .map(async ({ inputData, getInitData }) => {
        const init = getInitData();
        return {
            owner: init.owner,
            repo: init.repo,
            releaseNotes: inputData.releaseNotes,
            currentTag: inputData.currentTag,
            previousTag: inputData.previousTag,
            diffFiles: inputData.diffFiles,
        };
    })
    .then(draftDocsStep)
    .map(async ({ inputData, getInitData }) => {
        const init = getInitData();
        const safeTag = String(init.tagName || '').replaceAll('/', '-');
        const safeRepo = String(init.repo || '').replaceAll('/', '-');
        const branchName = `${init.docsBranchPrefix}dex-${safeRepo}-docs-${safeTag}`;
        return {
            owner: init.owner,
            repo: init.repo,
            baseBranch: init.baseBranch,
            branchName,
            prTitle: inputData.prTitle,
            prBody: inputData.prBody,
            files: inputData.files,
        };
    })
    .then(createPrStep)
    .map(async ({ inputData, getInitData }) => {
        const init = getInitData();
        return {
            channel: init.slackChannel,
            text: `Docs PR opened for ${init.repo} ${init.tagName}: ${inputData.prUrl}`,
        };
    })
    .then(notifySlackStep)
    .map(async ({ getStepResult }) => {
        const pr = getStepResult(createPrStep);
        return { prUrl: pr.prUrl };
    })
    .commit();

export default docsSyncWorkflow;


