/**
 * LOOP WORKFLOW (.dountil())
 * 
 * Demonstrates: Retrying operations until success or max attempts.
 * 
 * Run: npx tsx src/mastra/workflows/examples/run-examples.ts loop
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Initialize retry attempt
const initializeStep = createStep({
    id: 'initialize',
    description: 'Initializes API call attempt',
    inputSchema: z.object({
        endpoint: z.string(),
        maxRetries: z.number(),
    }),
    outputSchema: z.object({
        endpoint: z.string(),
        maxRetries: z.number(),
        attemptNumber: z.number(),
        success: z.boolean(),
    }),
    execute: async ({ inputData }) => {
        return {
            ...inputData,
            attemptNumber: 0,
            success: false,
        };
    },
});

// Attempt API call (may fail and retry)
const attemptApiCallStep = createStep({
    id: 'attempt-api-call',
    description: 'Attempts to call external API',
    inputSchema: z.object({
        endpoint: z.string(),
        maxRetries: z.number(),
        attemptNumber: z.number(),
        success: z.boolean(),
    }),
    outputSchema: z.object({
        endpoint: z.string(),
        maxRetries: z.number(),
        attemptNumber: z.number(),
        success: z.boolean(),
        responseData: z.any().optional(),
        errorMessage: z.string().optional(),
    }),
    execute: async ({ inputData, runCount }) => {
        const currentAttempt = runCount || 0;
        
        // Simulate API call with 40% success rate per attempt
        // Success rate increases with each attempt
        const successProbability = 0.4 + (currentAttempt * 0.2);
        const success = Math.random() < successProbability;
        
        console.log(`Attempt ${currentAttempt + 1}: ${success ? 'SUCCESS' : 'FAILED'}`);
        
        if (success) {
            return {
                ...inputData,
                attemptNumber: currentAttempt + 1,
                success: true,
                responseData: { data: `Success on attempt ${currentAttempt + 1}` },
            };
        }
        
        // Check if we've exceeded max retries
        if (currentAttempt >= inputData.maxRetries - 1) {
            throw new Error(`API call failed after ${inputData.maxRetries} attempts`);
        }
        
        // Add exponential backoff delay
        const backoffDelay = Math.min(1000 * Math.pow(2, currentAttempt), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        return {
            ...inputData,
            attemptNumber: currentAttempt + 1,
            success: false,
            errorMessage: `Attempt ${currentAttempt + 1} failed, retrying...`,
        };
    },
});

// Format result
const formatResultStep = createStep({
    id: 'format-result',
    description: 'Formats the final result',
    inputSchema: z.object({
        endpoint: z.string(),
        attemptNumber: z.number(),
        success: z.boolean(),
        responseData: z.any().optional(),
        errorMessage: z.string().optional(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        attempts: z.number(),
        message: z.string(),
        data: z.any().optional(),
    }),
    execute: async ({ inputData }) => {
        return {
            success: inputData.success,
            attempts: inputData.attemptNumber,
            message: inputData.success 
                ? `API call succeeded after ${inputData.attemptNumber} attempts`
                : `API call failed after ${inputData.attemptNumber} attempts`,
            data: inputData.responseData,
        };
    },
});

// Workflow: Retry API call until success or max attempts
export const loopWorkflow = createWorkflow({
    id: 'loop-workflow',
    description: 'Demonstrates dountil loop with retry logic and exponential backoff',
    inputSchema: z.object({
        endpoint: z.string(),
        maxRetries: z.number(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        attempts: z.number(),
        message: z.string(),
        data: z.any().optional(),
    }),
})
    .then(initializeStep)
    // Retry until success or max attempts
    .dountil(
        attemptApiCallStep,
        async ({ inputData }) => {
            // Stop when successful
            return inputData.success === true;
        }
    )
    .then(formatResultStep)
    .commit();

export default loopWorkflow;

