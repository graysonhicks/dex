import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

const getOctokit = () =>
    new Octokit({ auth: process.env.GITHUB_TOKEN });

export const fetchReleaseContextTool = createTool({
    id: 'fetch-release-context',
    description:
        'Fetches GitHub release details and compares diff to previous tag to produce release context.',
    inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
        tagName: z.string().describe('Release tag (e.g. v0.20.2)'),
    }),
    outputSchema: z.object({
        releaseNotes: z.string(),
        currentTag: z.string(),
        previousTag: z.string().nullable(),
        diffFiles: z
            .array(
                z.object({
                    filename: z.string(),
                    status: z.string(),
                    additions: z.number(),
                    deletions: z.number(),
                    changes: z.number(),
                    patch: z.string().optional(),
                }),
            )
            .describe('Files changed between previous and current tags'),
    }),
    execute: async ({ context }) => {
        const { owner, repo, tagName } = context;
        const octokit = getOctokit();

        const releases = await octokit.repos.listReleases({ owner, repo, per_page: 100 });
        const current = releases.data.find((r) => r.tag_name === tagName);
        if (!current) throw new Error(`Release ${tagName} not found`);

        // Find previous published release by published_at
        const sorted = releases.data
            .filter((r) => !!r.published_at)
            .sort((a, b) => new Date(a.published_at!).getTime() - new Date(b.published_at!).getTime());
        const idx = sorted.findIndex((r) => r.tag_name === tagName);
        const prev = idx > 0 ? sorted[idx - 1] : undefined;

        let diffFiles: Array<{ filename: string; status: string; additions: number; deletions: number; changes: number; patch?: string }> = [];
        if (prev?.tag_name) {
            const compare = await octokit.repos.compareCommitsWithBasehead({
                owner,
                repo,
                basehead: `${prev.tag_name}...${tagName}`,
                per_page: 250,
            });
            diffFiles = (compare.data.files || []).map((f) => ({
                filename: f.filename,
                status: f.status || 'modified',
                additions: f.additions || 0,
                deletions: f.deletions || 0,
                changes: f.changes || 0,
                patch: f.patch,
            }));
        }

        return {
            releaseNotes: current.body || '',
            currentTag: tagName,
            previousTag: prev?.tag_name ?? null,
            diffFiles,
        };
    },
});

export const createDocsPullRequestTool = createTool({
    id: 'create-docs-pr',
    description:
        'Creates or updates a branch with proposed doc changes and opens a PR in the GitHub repo.',
    inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
        baseBranch: z.string().default('main'),
        branchName: z.string().describe('Feature branch to push docs proposals'),
        prTitle: z.string(),
        prBody: z.string().optional(),
        files: z.array(
            z.object({
                path: z.string().describe('Repo-relative path for the file'),
                content: z.string().describe('Full file content (utf-8)'),
            }),
        ),
    }),
    outputSchema: z.object({
        prNumber: z.number(),
        prUrl: z.string(),
        branchName: z.string(),
    }),
    execute: async ({ context }) => {
        const { owner, repo, baseBranch, branchName, prTitle, prBody, files } = context;
        const octokit = getOctokit();

        // Get base ref
        const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
        const baseSha = baseRef.data.object.sha;

        // Try to create the branch (ignore if exists)
        try {
            await octokit.git.createRef({
                owner,
                repo,
                ref: `refs/heads/${branchName}`,
                sha: baseSha,
            });
        } catch (_) { }

        // Get latest branch sha
        const branchRef = await octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
        let latestCommitSha = branchRef.data.object.sha;
        const latestCommit = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });
        const baseTreeSha = latestCommit.data.tree.sha;

        // Create a tree with file blobs
        const blobs = await Promise.all(
            files.map(async (f) => {
                const blob = await octokit.git.createBlob({ owner, repo, content: Buffer.from(f.content, 'utf8').toString('base64'), encoding: 'base64' });
                return { path: f.path, sha: blob.data.sha, mode: '100644' as const, type: 'blob' as const };
            }),
        );

        const tree = await octokit.git.createTree({
            owner,
            repo,
            base_tree: baseTreeSha,
            tree: blobs,
        });

        const commit = await octokit.git.createCommit({
            owner,
            repo,
            message: prTitle,
            tree: tree.data.sha,
            parents: [latestCommitSha],
        });

        await octokit.git.updateRef({ owner, repo, ref: `heads/${branchName}`, sha: commit.data.sha, force: true });

        // Open PR (idempotent by title + head)
        const prs = await octokit.pulls.list({ owner, repo, state: 'open', head: `${owner}:${branchName}` });
        const existing = prs.data[0];
        const pr =
            existing ||
            (
                await octokit.pulls.create({
                    owner,
                    repo,
                    head: branchName,
                    base: baseBranch,
                    title: prTitle,
                    body: prBody,
                })
            ).data;

        return { prNumber: pr.number, prUrl: pr.html_url, branchName };
    },
});

export const postSlackNotificationTool = createTool({
    id: 'post-slack-notification',
    description: 'Posts a message to a Slack channel with links and summary.',
    inputSchema: z.object({
        channel: z.string(),
        text: z.string(),
    }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ context }) => {
        const { WebClient } = await import('@slack/web-api');
        const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
        const res = await slack.chat.postMessage({ channel: context.channel, text: context.text });
        return { ok: !!res.ok };
    },
});


