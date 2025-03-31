import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface CreateStoryRequestBody {
  title: string;
  userId?: string; // Optional: Link to user later
}

export async function POST(req: Request) {
  try {
    const { title, userId }: CreateStoryRequestBody = await req.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        // Use a default title if none provided or only whitespace
        const defaultTitle = `Untitled Story ${new Date().getTime()}`; // Simple default
         console.log(`No title provided, using default: ${defaultTitle}`);
         const newStory = await prisma.story.create({
             data: {
                 title: defaultTitle,
                 // userId: userId // Add later when auth is implemented
             },
         });
         return NextResponse.json(newStory, { status: 201 });
    }

    // TODO: Add user authentication check here later
    // For now, create story without linking to a user
    const newStory = await prisma.story.create({
      data: {
        title: title.trim(), // Trim whitespace from provided title
        // userId: userId // Add later when auth is implemented
      },
    });

    console.log("New story created:", newStory);
    return NextResponse.json(newStory, { status: 201 }); // 201 Created status

  } catch (error: any) {
    console.error('Error creating story:', error);
    return NextResponse.json({ error: 'Failed to create story', details: error.message }, { status: 500 });
  }
}
