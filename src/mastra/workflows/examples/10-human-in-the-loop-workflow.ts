/**
 * HUMAN-IN-THE-LOOP WORKFLOW
 * 
 * Demonstrates: Multi-turn interaction using suspend/resume with dountil loop.
 * Reference: https://mastra.ai/docs/workflows/human-in-the-loop
 * 
 * This is a number guessing game that shows how workflows can:
 * - Suspend and wait for user input multiple times
 * - Loop until a condition is met (correct guess)
 * - Track state across multiple interactions
 * 
 * Run: npx tsx src/mastra/workflows/examples/run-examples.ts hitl
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Step 1: Initialize the game
const initializeGameStep = createStep({
    id: 'initialize-game',
    description: 'Starts a new number guessing game',
    inputSchema: z.object({
        minNumber: z.number().default(1),
        maxNumber: z.number().default(100),
    }),
    outputSchema: z.object({
        secretNumber: z.number(),
        guessCount: z.number(),
        minNumber: z.number(),
        maxNumber: z.number(),
    }),
    execute: async ({ inputData }) => {
        // Generate random number
        const secretNumber = Math.floor(
            Math.random() * (inputData.maxNumber - inputData.minNumber + 1)
        ) + inputData.minNumber;
        
        return {
            secretNumber,
            guessCount: 0,
            minNumber: inputData.minNumber,
            maxNumber: inputData.maxNumber,
        };
    },
});

// Step 2: Game loop - suspends for user input, checks guess, repeats until correct
const gameLoopStep = createStep({
    id: 'game-loop',
    description: 'Handles the guess-feedback loop',
    inputSchema: z.object({
        secretNumber: z.number(),
        guessCount: z.number(),
        minNumber: z.number(),
        maxNumber: z.number(),
    }),
    resumeSchema: z.object({
        guess: z.number(),
    }),
    suspendSchema: z.object({
        message: z.string(),
        guessCount: z.number(),
        hint: z.string().optional(),
    }),
    outputSchema: z.object({
        secretNumber: z.number(),
        guessCount: z.number(),
        isCorrect: z.boolean(),
        lastGuess: z.number(),
        feedback: z.string(),
    }),
    execute: async ({ inputData, resumeData, suspend }) => {
        const { secretNumber, guessCount, minNumber, maxNumber } = inputData;
        
        // First time - no guess yet, suspend for initial input
        if (!resumeData) {
            return await suspend({
                message: `I'm thinking of a number between ${minNumber} and ${maxNumber}. Take a guess!`,
                guessCount: 0,
            });
        }
        
        // Got a guess - check it
        const guess = resumeData.guess;
        const newGuessCount = guessCount + 1;
        
        if (guess === secretNumber) {
            return {
                secretNumber,
                guessCount: newGuessCount,
                isCorrect: true,
                lastGuess: guess,
                feedback: `🎉 Correct! You guessed it in ${newGuessCount} tries!`,
            };
        }
        
        // Wrong guess - provide feedback
        let feedback = '';
        let hint = '';
        
        if (guess < secretNumber) {
            feedback = '📈 Too low!';
            hint = `Try a number between ${guess} and ${maxNumber}`;
        } else {
            feedback = '📉 Too high!';
            hint = `Try a number between ${minNumber} and ${guess}`;
        }
        
        return {
            secretNumber,
            guessCount: newGuessCount,
            isCorrect: false,
            lastGuess: guess,
            feedback,
        };
    },
});

// Step 3: Game summary
const gameSummaryStep = createStep({
    id: 'game-summary',
    description: 'Shows game summary',
    inputSchema: z.object({
        secretNumber: z.number(),
        guessCount: z.number(),
        isCorrect: z.boolean(),
        lastGuess: z.number(),
        feedback: z.string(),
    }),
    outputSchema: z.object({
        won: z.boolean(),
        totalGuesses: z.number(),
        secretNumber: z.number(),
        message: z.string(),
    }),
    execute: async ({ inputData }) => {
        return {
            won: inputData.isCorrect,
            totalGuesses: inputData.guessCount,
            secretNumber: inputData.secretNumber,
            message: `Game completed! The number was ${inputData.secretNumber}. You took ${inputData.guessCount} guesses.`,
        };
    },
});

// Main workflow: Multi-turn guessing game
export const humanInTheLoopWorkflow = createWorkflow({
    id: 'human-in-the-loop-workflow',
    description: 'Demonstrates multi-turn human interaction with suspend/resume and dountil',
    inputSchema: z.object({
        minNumber: z.number().default(1),
        maxNumber: z.number().default(100),
    }),
    outputSchema: z.object({
        won: z.boolean(),
        totalGuesses: z.number(),
        secretNumber: z.number(),
        message: z.string(),
    }),
})
    // Initialize the game
    .then(initializeGameStep)
    
    // Loop until correct guess (multi-turn interaction!)
    // Each iteration suspends for user input
    .dountil(
        gameLoopStep,
        async ({ inputData }) => {
            // Stop when guess is correct
            return inputData.isCorrect === true;
        }
    )
    
    // Show game summary
    .then(gameSummaryStep)
    .commit();

export default humanInTheLoopWorkflow;

