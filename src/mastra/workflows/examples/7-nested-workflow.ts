/**
 * NESTED WORKFLOW
 * 
 * Demonstrates: Using workflows as reusable sub-workflows within other workflows.
 * 
 * Run: npx tsx src/mastra/workflows/examples/run-examples.ts nested
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// ============================================================================
// SUB-WORKFLOW: Address Validation
// ============================================================================
const validateAddressFormatStep = createStep({
    id: 'validate-address-format',
    description: 'Validates address format',
    inputSchema: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
    }),
    outputSchema: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        formatValid: z.boolean(),
    }),
    execute: async ({ inputData }) => {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        const formatValid = zipRegex.test(inputData.zip) && inputData.state.length === 2;
        
        return {
            ...inputData,
            formatValid,
        };
    },
});

const geocodeAddressStep = createStep({
    id: 'geocode-address',
    description: 'Gets coordinates for address',
    inputSchema: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        formatValid: z.boolean(),
    }),
    outputSchema: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        formatValid: z.boolean(),
        latitude: z.number(),
        longitude: z.number(),
    }),
    execute: async ({ inputData }) => {
        // Simulate geocoding
        return {
            ...inputData,
            latitude: 37.7749 + (Math.random() - 0.5),
            longitude: -122.4194 + (Math.random() - 0.5),
        };
    },
});

const addressValidationWorkflow = createWorkflow({
    id: 'address-validation-workflow',
    description: 'Reusable address validation sub-workflow',
    inputSchema: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
    }),
    outputSchema: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        formatValid: z.boolean(),
        latitude: z.number(),
        longitude: z.number(),
    }),
})
    .then(validateAddressFormatStep)
    .then(geocodeAddressStep)
    .commit();

// ============================================================================
// SUB-WORKFLOW: Credit Check
// ============================================================================
const checkCreditScoreStep = createStep({
    id: 'check-credit-score',
    description: 'Checks credit score',
    inputSchema: z.object({
        ssn: z.string(),
    }),
    outputSchema: z.object({
        ssn: z.string(),
        creditScore: z.number(),
        creditRating: z.string(),
    }),
    execute: async ({ inputData }) => {
        // Simulate credit check
        const creditScore = Math.floor(Math.random() * 400) + 400; // 400-800
        let creditRating = 'Poor';
        
        if (creditScore >= 700) creditRating = 'Excellent';
        else if (creditScore >= 650) creditRating = 'Good';
        else if (creditScore >= 600) creditRating = 'Fair';
        
        return {
            ...inputData,
            creditScore,
            creditRating,
        };
    },
});

const creditCheckWorkflow = createWorkflow({
    id: 'credit-check-workflow',
    description: 'Reusable credit check sub-workflow',
    inputSchema: z.object({
        ssn: z.string(),
    }),
    outputSchema: z.object({
        ssn: z.string(),
        creditScore: z.number(),
        creditRating: z.string(),
    }),
})
    .then(checkCreditScoreStep)
    .commit();

// ============================================================================
// MAIN WORKFLOW: Loan Application
// ============================================================================
const collectApplicationDataStep = createStep({
    id: 'collect-application-data',
    description: 'Collects loan application data',
    inputSchema: z.object({
        applicantName: z.string(),
        ssn: z.string(),
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        loanAmount: z.number(),
    }),
    outputSchema: z.object({
        applicantName: z.string(),
        ssn: z.string(),
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        loanAmount: z.number(),
    }),
    execute: async ({ inputData }) => {
        return inputData;
    },
});

const makeLoanDecisionStep = createStep({
    id: 'make-loan-decision',
    description: 'Makes final loan approval decision',
    inputSchema: z.object({
        applicantName: z.string(),
        addressData: z.object({
            formatValid: z.boolean(),
            latitude: z.number(),
            longitude: z.number(),
        }),
        creditData: z.object({
            creditScore: z.number(),
            creditRating: z.string(),
        }),
        loanAmount: z.number(),
    }),
    outputSchema: z.object({
        approved: z.boolean(),
        reason: z.string(),
        applicantName: z.string(),
        loanAmount: z.number(),
        interestRate: z.number().optional(),
    }),
    execute: async ({ inputData }) => {
        const { addressData, creditData, loanAmount, applicantName } = inputData;
        
        // Loan decision logic
        if (!addressData.formatValid) {
            return {
                approved: false,
                reason: 'Invalid address format',
                applicantName,
                loanAmount,
            };
        }
        
        if (creditData.creditScore < 600) {
            return {
                approved: false,
                reason: 'Credit score too low',
                applicantName,
                loanAmount,
            };
        }
        
        // Calculate interest rate based on credit score
        let interestRate = 12;
        if (creditData.creditScore >= 750) interestRate = 4.5;
        else if (creditData.creditScore >= 700) interestRate = 6.0;
        else if (creditData.creditScore >= 650) interestRate = 8.5;
        
        return {
            approved: true,
            reason: `Approved with ${creditData.creditRating} credit`,
            applicantName,
            loanAmount,
            interestRate,
        };
    },
});

// Main workflow: Uses nested workflows
export const nestedWorkflow = createWorkflow({
    id: 'nested-workflow',
    description: 'Demonstrates nested workflows for loan application processing',
    inputSchema: z.object({
        applicantName: z.string(),
        ssn: z.string(),
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        loanAmount: z.number(),
    }),
    outputSchema: z.object({
        approved: z.boolean(),
        reason: z.string(),
        applicantName: z.string(),
        loanAmount: z.number(),
        interestRate: z.number().optional(),
    }),
})
    .then(collectApplicationDataStep)
    // Run validation workflows in parallel
    .parallel([
        // Nested workflow 1: Address validation
        createWorkflow({
            id: 'address-validation-branch',
            inputSchema: z.object({
                applicantName: z.string(),
                ssn: z.string(),
                street: z.string(),
                city: z.string(),
                state: z.string(),
                zip: z.string(),
                loanAmount: z.number(),
            }),
            outputSchema: z.object({
                formatValid: z.boolean(),
                latitude: z.number(),
                longitude: z.number(),
            }),
        })
            .map(async ({ inputData }) => ({
                street: inputData.street,
                city: inputData.city,
                state: inputData.state,
                zip: inputData.zip,
            }))
            .then(addressValidationWorkflow)
            .map(async ({ inputData }) => ({
                formatValid: inputData.formatValid,
                latitude: inputData.latitude,
                longitude: inputData.longitude,
            }))
            .commit(),
        
        // Nested workflow 2: Credit check
        createWorkflow({
            id: 'credit-check-branch',
            inputSchema: z.object({
                applicantName: z.string(),
                ssn: z.string(),
                street: z.string(),
                city: z.string(),
                state: z.string(),
                zip: z.string(),
                loanAmount: z.number(),
            }),
            outputSchema: z.object({
                creditScore: z.number(),
                creditRating: z.string(),
            }),
        })
            .map(async ({ inputData }) => ({
                ssn: inputData.ssn,
            }))
            .then(creditCheckWorkflow)
            .map(async ({ inputData }) => ({
                creditScore: inputData.creditScore,
                creditRating: inputData.creditRating,
            }))
            .commit(),
    ])
    // Combine results and make decision
    .map(async ({ inputData, getInitData }) => {
        const init = getInitData();
        return {
            applicantName: init.applicantName,
            addressData: inputData[0],
            creditData: inputData[1],
            loanAmount: init.loanAmount,
        };
    })
    .then(makeLoanDecisionStep)
    .commit();

export default nestedWorkflow;

