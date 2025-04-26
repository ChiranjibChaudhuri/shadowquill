import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth'; // Import auth helper

interface CreateStoryRequestBody {
  title?: string; // Title can be optional, we'll use a default
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: CreateStoryRequestBody = await req.json();
    let title = body.title?.trim();

    // Use a default title if none provided or only whitespace
    if (!title) {
        title = `Untitled Story ${new Date().toISOString()}`; // Use ISO string for consistency
        console.log(`No title provided, using default: ${title}`);
    }

    const newStory = await prisma.story.create({
      data: {
        title: title,
        userId: userId, // Associate with the logged-in user
      },
    });

    console.log("New story created:", newStory);
    return NextResponse.json(newStory, { status: 201 }); // 201 Created status

  } catch (error: unknown) { // Use unknown
    console.error('Error creating story:', error);
    // Type check for error message
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to create story', details: message }, { status: 500 });
  }
}
