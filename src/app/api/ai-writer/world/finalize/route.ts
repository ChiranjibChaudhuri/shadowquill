import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type Message } from 'ai';
import { worldFinalizerSystemPrompt, formatChatHistory } from '@/lib/prompts'; // Import the prompt and helper

// IMPORTANT: Set the runtime to edge
export const runtime = 'edge';

// Instantiate the Google AI provider
const google = createGoogleGenerativeAI(); // API key from GOOGLE_API_KEY env var
const model = google('models/gemini-2.5-flash-preview-04-17'); // Use flash preview model

interface WorldFinalizeRequestBody {
  messages: Message[]; // Full chat history
  topic?: string;
}

export async function POST(req: Request) {
  try {
    // Extract the `messages` (chat history) and `topic` from the body
    const { messages, topic = 'their book' }: WorldFinalizeRequestBody = await req.json();

    // Format the chat history into a string for the prompt
    const chatHistoryString = formatChatHistory(messages);

    // Inject topic and chat history into the system prompt
    let systemPrompt = worldFinalizerSystemPrompt.replace('{topic}', topic);
    systemPrompt = systemPrompt.replace('{chatHistory}', chatHistoryString);

    // Call the language model to generate the final world document
    // Note: For finalization based on history, we send the history within the system prompt
    // and don't pass `messages` to streamText, as the prompt itself contains the full context.
    const result = await streamText({
      model: model,
      prompt: systemPrompt, // Use 'prompt' instead of 'system' when history is embedded
      // Optional: Add generation configuration
      temperature: 0.6, // Slightly lower temp for more structured output
      maxTokens: 65000, // Increase token limit
    });

    // Respond with the stream
    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Error in world finalize API:', error);
    // Handle errors appropriately
    return new Response(JSON.stringify({ error: 'An error occurred finalizing the world description.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
