import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type Message } from 'ai';
import { outlineFinalizerSystemPrompt, formatChatHistory } from '@/lib/prompts';

// IMPORTANT: Set the runtime to edge
export const runtime = 'edge';

// Instantiate the Google AI provider
const google = createGoogleGenerativeAI(); // API key from GOOGLE_API_KEY env var
const model = google('models/gemini-2.5-pro-exp-03-25'); // Use updated experimental model

interface OutlineFinalizeRequestBody {
  messages: Message[]; // Full chat history
  worldContext: string;
  characterContext: string;
  numChapters?: number;
}

export async function POST(req: Request) {
  try {
    // Extract data from the body
    const { messages, worldContext, characterContext, numChapters = 10 }: OutlineFinalizeRequestBody = await req.json();

    if (!worldContext || !characterContext) {
      return new Response(JSON.stringify({ error: 'World and character context are required to finalize the outline.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Format the chat history
    const chatHistoryString = formatChatHistory(messages);

    // Inject context into the system prompt
    let systemPrompt = outlineFinalizerSystemPrompt.replace('{worldContext}', worldContext);
    systemPrompt = systemPrompt.replace('{characterContext}', characterContext);
    systemPrompt = systemPrompt.replace('{chatHistory}', chatHistoryString);
    systemPrompt = systemPrompt.replace(/{numChapters}/g, String(numChapters)); // Global replace

    // Call the language model to generate the final outline
    const result = await streamText({
      model: model,
      prompt: systemPrompt, // History and context are embedded in the prompt
      temperature: 0.6, // Lower temp for structured outline
      maxTokens: 8192, // Request maximum tokens for detailed outline
    });

    // Respond with the stream
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Error in outline generation API:', error);
    // Handle errors appropriately
    return new Response(JSON.stringify({ error: 'An error occurred generating the outline.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
