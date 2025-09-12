// src/app/api/compile-book/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { URL } from 'url';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const storyId = url.searchParams.get('storyId');

  if (!storyId) {
    return NextResponse.json({ error: 'Missing storyId query parameter' }, { status: 400 });
  }

  try {
    // Fetch story details and chapters
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      include: {
        chapters: {
          orderBy: {
            chapterNumber: 'asc',
          },
        },
      },
    });

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // --- Word Document Compilation ---
    let htmlBody = `<h1>${story.title || 'Untitled Story'}</h1>`;
    if (story.chapters.length > 0) {
      htmlBody += `<h2>Chapters</h2>`;
      story.chapters.forEach((chapt: { chapterNumber: number; title: string | null; content: string | null }) => {
        htmlBody += `<h3>Chapter ${chapt.chapterNumber}${chapt.title ? `: ${chapt.title}` : ''}</h3>`;
        htmlBody += `<p>${(chapt.content ?? '').replace(/\n/g, '<br/>')}</p>`;
      });
    }
    const header = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${story.title || 'Untitled Story'}</title></head><body>`;
    const footer = `</body></html>`;
    const source = `\ufeff${header}${htmlBody}${footer}`;
    const filename = `${story.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'story'}.doc`;
    return new NextResponse(source, {
      status: 200,
      headers: {
        'Content-Type': 'application/msword; charset=UTF-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: unknown) { // Use unknown
    console.error(`Error compiling book for story ${storyId}:`, error);
    // Handle specific Prisma error for record not found separately if needed
    // Check if error is an object and has a 'code' property before accessing it
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        return NextResponse.json({ error: 'Story not found during compilation' }, { status: 404 });
    }
    // Type check for general error message
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to compile book', details: message }, { status: 500 });
  }
}
