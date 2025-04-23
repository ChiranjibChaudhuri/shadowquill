import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { sceneGeneratorSystemPrompt } from '@/lib/prompts';

// IMPORTANT: Set the runtime to edge
export const runtime = 'edge';

// Instantiate the Google AI provider
const google = createGoogleGenerativeAI();
const model = google('models/gemini-2.5-flash-preview-04-17');

interface SceneGenerateRequestBody {
  // Context
  worldContext: string;
  characterContext: string;
  outlineContext: string; // Full book outline
  // Chapter Context
  chapterNumber: number;
  chapterTitle: string;
  chapterOutline: string; // Specific outline/focus for this chapter
  previousContext?: string; // Could be previous scene or chapter start
  // Scene Specific
  sceneDescription: string; // User's description of the scene goal
}

export async function POST(req: Request) {
  try {
    // Extract data from the body
    const {
      worldContext,
      characterContext,
      outlineContext,
      previousContext = "Start of the chapter.", // Default if none provided
      chapterNumber,
      chapterTitle,
      chapterOutline,
      sceneDescription, // Get the scene description
    }: SceneGenerateRequestBody = await req.json();

    // Basic validation
    if (!worldContext || !characterContext || !outlineContext || !chapterNumber || !chapterTitle || !chapterOutline || !sceneDescription) {
      return new Response(JSON.stringify({ error: 'Missing required context or scene details for generation.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Inject context into the system prompt
    let systemPrompt = sceneGeneratorSystemPrompt.replace('{outlineContext}', outlineContext);
    systemPrompt = systemPrompt.replace('{worldContext}', worldContext);
    systemPrompt = systemPrompt.replace('{characterContext}', characterContext);
    systemPrompt = systemPrompt.replace('{previousContext}', previousContext);
    systemPrompt = systemPrompt.replace('{chapterNumber}', String(chapterNumber));
    systemPrompt = systemPrompt.replace('{chapterTitle}', chapterTitle);
    systemPrompt = systemPrompt.replace('{chapterOutline}', chapterOutline);
    systemPrompt = systemPrompt.replace('{sceneDescription}', sceneDescription); // Inject scene description


    // Call the language model to generate the scene content
    const result = await streamText({
      model: model,
      prompt: systemPrompt, // Full context is embedded in the prompt
      temperature: 0.7,
      maxTokens: 8192, // Allow reasonable length for a scene (adjust if needed)
    });

    // Respond with the stream
    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Error in scene generation API:', error);
    return new Response(JSON.stringify({ error: 'An error occurred generating the scene.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
