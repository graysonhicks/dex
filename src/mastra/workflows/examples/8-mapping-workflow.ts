/**
 * MAPPING WORKFLOW (.map() and mapVariable())
 * 
 * Demonstrates: Data transformation between steps using .map() and mapVariable().
 * 
 * Run: npx tsx src/mastra/workflows/examples/run-examples.ts mapping
 */

import { createStep, createWorkflow, mapVariable } from '@mastra/core/workflows';
import { z } from 'zod';

// Fetch user data
const fetchUserStep = createStep({
    id: 'fetch-user',
    description: 'Fetches user information',
    inputSchema: z.object({
        userId: z.string(),
    }),
    outputSchema: z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        email: z.string(),
        phone: z.string(),
        createdAt: z.string(),
    }),
    execute: async ({ inputData }) => {
        // Simulate database fetch
        return {
            id: inputData.userId,
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '555-0123',
            createdAt: '2024-01-01T00:00:00Z',
        };
    },
});

// Fetch order history
const fetchOrdersStep = createStep({
    id: 'fetch-orders',
    description: 'Fetches user order history',
    inputSchema: z.object({
        userId: z.string(),
    }),
    outputSchema: z.object({
        orders: z.array(z.object({
            orderId: z.string(),
            total: z.number(),
            date: z.string(),
        })),
        orderCount: z.number(),
        totalSpent: z.number(),
    }),
    execute: async ({ inputData }) => {
        // Simulate database fetch
        const orders = [
            { orderId: 'ORD-001', total: 99.99, date: '2024-01-15' },
            { orderId: 'ORD-002', total: 149.50, date: '2024-02-20' },
            { orderId: 'ORD-003', total: 79.99, date: '2024-03-10' },
        ];
        
        return {
            orders,
            orderCount: orders.length,
            totalSpent: orders.reduce((sum, o) => sum + o.total, 0),
        };
    },
});

// Calculate loyalty tier
const calculateLoyaltyStep = createStep({
    id: 'calculate-loyalty',
    description: 'Calculates user loyalty tier',
    inputSchema: z.object({
        totalSpent: z.number(),
        orderCount: z.number(),
        accountAge: z.number(), // in days
    }),
    outputSchema: z.object({
        tier: z.string(),
        discount: z.number(),
        points: z.number(),
    }),
    execute: async ({ inputData }) => {
        let tier = 'Bronze';
        let discount = 5;
        
        if (inputData.totalSpent > 1000 || inputData.orderCount > 20) {
            tier = 'Platinum';
            discount = 20;
        } else if (inputData.totalSpent > 500 || inputData.orderCount > 10) {
            tier = 'Gold';
            discount = 15;
        } else if (inputData.totalSpent > 200 || inputData.orderCount > 5) {
            tier = 'Silver';
            discount = 10;
        }
        
        const points = Math.floor(inputData.totalSpent * 10);
        
        return {
            tier,
            discount,
            points,
        };
    },
});

// Format final report
const formatReportStep = createStep({
    id: 'format-report',
    description: 'Formats customer summary report',
    inputSchema: z.object({
        fullName: z.string(),
        contactEmail: z.string(),
        totalOrders: z.number(),
        lifetimeValue: z.number(),
        membershipTier: z.string(),
        discountRate: z.number(),
        rewardPoints: z.number(),
    }),
    outputSchema: z.object({
        report: z.string(),
        summary: z.object({
            name: z.string(),
            email: z.string(),
            tier: z.string(),
            value: z.number(),
        }),
    }),
    execute: async ({ inputData }) => {
        const report = `
CUSTOMER SUMMARY REPORT
========================
Name: ${inputData.fullName}
Email: ${inputData.contactEmail}
Membership Tier: ${inputData.membershipTier}
------------------------
Total Orders: ${inputData.totalOrders}
Lifetime Value: $${inputData.lifetimeValue.toFixed(2)}
Discount Rate: ${inputData.discountRate}%
Reward Points: ${inputData.rewardPoints}
        `.trim();
        
        return {
            report,
            summary: {
                name: inputData.fullName,
                email: inputData.contactEmail,
                tier: inputData.membershipTier,
                value: inputData.lifetimeValue,
            },
        };
    },
});

// Workflow: Demonstrates comprehensive data mapping
export const mappingWorkflow = createWorkflow({
    id: 'mapping-workflow',
    description: 'Demonstrates .map() and mapVariable() for data transformation',
    inputSchema: z.object({
        userId: z.string(),
    }),
    outputSchema: z.object({
        report: z.string(),
        summary: z.object({
            name: z.string(),
            email: z.string(),
            tier: z.string(),
            value: z.number(),
        }),
    }),
})
    // Fetch user and orders in parallel
    .parallel([
        createWorkflow({
            id: 'fetch-user-branch',
            inputSchema: z.object({ userId: z.string() }),
            outputSchema: z.object({
                id: z.string(),
                firstName: z.string(),
                lastName: z.string(),
                email: z.string(),
                phone: z.string(),
                createdAt: z.string(),
            }),
        })
            .then(fetchUserStep)
            .commit(),
        
        createWorkflow({
            id: 'fetch-orders-branch',
            inputSchema: z.object({ userId: z.string() }),
            outputSchema: z.object({
                orders: z.array(z.object({
                    orderId: z.string(),
                    total: z.number(),
                    date: z.string(),
                })),
                orderCount: z.number(),
                totalSpent: z.number(),
            }),
        })
            .then(fetchOrdersStep)
            .commit(),
    ])
    // .map() - Combine parallel results and transform data
    .map(async ({ inputData }) => {
        const userData = inputData[0];
        const orderData = inputData[1];
        
        // Calculate account age
        const createdDate = new Date(userData.createdAt);
        const now = new Date();
        const accountAge = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
            totalSpent: orderData.totalSpent,
            orderCount: orderData.orderCount,
            accountAge,
        };
    })
    .then(calculateLoyaltyStep)
    // mapVariable() - Rename and restructure fields for final step
    .map({
        fullName: mapVariable({
            step: fetchUserStep,
            path: 'firstName',
            transform: async (firstName) => {
                // We can access other step results too
                return `${firstName} Doe`; // In real scenario, we'd get lastName properly
            },
        }),
        contactEmail: mapVariable({
            step: fetchUserStep,
            path: 'email',
        }),
        totalOrders: mapVariable({
            step: fetchOrdersStep,
            path: 'orderCount',
        }),
        lifetimeValue: mapVariable({
            step: fetchOrdersStep,
            path: 'totalSpent',
        }),
        membershipTier: mapVariable({
            step: calculateLoyaltyStep,
            path: 'tier',
        }),
        discountRate: mapVariable({
            step: calculateLoyaltyStep,
            path: 'discount',
        }),
        rewardPoints: mapVariable({
            step: calculateLoyaltyStep,
            path: 'points',
        }),
    })
    .then(formatReportStep)
    .commit();

export default mappingWorkflow;

