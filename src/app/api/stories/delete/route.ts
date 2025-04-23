// Note: Removed /// <reference types="node" /> as it didn't resolve TS errors

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth'; // Import auth helper
import { URL } from 'url'; // Node.js built-in
import { promises as fs } from 'fs'; // Node.js built-in
import path from 'path'; // Node.js built-in

// Assuming process is available at runtime even if TS complains
const BASE_OUTPUT_DIRECTORY = path.resolve(process.cwd(), 'public', 'ai-writer-output');

export async function DELETE(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let storyId: string | null = null;
  let safeStoryId = '';
  try {
    // Use URL constructor to parse query parameters from the request URL
    const url = new URL(req.url);
    storyId = url.searchParams.get('id'); // Get ID from query param: /api/stories/delete?id=...

    if (!storyId) {
      return NextResponse.json({ error: 'Missing story ID query parameter' }, { status: 400 });
    }

    // Delete the story only if it belongs to the current user
    // Prisma will cascade delete related chapters due to schema definition
    await prisma.story.delete({
      where: {
        id: storyId,
        userId: userId, // Ensure the story belongs to the logged-in user
      },
    });

    console.log(`Story ${storyId} deleted from database.`);

    // Attempt to delete the associated directory (best effort)
    try {
        // Basic sanitization - consider a more robust slugify library if needed
        safeStoryId = storyId.replace(/[^a-zA-Z0-9_-]/g, '_');
        if (safeStoryId) {
            const storyDirectory = path.join(BASE_OUTPUT_DIRECTORY, safeStoryId);
            console.log(`Attempting to delete directory: ${storyDirectory}`);
            await fs.rm(storyDirectory, { recursive: true, force: true });
            console.log(`Successfully deleted directory: ${storyDirectory}`);
        }
    } catch (dirError: any) {
        // Log error if directory deletion fails, but don't fail the request
        // Ignore 'ENOENT' (file not found) errors silently
        if (dirError.code !== 'ENOENT') {
             console.warn(`Could not delete story directory ${safeStoryId}:`, dirError.message);
        } else {
             console.log(`Directory not found, skipping deletion: ${safeStoryId}`);
        }
    }


    return NextResponse.json({ message: 'Story deleted successfully' });

  } catch (error: any) {
    console.error(`Error deleting story ${storyId}:`, error);
    // Handle specific Prisma error for record not found (means user didn't own it or it didn't exist)
    if (error.code === 'P2025') {
        // More specific error message based on the operation
        return NextResponse.json({ error: 'Story not found or you do not have permission to delete it' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete story', details: error.message }, { status: 500 });
  }
}
