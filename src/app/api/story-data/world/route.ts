import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth'; // Import auth helper
// No need to import URL, it's a global constructor

// GET handler to fetch world data for a story
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use the global URL constructor
    const url = new URL(req.url);
    const storyId = url.searchParams.get('storyId');

    if (!storyId) {
      return NextResponse.json({ error: 'Missing storyId query parameter' }, { status: 400 });
    }

    // Fetch story only if it belongs to the user
    const story = await prisma.story.findUnique({
      where: {
        id: storyId,
        userId: userId, // Check ownership
      },
      select: {
        worldTopic: true,
        worldDescription: true,
      },
    });

    if (!story) {
      // Return 404 if story not found or doesn't belong to user
      return NextResponse.json({ error: 'Story not found or unauthorized' }, { status: 404 });
    }

    // Return empty strings if data is null/undefined
    return NextResponse.json({
        topic: story.worldTopic ?? '',
        description: story.worldDescription ?? '',
    });

  } catch (error: unknown) { // Use unknown
    console.error('Error fetching world data:', error);
    // Type check for error message
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to fetch world data', details: message }, { status: 500 });
  }
}

// PUT handler to save world data for a story
interface UpdateWorldDataBody {
    storyId: string;
    topic?: string;
    description?: string | null; // Allow null for clearing
}

export async function PUT(req: Request) {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { storyId, topic, description }: UpdateWorldDataBody = await req.json();

        if (!storyId) {
            return NextResponse.json({ error: 'Missing storyId' }, { status: 400 });
        }
        // Check if at least one field is provided for update
        if (topic === undefined && description === undefined) {
             return NextResponse.json({ error: 'Missing data to update (topic or description)' }, { status: 400 });
        }

        const dataToUpdate: { worldTopic?: string | null; worldDescription?: string | null } = {};
        if (topic !== undefined) {
            dataToUpdate.worldTopic = topic; // Allow empty string or null
        }
        if (description !== undefined) {
            dataToUpdate.worldDescription = description; // Allow empty string or null
        }

        // Update story only if it belongs to the user
        const updatedStory = await prisma.story.update({
            where: {
                id: storyId,
                userId: userId, // Check ownership
            },
            data: dataToUpdate,
            select: { id: true } // Only return ID on success
        });

        return NextResponse.json({ message: 'World data updated successfully', storyId: updatedStory.id });

    } catch (error: unknown) { // Use unknown
        console.error('Error updating world data:', error);
        // Handle specific Prisma error for record not found (means user didn't own it or it didn't exist)
        // Check if error is an object and has a 'code' property before accessing it
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
            return NextResponse.json({ error: 'Story not found or unauthorized' }, { status: 404 });
        }
        // Type check for general error message
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: 'Failed to update world data', details: message }, { status: 500 });
    }
}
