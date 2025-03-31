import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { URL } from 'url';

// GET handler to fetch chapter data
export async function GET(req: Request) {
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

    // TODO: Auth check

    const chapter = await prisma.chapter.findUnique({
      where: {
        storyId_chapterNumber: { // Use the @@unique constraint name
          storyId: storyId,
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
    content?: string;
    title?: string; // Allow updating title too if needed
}

export async function PUT(req: Request) {
    try {
        const { storyId, chapterNumber, content, title }: UpdateChapterDataBody = await req.json();

        if (!storyId || typeof chapterNumber !== 'number') {
            return NextResponse.json({ error: 'Missing storyId or valid chapterNumber' }, { status: 400 });
        }
        // Require at least content or title to update
        if (typeof content === 'undefined' && typeof title === 'undefined') {
             return NextResponse.json({ error: 'Missing data to update (content or title)' }, { status: 400 });
        }

        // TODO: Auth check

        const dataToUpdate: { content?: string; title?: string } = {};
        if (typeof content !== 'undefined') dataToUpdate.content = content;
        if (typeof title !== 'undefined') dataToUpdate.title = title;

        // Use upsert: update if exists, create if not
        const upsertedChapter = await prisma.chapter.upsert({
            where: {
                storyId_chapterNumber: {
                    storyId: storyId,
                    chapterNumber: chapterNumber,
                }
            },
            update: dataToUpdate,
            create: {
                storyId: storyId,
                chapterNumber: chapterNumber,
                title: title ?? `Chapter ${chapterNumber}`, // Use provided title or default
                content: content ?? '', // Default to empty content if creating
            },
            select: { id: true } // Only return ID
        });

        return NextResponse.json({ message: 'Chapter data saved successfully', chapterId: upsertedChapter.id });

    } catch (error: any) {
        console.error('Error saving chapter data:', error);
        // Don't need P2025 check because upsert handles creation
        return NextResponse.json({ error: 'Failed to save chapter data', details: error.message }, { status: 500 });
    }
}
