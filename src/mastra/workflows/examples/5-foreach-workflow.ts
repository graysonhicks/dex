/**
 * FOREACH WORKFLOW (.foreach())
 * 
 * Demonstrates: Iterating over an array and processing each item.
 * 
 * Run: npx tsx src/mastra/workflows/examples/run-examples.ts foreach
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Prepare image list
const prepareImagesStep = createStep({
    id: 'prepare-images',
    description: 'Prepares list of images for processing',
    inputSchema: z.object({
        imageUrls: z.array(z.string()),
    }),
    outputSchema: z.array(z.object({
        url: z.string(),
        index: z.number(),
    })),
    execute: async ({ inputData }) => {
        return inputData.imageUrls.map((url, index) => ({
            url,
            index,
        }));
    },
});

// Process individual image
const processImageStep = createStep({
    id: 'process-image',
    description: 'Processes a single image (resize, optimize)',
    inputSchema: z.object({
        url: z.string(),
        index: z.number(),
    }),
    outputSchema: z.object({
        url: z.string(),
        index: z.number(),
        processedUrl: z.string(),
        size: z.number(),
        format: z.string(),
        processingTime: z.number(),
    }),
    execute: async ({ inputData }) => {
        // Simulate image processing
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
        const processingTime = Date.now() - startTime;
        
        return {
            ...inputData,
            processedUrl: `processed-${inputData.url}`,
            size: Math.floor(Math.random() * 1000000), // Random size in bytes
            format: 'webp',
            processingTime,
        };
    },
});

// Aggregate results
const aggregateResultsStep = createStep({
    id: 'aggregate-results',
    description: 'Aggregates all processed images',
    inputSchema: z.array(z.object({
        url: z.string(),
        index: z.number(),
        processedUrl: z.string(),
        size: z.number(),
        format: z.string(),
        processingTime: z.number(),
    })),
    outputSchema: z.object({
        totalImages: z.number(),
        totalSize: z.number(),
        totalProcessingTime: z.number(),
        images: z.array(z.object({
            original: z.string(),
            processed: z.string(),
            size: z.number(),
        })),
    }),
    execute: async ({ inputData }) => {
        const totalSize = inputData.reduce((sum, img) => sum + img.size, 0);
        const totalProcessingTime = inputData.reduce((sum, img) => sum + img.processingTime, 0);
        
        return {
            totalImages: inputData.length,
            totalSize,
            totalProcessingTime,
            images: inputData.map(img => ({
                original: img.url,
                processed: img.processedUrl,
                size: img.size,
            })),
        };
    },
});

// Workflow: Process each image in the array
export const foreachWorkflow = createWorkflow({
    id: 'foreach-workflow',
    description: 'Demonstrates foreach iteration with concurrency control',
    inputSchema: z.object({
        imageUrls: z.array(z.string()),
    }),
    outputSchema: z.object({
        totalImages: z.number(),
        totalSize: z.number(),
        totalProcessingTime: z.number(),
        images: z.array(z.object({
            original: z.string(),
            processed: z.string(),
            size: z.number(),
        })),
    }),
})
    .then(prepareImagesStep)
    // Process each image with max 3 concurrent operations
    .foreach(processImageStep, { concurrency: 3 })
    .then(aggregateResultsStep)
    .commit();

export default foreachWorkflow;

