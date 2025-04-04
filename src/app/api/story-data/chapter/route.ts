import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth'; // Import auth helper
// No need to import URL

// GET handler to fetch chapter data
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const storyId = url.searchParams.get('storyId');
    const chapterNumberStr = url.searchParams.get('chapterNumber');

    if (!storyId || !chapterNumberStr) {
      return NextResponse.json({ error: 'Missing storyId or chapterNumber query parameter' }, { status: 400 });
    }
    const chapterNumber = parseInt(chapterNumberStr, 10);
    if (isNaN(chapterNumber)) {
        return NextResponse.json({ error: 'Invalid chapterNumber' }, { status: 400 });
    }

    // First, verify the user owns the story
    const story = await prisma.story.findUnique({
        where: { id: storyId, userId: userId },
        select: { id: true } // Only need to confirm existence and ownership
    });

    if (!story) {
        return NextResponse.json({ error: 'Story not found or unauthorized' }, { status: 404 });
    }

    // Now fetch the chapter data
    const chapter = await prisma.chapter.findUnique({
      where: {
        storyId_chapterNumber: {
          storyId: storyId, // Already verified ownership
          chapterNumber: chapterNumber,
        }
      },
      select: { content: true, title: true }, // Select title as well if needed later
    });

    // If chapter doesn't exist in DB yet, return empty content
    if (!chapter) {
      return NextResponse.json({ content: '' });
    }

    return NextResponse.json({ content: chapter.content ?? '' });

  } catch (error: any) {
    console.error('Error fetching chapter data:', error);
    return NextResponse.json({ error: 'Failed to fetch chapter data', details: error.message }, { status: 500 });
  }
}

// PUT handler to save chapter data
interface UpdateChapterDataBody {
    storyId: string;
    chapterNumber: number;
    content?: string | null; // Allow null
    title?: string | null; // Allow null
}

export async function PUT(req: Request) {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { storyId, chapterNumber, content, title }: UpdateChapterDataBody = await req.json();

        if (!storyId || typeof chapterNumber !== 'number') {
            return NextResponse.json({ error: 'Missing storyId or valid chapterNumber' }, { status: 400 });
        }
        // Require at least content or title to update
        if (content === undefined && title === undefined) {
             return NextResponse.json({ error: 'Missing data to update (content or title)' }, { status: 400 });
        }

        // Verify user owns the story before upserting
        const story = await prisma.story.findUnique({
            where: { id: storyId, userId: userId },
            select: { id: true } // Only need to confirm existence and ownership
        });

        if (!story) {
            return NextResponse.json({ error: 'Story not found or unauthorized' }, { status: 404 });
        }

        const dataToUpdate: { content?: string | null; title?: string | null } = {};
        if (content !== undefined) dataToUpdate.content = content;
        if (title !== undefined) dataToUpdate.title = title;

        // Use upsert: update if exists, create if not (ownership already verified)
        const upsertedChapter = await prisma.chapter.upsert({
            where: {
                storyId_chapterNumber: {
                    storyId: storyId, // Use the verified storyId
                    chapterNumber: chapterNumber,
                }
            },
            update: dataToUpdate,
            create: {
                storyId: storyId, // Use the verified storyId
                chapterNumber: chapterNumber,
                title: title ?? `Chapter ${chapterNumber}`, // Use provided title or default
                content: content ?? '', // Default to empty content if creating
            },
            select: { id: true } // Only return ID
        });

        return NextResponse.json({ message: 'Chapter data saved successfully', chapterId: upsertedChapter.id });

    } catch (error: any) {
        console.error('Error saving chapter data:', error);
        // Upsert might fail for other reasons, but P2025 shouldn't happen for the story itself here
        return NextResponse.json({ error: 'Failed to save chapter data', details: error.message }, { status: 500 });
    }
}
