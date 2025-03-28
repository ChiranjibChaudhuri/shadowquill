import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type Message } from 'ai'; // Removed StreamingTextResponse
import { worldBuilderChatSystemPrompt } from '@/lib/prompts'; // Import the prompt

// IMPORTANT: Set the runtime to edge
export const runtime = 'edge';

// Instantiate the Google AI provider
// Note: The API key is automatically picked up from the GOOGLE_API_KEY environment variable
const google = createGoogleGenerativeAI();
const model = google('models/gemini-1.5-pro-latest'); // Use Gemini 1.5 Pro

interface WorldChatRequestBody {
  messages: Message[];
  topic?: string; // Add topic to potentially customize the prompt
}

export async function POST(req: Request) {
  try {
    // Extract the `messages` and optional `topic` from the body of the request
    const { messages, topic = 'their book' }: WorldChatRequestBody = await req.json();

    // Inject topic into the system prompt
    const systemPrompt = worldBuilderChatSystemPrompt.replace('{topic}', topic);

    // Call the language model with the system prompt and user messages
    const result = await streamText({
      model: model,
      system: systemPrompt,
      messages,
      // Optional: Add generation configuration
      temperature: 0.7,
      maxTokens: 4096, // Increase max tokens for chat
    });

    // Respond with the stream
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error in world chat API:', error);
    // Handle errors appropriately
    return new Response(JSON.stringify({ error: 'An error occurred processing your request.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
