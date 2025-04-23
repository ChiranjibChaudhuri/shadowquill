import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth'; // Import auth helper
// No need to import URL

// GET handler
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const storyId = url.searchParams.get('storyId');
    if (!storyId) return NextResponse.json({ error: 'Missing storyId' }, { status: 400 });

    const story = await prisma.story.findUnique({
      where: {
        id: storyId,
        userId: userId, // Check ownership
      },
      select: { characterProfiles: true, numCharacters: true },
    });
    if (!story) return NextResponse.json({ error: 'Story not found or unauthorized' }, { status: 404 });

    return NextResponse.json({
        profiles: story.characterProfiles ?? '',
        numCharacters: story.numCharacters ?? 3, // Default if null
    });
  } catch (error: any) {
    console.error('Error fetching character data:', error);
    return NextResponse.json({ error: 'Failed to fetch character data', details: error.message }, { status: 500 });
  }
}

// PUT handler
interface UpdateCharacterDataBody {
    storyId: string;
    profiles?: string | null; // Allow null
    numCharacters?: number | null; // Allow null
}

export async function PUT(req: Request) {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { storyId, profiles, numCharacters }: UpdateCharacterDataBody = await req.json();
        if (!storyId) return NextResponse.json({ error: 'Missing storyId' }, { status: 400 });
        if (profiles === undefined && numCharacters === undefined) {
             return NextResponse.json({ error: 'Missing data to update (profiles or numCharacters)' }, { status: 400 });
        }

        const dataToUpdate: { characterProfiles?: string | null; numCharacters?: number | null } = {};
        if (profiles !== undefined) dataToUpdate.characterProfiles = profiles;
        if (numCharacters !== undefined) dataToUpdate.numCharacters = numCharacters;

        const updatedStory = await prisma.story.update({
            where: {
                id: storyId,
                userId: userId, // Check ownership
            },
            data: dataToUpdate,
            select: { id: true }
        });

        return NextResponse.json({ message: 'Character data updated successfully', storyId: updatedStory.id });
    } catch (error: any) {
        console.error('Error updating character data:', error);
        if (error.code === 'P2025') return NextResponse.json({ error: 'Story not found or unauthorized' }, { status: 404 });
        return NextResponse.json({ error: 'Failed to update character data', details: error.message }, { status: 500 });
    }
}
