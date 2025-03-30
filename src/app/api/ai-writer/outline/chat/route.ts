import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type Message } from 'ai';
import { outlineBuilderChatSystemPrompt } from '@/lib/prompts';

// IMPORTANT: Set the runtime to edge
export const runtime = 'edge';

// Instantiate the Google AI provider
const google = createGoogleGenerativeAI(); // API key from GOOGLE_API_KEY env var
const model = google('models/gemini-2.5-pro-exp-03-25'); // Use updated experimental model

interface OutlineChatRequestBody {
  messages: Message[];
  worldContext: string;
  characterContext: string;
  numChapters?: number;
}

export async function POST(req: Request) {
  try {
    // Extract data from the body
    const { messages, worldContext, characterContext, numChapters = 10 }: OutlineChatRequestBody = await req.json();

    if (!worldContext || !characterContext) {
      return new Response(JSON.stringify({ error: 'World and character context are required for outline chat.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Inject context into the system prompt
    let systemPrompt = outlineBuilderChatSystemPrompt.replace('{worldContext}', worldContext);
    systemPrompt = systemPrompt.replace('{characterContext}', characterContext);
    systemPrompt = systemPrompt.replace('{numChapters}', String(numChapters));

    // Call the language model
    const result = await streamText({
      model: model,
      system: systemPrompt,
      messages,
      temperature: 0.7,
      maxTokens: 65000, // Increase token limit
    });

    // Respond with the stream
    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Error in outline chat API:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your outline chat request.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
