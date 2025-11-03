/**
 * SUSPEND & RESUME WORKFLOW
 * 
 * Demonstrates: Pausing workflow execution to wait for external input
 * (human-in-the-loop pattern).
 * 
 * Run: npx tsx src/mastra/workflows/examples/run-examples.ts suspend
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Analyze expense request
const analyzeExpenseStep = createStep({
    id: 'analyze-expense',
    description: 'Analyzes expense request details',
    inputSchema: z.object({
        employeeName: z.string(),
        amount: z.number(),
        category: z.string(),
        description: z.string(),
    }),
    outputSchema: z.object({
        employeeName: z.string(),
        amount: z.number(),
        category: z.string(),
        description: z.string(),
        requiresApproval: z.boolean(),
        approverLevel: z.string(),
    }),
    execute: async ({ inputData }) => {
        // Determine if approval is needed based on amount
        const requiresApproval = inputData.amount > 100;
        const approverLevel = inputData.amount > 1000 ? 'senior-manager' : 'manager';
        
        return {
            ...inputData,
            requiresApproval,
            approverLevel,
        };
    },
});

// Wait for approval (suspends workflow)
const approvalStep = createStep({
    id: 'approval',
    description: 'Wait for manager approval',
    inputSchema: z.object({
        employeeName: z.string(),
        amount: z.number(),
        category: z.string(),
        description: z.string(),
        requiresApproval: z.boolean(),
        approverLevel: z.string(),
    }),
    resumeSchema: z.object({
        approved: z.boolean(),
        approverName: z.string(),
        approverComments: z.string().optional(),
    }),
    suspendSchema: z.object({
        message: z.string(),
        pendingApprover: z.string(),
        requestDetails: z.object({
            employee: z.string(),
            amount: z.number(),
            category: z.string(),
        }),
    }),
    outputSchema: z.object({
        approved: z.boolean(),
        approverName: z.string(),
        approverComments: z.string().optional(),
        autoApproved: z.boolean(),
    }),
    execute: async ({ inputData, resumeData, suspend }) => {
        // If amount is under threshold, auto-approve
        if (!inputData.requiresApproval) {
            return {
                approved: true,
                approverName: 'system',
                approverComments: 'Auto-approved: under threshold',
                autoApproved: true,
            };
        }
        
        // If no resume data, suspend for approval
        if (!resumeData) {
            return await suspend({
                message: `Expense approval required for $${inputData.amount}`,
                pendingApprover: inputData.approverLevel,
                requestDetails: {
                    employee: inputData.employeeName,
                    amount: inputData.amount,
                    category: inputData.category,
                },
            });
        }
        
        // Resume with approval decision
        return {
            ...resumeData,
            autoApproved: false,
        };
    },
});

// Process the expense
const processExpenseStep = createStep({
    id: 'process-expense',
    description: 'Processes approved expense',
    inputSchema: z.object({
        approved: z.boolean(),
        approverName: z.string(),
        approverComments: z.string().optional(),
        autoApproved: z.boolean(),
    }),
    outputSchema: z.object({
        status: z.string(),
        message: z.string(),
        processedBy: z.string(),
    }),
    execute: async ({ inputData, getInitData }) => {
        const initData = getInitData();
        
        if (!inputData.approved) {
            return {
                status: 'rejected',
                message: `Expense request for $${initData.amount} was rejected`,
                processedBy: inputData.approverName,
            };
        }
        
        return {
            status: 'approved',
            message: `Expense request for $${initData.amount} was ${inputData.autoApproved ? 'auto-' : ''}approved`,
            processedBy: inputData.approverName,
        };
    },
});

// Workflow: Suspend and resume for approval
export const suspendResumeWorkflow = createWorkflow({
    id: 'suspend-resume-workflow',
    description: 'Demonstrates suspend/resume for human approval',
    inputSchema: z.object({
        employeeName: z.string(),
        amount: z.number(),
        category: z.string(),
        description: z.string(),
    }),
    outputSchema: z.object({
        status: z.string(),
        message: z.string(),
        processedBy: z.string(),
    }),
})
    .then(analyzeExpenseStep)
    .then(approvalStep)        // May suspend here!
    .then(processExpenseStep)
    .commit();

export default suspendResumeWorkflow;

