/**
 * BRANCH WORKFLOW (.branch())
 * 
 * Demonstrates: Conditional routing based on data values.
 * 
 * Run: npx tsx src/mastra/workflows/examples/run-examples.ts branch
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Calculate order total
const calculateStep = createStep({
    id: 'calculate',
    description: 'Calculates order total',
    inputSchema: z.object({
        items: z.array(z.object({
            name: z.string(),
            price: z.number(),
            quantity: z.number(),
        })),
    }),
    outputSchema: z.object({
        items: z.array(z.object({
            name: z.string(),
            price: z.number(),
            quantity: z.number(),
        })),
        subtotal: z.number(),
        itemCount: z.number(),
    }),
    execute: async ({ inputData }) => {
        const subtotal = inputData.items.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );
        const itemCount = inputData.items.reduce(
            (sum, item) => sum + item.quantity,
            0
        );
        
        return {
            items: inputData.items,
            subtotal,
            itemCount,
        };
    },
});

// Small order processing (< $50)
const smallOrderStep = createStep({
    id: 'small-order',
    description: 'Process small orders with standard shipping',
    inputSchema: z.object({
        subtotal: z.number(),
        itemCount: z.number(),
    }),
    outputSchema: z.object({
        subtotal: z.number(),
        shipping: z.number(),
        total: z.number(),
        processingType: z.string(),
    }),
    execute: async ({ inputData }) => {
        const shipping = 5.99;
        return {
            subtotal: inputData.subtotal,
            shipping,
            total: inputData.subtotal + shipping,
            processingType: 'standard',
        };
    },
});

// Medium order processing ($50-$200)
const mediumOrderStep = createStep({
    id: 'medium-order',
    description: 'Process medium orders with reduced shipping',
    inputSchema: z.object({
        subtotal: z.number(),
        itemCount: z.number(),
    }),
    outputSchema: z.object({
        subtotal: z.number(),
        shipping: z.number(),
        total: z.number(),
        processingType: z.string(),
    }),
    execute: async ({ inputData }) => {
        const shipping = 2.99;
        return {
            subtotal: inputData.subtotal,
            shipping,
            total: inputData.subtotal + shipping,
            processingType: 'expedited',
        };
    },
});

// Large order processing (>= $200)
const largeOrderStep = createStep({
    id: 'large-order',
    description: 'Process large orders with free shipping',
    inputSchema: z.object({
        subtotal: z.number(),
        itemCount: z.number(),
    }),
    outputSchema: z.object({
        subtotal: z.number(),
        shipping: z.number(),
        total: z.number(),
        processingType: z.string(),
    }),
    execute: async ({ inputData }) => {
        return {
            subtotal: inputData.subtotal,
            shipping: 0,
            total: inputData.subtotal,
            processingType: 'priority',
        };
    },
});

// Workflow: Conditional branching based on order value
export const branchWorkflow = createWorkflow({
    id: 'branch-workflow',
    description: 'Demonstrates conditional branching based on order value',
    inputSchema: z.object({
        items: z.array(z.object({
            name: z.string(),
            price: z.number(),
            quantity: z.number(),
        })),
    }),
    outputSchema: z.object({
        subtotal: z.number(),
        shipping: z.number(),
        total: z.number(),
        processingType: z.string(),
    }),
})
    .then(calculateStep)
    // Branch based on order value
    .map(async ({ inputData }) => ({
        subtotal: inputData.subtotal,
        itemCount: inputData.itemCount,
    }))
    .branch([
        // Condition 1: Small orders
        [
            async ({ inputData }) => inputData.subtotal < 50,
            smallOrderStep,
        ],
        // Condition 2: Medium orders
        [
            async ({ inputData }) => inputData.subtotal >= 50 && inputData.subtotal < 200,
            mediumOrderStep,
        ],
        // Condition 3: Large orders
        [
            async ({ inputData }) => inputData.subtotal >= 200,
            largeOrderStep,
        ],
    ])
    .commit();

export default branchWorkflow;

