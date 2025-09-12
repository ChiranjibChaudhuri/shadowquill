import { auth } from '@/auth'; // Import the auth helper
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Removed unused SessionUser interface

export async function GET(_req: Request) { // Mark req as unused
  // Get session using the auth() helper
  const session = await auth();

  // Access user ID from session subject (sub)
  const userId = session?.user?.id; // The callbacks should add 'id' to user

  if (!userId) {
    console.log("Unauthorized access attempt to list stories.");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`Fetching stories for user ID: ${userId}`);

  try {
    const stories = await prisma.story.findMany({
      where: {
        userId: userId, // Filter stories by the logged-in user's ID
      },
      orderBy: {
        updatedAt: 'desc', // Order by most recently updated
      },
      // Optionally select only needed fields: select: { id: true, title: true, createdAt: true }
    });
    return NextResponse.json(stories);
  } catch (error: unknown) { // Use unknown
    console.error('Error fetching stories:', error);
    // Type check for error message
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to fetch stories', details: message }, { status: 500 });
  }
}
