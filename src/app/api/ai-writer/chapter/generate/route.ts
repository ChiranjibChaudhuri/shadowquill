import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type Message } from 'ai';
import { chapterGeneratorSystemPrompt } from '@/lib/prompts';

// IMPORTANT: Set the runtime to edge
export const runtime = 'edge';

// Instantiate the Google AI provider
const google = createGoogleGenerativeAI(); // API key from GOOGLE_API_KEY env var
const model = google('models/gemini-2.5-pro-exp-03-25'); // Use updated experimental model

interface ChapterGenerateRequestBody {
  // Full context needed for chapter generation
  worldContext: string;
  characterContext: string;
  outlineContext: string; // Full book outline
  previousChapterContext?: string; // Summary/content of previous chapter
  // Details for the specific chapter to generate
  chapterNumber: number;
  chapterTitle: string;
  chapterOutline: string; // Specific outline/focus for this chapter
  chapterScenes?: string; // Formatted string of scenes for the chapter
}

export async function POST(req: Request) {
  try {
    // Extract data from the body
    const {
      worldContext,
      characterContext,
      outlineContext,
      previousChapterContext = "This is the first chapter.", // Default if none provided
      chapterNumber,
      chapterTitle,
      chapterOutline,
      chapterScenes = "No pre-defined scenes provided.", // Default if none provided
    }: ChapterGenerateRequestBody = await req.json();

    // Basic validation
    if (!worldContext || !characterContext || !outlineContext || !chapterNumber || !chapterTitle || !chapterOutline) {
      return new Response(JSON.stringify({ error: 'Missing required context or chapter details for generation.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Inject context into the system prompt
    let systemPrompt = chapterGeneratorSystemPrompt.replace('{outlineContext}', outlineContext);
    systemPrompt = systemPrompt.replace('{worldContext}', worldContext);
    systemPrompt = systemPrompt.replace('{characterContext}', characterContext);
    systemPrompt = systemPrompt.replace('{previousChapterContext}', previousChapterContext);
    systemPrompt = systemPrompt.replace('{chapterNumber}', String(chapterNumber));
    systemPrompt = systemPrompt.replace('{chapterTitle}', chapterTitle);
    systemPrompt = systemPrompt.replace('{chapterOutline}', chapterOutline);
    systemPrompt = systemPrompt.replace('{chapterScenes}', chapterScenes); // Inject formatted scenes


    // Call the language model to generate the chapter content
    const result = await streamText({
      model: model,
      prompt: systemPrompt, // Full context is embedded in the prompt
      temperature: 0.7, // Standard temperature for creative writing
      maxTokens: 65000, // Increase token limit
    });

    // Respond with the stream
    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Error in chapter generation API:', error);
    return new Response(JSON.stringify({ error: 'An error occurred generating the chapter.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
