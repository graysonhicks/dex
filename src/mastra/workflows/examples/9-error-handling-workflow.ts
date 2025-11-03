/**
 * ERROR HANDLING WORKFLOW
 * 
 * Demonstrates: Retries, bail(), error branching, and fallback paths.
 * Reference: https://mastra.ai/docs/workflows/error-handling
 * 
 * Run: npx tsx src/mastra/workflows/examples/run-examples.ts error
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Step 1: Check rate limit (can bail early)
const checkRateLimitStep = createStep({
    id: 'check-rate-limit',
    description: 'Checks if rate limit allows processing',
    inputSchema: z.object({
        requestCount: z.number(),
        maxRequests: z.number(),
    }),
    outputSchema: z.object({
        allowed: z.boolean(),
        remaining: z.number(),
    }),
    execute: async ({ inputData, bail }) => {
        const remaining = inputData.maxRequests - inputData.requestCount;
        
        // Bail early if rate limit exceeded - workflow exits successfully
        if (remaining <= 0) {
            return bail({
                allowed: false,
                remaining: 0,
            });
        }
        
        return {
            allowed: true,
            remaining,
        };
    },
});

// Step 2: Risky operation that might fail
const riskyOperationStep = createStep({
    id: 'risky-operation',
    description: 'Attempts a risky operation with error handling',
    inputSchema: z.object({
        allowed: z.boolean(),
        remaining: z.number(),
    }),
    outputSchema: z.object({
        status: z.string(),
        data: z.string().optional(),
        error: z.string().optional(),
    }),
    // Step-level retry: tries 3 times before giving up
    retries: 3,
    execute: async ({ inputData, runCount }) => {
        const attempt = (runCount || 0) + 1;
        console.log(`Risky operation attempt ${attempt}`);
        
        try {
            // Simulate 70% failure rate
            if (Math.random() > 0.3) {
                throw new Error('Operation failed');
            }
            
            return {
                status: 'success',
                data: 'Operation completed successfully',
            };
        } catch (error: any) {
            // After retries exhausted, return error status instead of throwing
            if (attempt >= 3) {
                return {
                    status: 'error',
                    error: error.message,
                };
            }
            // Re-throw to trigger retry
            throw error;
        }
    },
});

// Success path: Process the successful result
const processSuccessStep = createStep({
    id: 'process-success',
    description: 'Processes successful operation result',
    inputSchema: z.object({
        status: z.string(),
        data: z.string().optional(),
        error: z.string().optional(),
    }),
    outputSchema: z.object({
        result: z.string(),
        processedAt: z.string(),
    }),
    execute: async ({ inputData }) => {
        return {
            result: `Success: ${inputData.data}`,
            processedAt: new Date().toISOString(),
        };
    },
});

// Error path: Fallback operation
const fallbackOperationStep = createStep({
    id: 'fallback-operation',
    description: 'Fallback when main operation fails',
    inputSchema: z.object({
        status: z.string(),
        data: z.string().optional(),
        error: z.string().optional(),
    }),
    outputSchema: z.object({
        result: z.string(),
        processedAt: z.string(),
    }),
    execute: async ({ inputData, getStepResult }) => {
        // Use getStepResult to inspect previous step
        const riskyResult = getStepResult(riskyOperationStep);
        
        return {
            result: `Fallback: Using cached data due to error - ${inputData.error}`,
            processedAt: new Date().toISOString(),
        };
    },
});

// Main workflow with error handling control flow
export const errorHandlingWorkflow = createWorkflow({
    id: 'error-handling-workflow',
    description: 'Demonstrates error handling with retries, bail, and conditional branching',
    inputSchema: z.object({
        requestCount: z.number(),
        maxRequests: z.number(),
    }),
    outputSchema: z.object({
        result: z.string(),
        processedAt: z.string(),
    }),
    // Workflow-level retry: applies to all steps (unless overridden)
    retryConfig: {
        attempts: 2,
        delay: 500,
    },
})
    // Check rate limit (can bail early)
    .then(checkRateLimitStep)
    
    // Attempt risky operation (has 3 retries)
    .then(riskyOperationStep)
    
    // Branch based on success or error status
    .branch([
        // Success path
        [
            async ({ inputData }) => inputData.status === 'success',
            processSuccessStep,
        ],
        // Error path (fallback)
        [
            async ({ inputData }) => inputData.status === 'error',
            fallbackOperationStep,
        ],
    ])
    .commit();

export default errorHandlingWorkflow;
