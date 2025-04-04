import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth'; // Import auth helper

interface UpdateStoryRequestBody {
  id: string;
  title: string;
}

export async function PUT(req: Request) { // Use PUT for updates
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, title }: UpdateStoryRequestBody = await req.json();

    if (!id || !title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Missing story ID or valid title' }, { status: 400 });
    }

    // Update only if the story exists and belongs to the current user
    const updatedStory = await prisma.story.update({
      where: {
        id: id,
        userId: userId, // Ensure the story belongs to the logged-in user
      },
      data: {
        title: title.trim(),
      },
    });

    console.log("Story updated:", updatedStory);
    return NextResponse.json(updatedStory);

  } catch (error: any) {
    console.error('Error updating story:', error);
    // Handle specific Prisma error for record not found
    if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update story', details: error.message }, { status: 500 });
  }
}
