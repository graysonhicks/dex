/**
 * PARALLEL WORKFLOW (.parallel())
 * 
 * Demonstrates: Running independent steps concurrently for better performance.
 * 
 * Run: npx tsx src/mastra/workflows/examples/run-examples.ts parallel
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Prepare data for parallel checks
const prepareStep = createStep({
    id: 'prepare',
    description: 'Prepares user data for validation',
    inputSchema: z.object({
        username: z.string(),
        email: z.string(),
        age: z.number(),
    }),
    outputSchema: z.object({
        username: z.string(),
        email: z.string(),
        age: z.number(),
    }),
    execute: async ({ inputData }) => {
        return inputData;
    },
});

// Parallel Step 1: Check username availability
const checkUsernameStep = createStep({
    id: 'check-username',
    description: 'Validates username availability',
    inputSchema: z.object({
        username: z.string(),
        email: z.string(),
        age: z.number(),
    }),
    outputSchema: z.object({
        usernameAvailable: z.boolean(),
        usernameMessage: z.string(),
    }),
    execute: async ({ inputData }) => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const reserved = ['admin', 'root', 'system'];
        const available = !reserved.includes(inputData.username.toLowerCase());
        
        return {
            usernameAvailable: available,
            usernameMessage: available ? 'Username is available' : 'Username is taken',
        };
    },
});

// Parallel Step 2: Check email validity
const checkEmailStep = createStep({
    id: 'check-email',
    description: 'Validates email format and domain',
    inputSchema: z.object({
        username: z.string(),
        email: z.string(),
        age: z.number(),
    }),
    outputSchema: z.object({
        emailValid: z.boolean(),
        emailMessage: z.string(),
    }),
    execute: async ({ inputData }) => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const valid = emailRegex.test(inputData.email);
        
        return {
            emailValid: valid,
            emailMessage: valid ? 'Email is valid' : 'Email format is invalid',
        };
    },
});

// Parallel Step 3: Check age eligibility
const checkAgeStep = createStep({
    id: 'check-age',
    description: 'Validates age requirements',
    inputSchema: z.object({
        username: z.string(),
        email: z.string(),
        age: z.number(),
    }),
    outputSchema: z.object({
        ageEligible: z.boolean(),
        ageMessage: z.string(),
    }),
    execute: async ({ inputData }) => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const eligible = inputData.age >= 18;
        
        return {
            ageEligible: eligible,
            ageMessage: eligible ? 'Age requirement met' : 'Must be 18 or older',
        };
    },
});

// Aggregate results
const aggregateStep = createStep({
    id: 'aggregate',
    description: 'Combines all validation results',
    inputSchema: z.object({
        results: z.array(z.object({
            usernameAvailable: z.boolean().optional(),
            usernameMessage: z.string().optional(),
            emailValid: z.boolean().optional(),
            emailMessage: z.string().optional(),
            ageEligible: z.boolean().optional(),
            ageMessage: z.string().optional(),
        })),
    }),
    outputSchema: z.object({
        allChecksPassed: z.boolean(),
        messages: z.array(z.string()),
    }),
    execute: async ({ inputData }) => {
        const [username, email, age] = inputData.results;
        
        const allPassed = 
            (username.usernameAvailable ?? false) &&
            (email.emailValid ?? false) &&
            (age.ageEligible ?? false);
        
        const messages = [
            username.usernameMessage,
            email.emailMessage,
            age.ageMessage,
        ].filter(Boolean) as string[];
        
        return {
            allChecksPassed: allPassed,
            messages,
        };
    },
});

// Workflow: Parallel execution - all checks run simultaneously
export const parallelWorkflow = createWorkflow({
    id: 'parallel-workflow',
    description: 'Demonstrates parallel step execution',
    inputSchema: z.object({
        username: z.string(),
        email: z.string(),
        age: z.number(),
    }),
    outputSchema: z.object({
        allChecksPassed: z.boolean(),
        messages: z.array(z.string()),
    }),
})
    .then(prepareStep)
    // These three steps run concurrently! ⚡
    .parallel([
        checkUsernameStep,
        checkEmailStep,
        checkAgeStep,
    ])
    .map(async ({ inputData }) => ({
        results: inputData,
    }))
    .then(aggregateStep)
    .commit();

export default parallelWorkflow;

