// src/app/api/story-data/mindmap/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth'; // Import auth helper
// No need to import URL

// GET handler to fetch mind map data
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const storyId = url.searchParams.get('storyId');

  if (!storyId) {
    return NextResponse.json({ error: 'Missing storyId query parameter' }, { status: 400 });
  }

  try {
    const story = await prisma.story.findUnique({
      where: {
        id: storyId,
        userId: userId, // Check ownership
      },
      select: { mindMapData: true }, // Only select the mind map data
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found or unauthorized' }, { status: 404 });
    }

    // Parse the JSON string, default to null if empty or invalid
    let mindMapData = null;
    if (story.mindMapData) {
        try {
            mindMapData = JSON.parse(story.mindMapData);
        } catch (e) {
            console.error(`Failed to parse mindMapData for story ${storyId}:`, e);
            // Return null or potentially an error state if parsing fails
            return NextResponse.json({ error: 'Failed to parse stored mind map data' }, { status: 500 });
        }
    }

    return NextResponse.json({ mindMapData: mindMapData ?? { nodes: [], edges: [] } }); // Return default empty structure if null

  } catch (error: any) {
    console.error(`Error fetching mind map data for story ${storyId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch mind map data', details: error.message }, { status: 500 });
  }
}

// PUT handler to save mind map data
export async function PUT(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { storyId, mindMapData } = await req.json();

    if (!storyId) {
      return NextResponse.json({ error: 'Missing storyId in request body' }, { status: 400 });
    }
    if (mindMapData === undefined) {
        return NextResponse.json({ error: 'Missing mindMapData in request body' }, { status: 400 });
    }

    // Validate if mindMapData is a reasonable object structure (basic check)
    if (typeof mindMapData !== 'object' || mindMapData === null) {
         return NextResponse.json({ error: 'Invalid mindMapData format' }, { status: 400 });
    }

    // Stringify the data for storage
    const mindMapDataString = JSON.stringify(mindMapData);

    // Update story only if it belongs to the user
    const updatedStory = await prisma.story.update({
      where: {
        id: storyId,
        userId: userId, // Check ownership
      },
      data: {
        mindMapData: mindMapDataString,
      },
      select: { id: true, updatedAt: true } // Only return minimal confirmation
    });

    console.log(`Mind map data updated for story ${storyId}`);
    return NextResponse.json({ message: 'Mind map data saved successfully', updatedAt: updatedStory.updatedAt });

  } catch (error: any) {
    console.error('Error saving mind map data:', error);
     // Handle specific Prisma error for record not found (means user didn't own it or it didn't exist)
    if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Story not found or unauthorized' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to save mind map data', details: error.message }, { status: 500 });
  }
}
