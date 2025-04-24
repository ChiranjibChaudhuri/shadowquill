import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type Message } from 'ai';
import { characterFinalizerSystemPrompt, formatChatHistory } from '@/lib/prompts';

// IMPORTANT: Set the runtime to edge
export const runtime = 'edge';

// Instantiate the Google AI provider
const google = createGoogleGenerativeAI(); // API key from GOOGLE_API_KEY env var
const model = google('models/gemini-2.5-flash-preview-04-17'); // Use flash preview model

interface CharacterFinalizeRequestBody {
  messages: Message[]; // Full chat history
  worldContext: string;
  numCharacters?: number; // Optional number of characters to generate
}

export async function POST(req: Request) {
  try {
    // Extract data from the body
    const { messages, worldContext, numCharacters = 3 }: CharacterFinalizeRequestBody = await req.json();

    if (!worldContext) {
      return new Response(JSON.stringify({ error: 'World context is required to finalize characters.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Format the chat history
    const chatHistoryString = formatChatHistory(messages);

    // Inject context into the system prompt
    let systemPrompt = characterFinalizerSystemPrompt.replace('{worldContext}', worldContext);
    systemPrompt = systemPrompt.replace('{chatHistory}', chatHistoryString);
    systemPrompt = systemPrompt.replace(/{numCharacters}/g, String(numCharacters)); // Use regex for global replace

    // Call the language model to generate the final character profiles
    const result = await streamText({
      model: model,
      prompt: systemPrompt, // History and context are embedded in the prompt
      temperature: 0.6,
      maxTokens: 65000, // Increase token limit
    });

    // Respond with the stream
    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Error in character finalize API:', error);
    return new Response(JSON.stringify({ error: 'An error occurred finalizing the characters.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
