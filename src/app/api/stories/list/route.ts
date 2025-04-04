import { auth } from '@/auth'; // Import the auth helper
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Define an interface for the session user that includes the id
interface SessionUser {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

export async function GET(req: Request) {
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
  } catch (error: any) {
    console.error('Error fetching stories:', error);
    return NextResponse.json({ error: 'Failed to fetch stories', details: error.message }, { status: 500 });
  }
}
