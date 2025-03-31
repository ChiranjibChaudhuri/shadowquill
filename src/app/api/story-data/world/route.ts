import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { URL } from 'url';

// GET handler to fetch world data for a story
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const storyId = url.searchParams.get('storyId');

    if (!storyId) {
      return NextResponse.json({ error: 'Missing storyId query parameter' }, { status: 400 });
    }

    // TODO: Add user authentication check

    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: {
        worldTopic: true,
        worldDescription: true,
      },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Return empty strings if data is null/undefined
    return NextResponse.json({
        topic: story.worldTopic ?? '',
        description: story.worldDescription ?? '',
    });

  } catch (error: any) {
    console.error('Error fetching world data:', error);
    return NextResponse.json({ error: 'Failed to fetch world data', details: error.message }, { status: 500 });
  }
}

// PUT handler to save world data for a story
interface UpdateWorldDataBody {
    storyId: string;
    topic?: string;
    description?: string;
}

export async function PUT(req: Request) {
    try {
        const { storyId, topic, description }: UpdateWorldDataBody = await req.json();

        if (!storyId) {
            return NextResponse.json({ error: 'Missing storyId' }, { status: 400 });
        }
        // Allow empty strings but not undefined for update
        if (typeof topic === 'undefined' && typeof description === 'undefined') {
             return NextResponse.json({ error: 'Missing data to update (topic or description)' }, { status: 400 });
        }

        // TODO: Add user authentication check

        const dataToUpdate: { worldTopic?: string; worldDescription?: string } = {};
        if (typeof topic !== 'undefined') {
            dataToUpdate.worldTopic = topic;
        }
        if (typeof description !== 'undefined') {
            dataToUpdate.worldDescription = description;
        }

        const updatedStory = await prisma.story.update({
            where: { id: storyId },
            data: dataToUpdate,
            select: { id: true } // Only return ID on success
        });

        return NextResponse.json({ message: 'World data updated successfully', storyId: updatedStory.id });

    } catch (error: any) {
        console.error('Error updating world data:', error);
        if (error.code === 'P2025') { // Handle story not found
            return NextResponse.json({ error: 'Story not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to update world data', details: error.message }, { status: 500 });
    }
}
