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
      select: { outlineText: true, numChapters: true },
    });
    if (!story) return NextResponse.json({ error: 'Story not found or unauthorized' }, { status: 404 });

    return NextResponse.json({
        outline: story.outlineText ?? '',
        numChapters: story.numChapters ?? 10, // Default if null
    });
  } catch (error: any) {
    console.error('Error fetching outline data:', error);
    return NextResponse.json({ error: 'Failed to fetch outline data', details: error.message }, { status: 500 });
  }
}

// PUT handler
interface UpdateOutlineDataBody {
    storyId: string;
    outline?: string | null; // Allow null
    numChapters?: number | null; // Allow null
}

export async function PUT(req: Request) {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { storyId, outline, numChapters }: UpdateOutlineDataBody = await req.json();
        if (!storyId) return NextResponse.json({ error: 'Missing storyId' }, { status: 400 });
        if (outline === undefined && numChapters === undefined) {
             return NextResponse.json({ error: 'Missing data to update (outline or numChapters)' }, { status: 400 });
        }

        const dataToUpdate: { outlineText?: string | null; numChapters?: number | null } = {};
        if (outline !== undefined) dataToUpdate.outlineText = outline;
        if (numChapters !== undefined) dataToUpdate.numChapters = numChapters;

        const updatedStory = await prisma.story.update({
            where: {
                id: storyId,
                userId: userId, // Check ownership
            },
            data: dataToUpdate,
            select: { id: true }
        });

        return NextResponse.json({ message: 'Outline data updated successfully', storyId: updatedStory.id });
    } catch (error: any) {
        console.error('Error updating outline data:', error);
        if (error.code === 'P2025') return NextResponse.json({ error: 'Story not found or unauthorized' }, { status: 404 });
        return NextResponse.json({ error: 'Failed to update outline data', details: error.message }, { status: 500 });
    }
}
