import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type Message } from 'ai';
import { characterBuilderChatSystemPrompt } from '@/lib/prompts';

// IMPORTANT: Set the runtime to edge
export const runtime = 'edge';

// Instantiate the Google AI provider
const google = createGoogleGenerativeAI(); // API key from GOOGLE_API_KEY env var
const model = google('models/gemini-2.5-flash-preview-04-17'); // Use flash preview model

interface CharacterChatRequestBody {
  messages: Message[];
  worldContext: string; // Require world context for character creation
}

export async function POST(req: Request) {
  try {
    // Extract messages and worldContext from the body
    const { messages, worldContext }: CharacterChatRequestBody = await req.json();

    if (!worldContext) {
      return new Response(JSON.stringify({ error: 'World context is required for character creation.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Inject world context into the system prompt
    const systemPrompt = characterBuilderChatSystemPrompt.replace('{worldContext}', worldContext);

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
    console.error('Error in character chat API:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your character chat request.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
