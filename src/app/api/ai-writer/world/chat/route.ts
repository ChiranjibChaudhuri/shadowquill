import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type Message } from 'ai'; // Revert to streamText
import { worldBuilderChatSystemPrompt } from '@/lib/prompts'; // Import the prompt

// Keep Node.js runtime

// Instantiate the Google AI provider
// Note: The API key is automatically picked up from the GOOGLE_API_KEY environment variable
const google = createGoogleGenerativeAI();
const model = google('models/gemini-2.5-flash-preview-04-17'); // Use flash preview model

interface WorldChatRequestBody {
  messages: Message[];
  topic?: string; // Add topic to potentially customize the prompt
}

export async function POST(req: Request) {
  try {
    const { messages, topic = 'their book' }: WorldChatRequestBody = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing messages array' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = worldBuilderChatSystemPrompt.replace('{topic}', topic);

    try {
      // Revert to streamText
      const result = await streamText({
        model: model,
        system: systemPrompt,
        messages,
        temperature: 0.7,
        maxTokens: 65000, // Increase token limit
      });

      // Return the stream response
      return result.toDataStreamResponse();

    } catch (modelError: any) {
      console.error('Model API Error:', {
        error: modelError,
        message: modelError?.message,
        details: modelError?.details,
      });

      return new Response(
        JSON.stringify({ 
          error: 'AI model error',
          details: modelError?.message || 'Unknown error occurred'
        }),
        { 
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error: any) {
    console.error('General API Error:', {
      error,
      message: error?.message,
      stack: error?.stack,
    });

    return new Response(
      JSON.stringify({ 
        error: 'Server error',
        details: error?.message || 'An unexpected error occurred'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
