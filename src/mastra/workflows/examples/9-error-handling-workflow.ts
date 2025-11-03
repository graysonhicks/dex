/**
 * ERROR HANDLING WORKFLOW
 * 
 * Demonstrates: Retries, bail(), and error handling strategies.
 * 
 * Run: npx tsx src/mastra/workflows/examples/run-examples.ts error
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Check rate limit (may bail early)
const checkRateLimitStep = createStep({
    id: 'check-rate-limit',
    description: 'Checks if rate limit is exceeded',
    inputSchema: z.object({
        apiKey: z.string(),
        requestCount: z.number(),
    }),
    outputSchema: z.object({
        allowed: z.boolean(),
        remaining: z.number(),
        message: z.string(),
    }),
    execute: async ({ inputData, bail }) => {
        const RATE_LIMIT = 100;
        const remaining = RATE_LIMIT - inputData.requestCount;
        
        // Bail early if rate limit exceeded
        if (remaining <= 0) {
            return bail({
                allowed: false,
                remaining: 0,
                message: 'Rate limit exceeded. Workflow terminated.',
            });
        }
        
        return {
            allowed: true,
            remaining,
            message: `${remaining} requests remaining`,
        };
    },
});

// Fetch data with retries (step-level retry)
const fetchDataStep = createStep({
    id: 'fetch-data',
    description: 'Fetches data from external API with automatic retries',
    inputSchema: z.object({
        apiKey: z.string(),
        endpoint: z.string(),
    }),
    outputSchema: z.object({
        data: z.any(),
        fetchedAt: z.string(),
    }),
    // Step-level retry configuration
    retries: 3,
    execute: async ({ inputData, runCount }) => {
        console.log(`Fetch attempt ${(runCount || 0) + 1}`);
        
        // Simulate API call with 50% failure rate
        const success = Math.random() > 0.5;
        
        if (!success) {
            throw new Error('API request failed');
        }
        
        return {
            data: { result: 'Sample data from API' },
            fetchedAt: new Date().toISOString(),
        };
    },
});

// Process data (may throw error)
const processDataStep = createStep({
    id: 'process-data',
    description: 'Processes fetched data',
    inputSchema: z.object({
        data: z.any(),
        fetchedAt: z.string(),
    }),
    outputSchema: z.object({
        processed: z.boolean(),
        result: z.string(),
    }),
    execute: async ({ inputData }) => {
        // Validate data structure
        if (!inputData.data || typeof inputData.data !== 'object') {
            throw new Error('Invalid data format received');
        }
        
        return {
            processed: true,
            result: JSON.stringify(inputData.data),
        };
    },
});

// Handle errors and provide fallback
const fallbackStep = createStep({
    id: 'fallback',
    description: 'Provides fallback when main processing fails',
    inputSchema: z.object({
        apiKey: z.string(),
        endpoint: z.string(),
    }),
    outputSchema: z.object({
        processed: z.boolean(),
        result: z.string(),
    }),
    execute: async ({ inputData }) => {
        console.log('Using fallback processing');
        
        return {
            processed: true,
            result: 'Fallback data used due to errors',
        };
    },
});

// Format result
const formatResultStep = createStep({
    id: 'format-result',
    description: 'Formats final result',
    inputSchema: z.object({
        processed: z.boolean(),
        result: z.string(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        data: z.string(),
    }),
    execute: async ({ inputData }) => {
        return {
            success: inputData.processed,
            message: inputData.processed ? 'Data processed successfully' : 'Processing failed',
            data: inputData.result,
        };
    },
});

// Workflow: Error handling with retries, bail, and fallback
export const errorHandlingWorkflow = createWorkflow({
    id: 'error-handling-workflow',
    description: 'Demonstrates error handling, retries, bail, and fallback patterns',
    inputSchema: z.object({
        apiKey: z.string(),
        endpoint: z.string(),
        requestCount: z.number(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        data: z.string(),
    }),
    // Workflow-level retry configuration (applies to all steps unless overridden)
    retryConfig: {
        attempts: 2,
        delay: 1000,
    },
})
    .map(async ({ inputData }) => ({
        apiKey: inputData.apiKey,
        requestCount: inputData.requestCount,
    }))
    // Check rate limit (may bail early)
    .then(checkRateLimitStep)
    // Try main path
    .map(async ({ getInitData }) => {
        const init = getInitData();
        return {
            apiKey: init.apiKey,
            endpoint: init.endpoint,
        };
    })
    .branch([
        // Try to fetch and process data
        [
            async () => true,
            createWorkflow({
                id: 'main-processing',
                inputSchema: z.object({
                    apiKey: z.string(),
                    endpoint: z.string(),
                }),
                outputSchema: z.object({
                    processed: z.boolean(),
                    result: z.string(),
                }),
            })
                .then(fetchDataStep)  // Has step-level retries!
                .then(processDataStep)
                .commit(),
        ],
    ])
    .then(formatResultStep)
    .commit();

// Alternative workflow showing fallback pattern
export const errorHandlingWithFallbackWorkflow = createWorkflow({
    id: 'error-handling-fallback-workflow',
    description: 'Demonstrates error handling with explicit fallback branch',
    inputSchema: z.object({
        apiKey: z.string(),
        endpoint: z.string(),
        useMainPath: z.boolean(),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        data: z.string(),
    }),
})
    .map(async ({ inputData }) => ({
        apiKey: inputData.apiKey,
        endpoint: inputData.endpoint,
    }))
    .branch([
        // Main path
        [
            async ({ getInitData }) => {
                const init = getInitData();
                return init.useMainPath;
            },
            createWorkflow({
                id: 'main-path',
                inputSchema: z.object({
                    apiKey: z.string(),
                    endpoint: z.string(),
                }),
                outputSchema: z.object({
                    processed: z.boolean(),
                    result: z.string(),
                }),
            })
                .then(fetchDataStep)
                .then(processDataStep)
                .commit(),
        ],
        // Fallback path
        [
            async ({ getInitData }) => {
                const init = getInitData();
                return !init.useMainPath;
            },
            fallbackStep,
        ],
    ])
    .then(formatResultStep)
    .commit();

export default errorHandlingWorkflow;

