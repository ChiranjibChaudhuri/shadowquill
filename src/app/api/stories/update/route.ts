import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface UpdateStoryRequestBody {
  id: string;
  title: string;
}

export async function PUT(req: Request) { // Use PUT for updates
  try {
    const { id, title }: UpdateStoryRequestBody = await req.json();

    if (!id || !title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Missing story ID or valid title' }, { status: 400 });
    }

    // TODO: Add user authentication check here later to ensure user owns the story

    const updatedStory = await prisma.story.update({
      where: { id: id },
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
