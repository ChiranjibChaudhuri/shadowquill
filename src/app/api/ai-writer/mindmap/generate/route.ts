import { google } from '@ai-sdk/google';
import { generateObject } from 'ai'; // Use generateObject
import { z } from 'zod'; // Import Zod
import { mindMapGeneratorSystemPrompt } from '@/lib/prompts';

// Allow longer responses for object generation
export const maxDuration = 60; // Increased duration

// Define the Zod schema for ReactFlow structure
const reactFlowSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.object({ label: z.string() }),
    // Add other optional node properties if needed, e.g., type: z.string().optional()
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
    // Add other optional edge properties if needed
  })),
});

export async function POST(req: Request) {
  try {
    const { worldContext, characterContext, outlineContext } = await req.json();

    // Basic validation
    if (!worldContext || !characterContext || !outlineContext) {
      return new Response(JSON.stringify({ error: 'Missing required context (world, characters, outline)' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Prepare the prompt with injected context
    const promptContent = mindMapGeneratorSystemPrompt
      .replace('{worldContext}', worldContext)
      .replace('{characterContext}', characterContext)
      .replace('{outlineContext}', outlineContext);

    // Use generateObject with the schema
    const { object } = await generateObject({
      model: google('models/gemini-2.5-flash-preview-04-17'),
      schema: reactFlowSchema, // Provide the Zod schema
      prompt: promptContent, // Use the combined context as the main prompt
      // System prompt can still guide the overall task if needed, but primary instructions are in the main prompt now for generateObject
      // system: "Generate a ReactFlow mind map structure.",
      temperature: 0.5,
      maxTokens: 65000, // Keep maxTokens, though object generation might behave differently
    });

    // Return the generated object directly as JSON
    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error generating mind map object:', error);
    // Ensure error response is also JSON
    return new Response(JSON.stringify({ error: `Error generating mind map object: ${error.message || 'Unknown error'}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}