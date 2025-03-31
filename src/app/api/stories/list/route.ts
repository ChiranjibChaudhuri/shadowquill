import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    // TODO: Add user authentication check here later
    // For now, fetch all stories
    const stories = await prisma.story.findMany({
      orderBy: {
        createdAt: 'desc', // Or updatedAt: 'desc'
      },
      // Optionally select only needed fields: select: { id: true, title: true, createdAt: true }
    });
    return NextResponse.json(stories);
  } catch (error: any) {
    console.error('Error fetching stories:', error);
    return NextResponse.json({ error: 'Failed to fetch stories', details: error.message }, { status: 500 });
  }
}
