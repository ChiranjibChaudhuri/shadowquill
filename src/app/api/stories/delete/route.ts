import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { URL } from 'url'; // Import URL for parsing query parameters
import { promises as fs } from 'fs'; // For deleting files
import path from 'path'; // For path manipulation

const BASE_OUTPUT_DIRECTORY = path.resolve(process.cwd(), 'public', 'ai-writer-output');

export async function DELETE(req: Request) {
  let storyId: string | null = null;
  let safeStoryId = '';
  try {
    // Use URL constructor to parse query parameters from the request URL
    const url = new URL(req.url);
    storyId = url.searchParams.get('id'); // Get ID from query param: /api/stories/delete?id=...

    if (!storyId) {
      return NextResponse.json({ error: 'Missing story ID query parameter' }, { status: 400 });
    }

    // TODO: Add user authentication check here later to ensure user owns the story

    // Delete the story (Prisma will cascade delete related chapters due to schema definition)
    await prisma.story.delete({
      where: { id: storyId },
    });

    console.log(`Story ${storyId} deleted from database.`);

    // Attempt to delete the associated directory (best effort)
    try {
        safeStoryId = storyId.replace(/[^a-zA-Z0-9_-]/g, '_');
        if (safeStoryId) {
            const storyDirectory = path.join(BASE_OUTPUT_DIRECTORY, safeStoryId);
            await fs.rm(storyDirectory, { recursive: true, force: true });
            console.log(`Attempted to delete directory: ${storyDirectory}`);
        }
    } catch (dirError: any) {
        // Log error if directory deletion fails, but don't fail the request
        console.warn(`Could not delete story directory ${safeStoryId}:`, dirError.message);
    }


    return NextResponse.json({ message: 'Story deleted successfully' });

  } catch (error: any) {
    console.error(`Error deleting story ${storyId}:`, error);
    // Handle specific Prisma error for record not found
    if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete story', details: error.message }, { status: 500 });
  }
}
