/**
 * SEQUENTIAL WORKFLOW (.then())
 * 
 * Demonstrates: Basic step chaining where output flows automatically
 * when schemas match between steps.
 * 
 * Run: npx tsx src/mastra/workflows/examples/run-examples.ts sequential
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Step 1: Validates and normalizes input
const validateStep = createStep({
    id: 'validate',
    description: 'Validates email format',
    inputSchema: z.object({
        email: z.string(),
    }),
    outputSchema: z.object({
        email: z.string(),
        isValid: z.boolean(),
    }),
    execute: async ({ inputData }) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return {
            email: inputData.email.toLowerCase().trim(),
            isValid: emailRegex.test(inputData.email),
        };
    },
});

// Step 2: Enriches with domain info
const enrichStep = createStep({
    id: 'enrich',
    description: 'Extracts domain information',
    inputSchema: z.object({
        email: z.string(),
        isValid: z.boolean(),
    }),
    outputSchema: z.object({
        email: z.string(),
        isValid: z.boolean(),
        domain: z.string(),
    }),
    execute: async ({ inputData }) => {
        const domain = inputData.email.split('@')[1] || 'unknown';
        return {
            ...inputData,
            domain,
        };
    },
});

// Step 3: Categorizes email type
const categorizeStep = createStep({
    id: 'categorize',
    description: 'Categorizes email by domain',
    inputSchema: z.object({
        email: z.string(),
        isValid: z.boolean(),
        domain: z.string(),
    }),
    outputSchema: z.object({
        email: z.string(),
        isValid: z.boolean(),
        domain: z.string(),
        category: z.string(),
    }),
    execute: async ({ inputData }) => {
        let category = 'personal';
        
        if (inputData.domain.includes('gmail') || inputData.domain.includes('yahoo')) {
            category = 'consumer';
        } else if (inputData.domain.includes('.edu')) {
            category = 'education';
        } else if (inputData.domain.includes('.gov')) {
            category = 'government';
        } else {
            category = 'business';
        }
        
        return {
            ...inputData,
            category,
        };
    },
});

// Workflow: Sequential chaining - no .map() needed because schemas align
export const sequentialWorkflow = createWorkflow({
    id: 'sequential-workflow',
    description: 'Demonstrates sequential step execution with automatic data flow',
    inputSchema: z.object({
        email: z.string(),
    }),
    outputSchema: z.object({
        email: z.string(),
        isValid: z.boolean(),
        domain: z.string(),
        category: z.string(),
    }),
})
    .then(validateStep)      // Output: { email, isValid }
    .then(enrichStep)        // Input matches previous output ✓
    .then(categorizeStep)    // Input matches previous output ✓
    .commit();

export default sequentialWorkflow;

