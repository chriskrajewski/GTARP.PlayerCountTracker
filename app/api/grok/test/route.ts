"use strict";

import { NextRequest, NextResponse } from 'next/server';
import { xai } from "@ai-sdk/xai";
import { generateText } from "ai";

export const runtime = 'edge';

// Simple test endpoint to check if the Grok API is working
export async function GET(req: NextRequest) {
  try {
    // Get API key from environment variables
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
      return NextResponse.json(
        { error: 'GROK_API_KEY environment variable is not set.' },
        { status: 500 }
      );
    }

    // Log configuration for debugging
    console.log("Test API Configuration:", {
      model: process.env.GROK_MODEL || 'grok-1',
      apiKeyLength: grokApiKey.length,
      apiKeyStart: grokApiKey.substring(0, 3) + '...',
    });

    // Set API key for XAI
    process.env.XAI_API_KEY = grokApiKey;

    // Send a simple test request
    const testMessage = "Hello, this is a test message to check if the API is working properly.";
    
    // Use the AI SDK's generateText function with the xai model
    const result = await generateText({
      model: xai(process.env.GROK_MODEL || 'grok-1'),
      prompt: testMessage,
      temperature: 0.7,
      maxTokens: 100,
    });

    // Log the complete response for debugging
    console.log("Test API Raw Response:", JSON.stringify(result, null, 2));

    // Return success response with debug info
    return NextResponse.json({
      status: 'success',
      message: 'Grok API connection is working properly',
      response: result,
      responseType: typeof result,
      responseText: result.text,
      responseKeys: Object.keys(result)
    });

  } catch (error: any) {
    console.error("Test API Error:", error);
    
    // Return detailed error response for debugging
    return NextResponse.json({
      status: 'error',
      message: 'Grok API connection test failed',
      error: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    }, { status: 500 });
  }
} 