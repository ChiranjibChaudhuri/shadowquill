// src/app/api/compile-book/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// Removed md-to-pdf import
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

    // --- Basic Markdown Compilation ---
    let markdownContent = `# ${story.title || 'Untitled Story'}\n\n`;

    // Add World Description if available
    if (story.worldDescription) {
        markdownContent += `## World\n\n${story.worldDescription}\n\n`;
    }

    // Add Character Profiles if available
    if (story.characterProfiles) {
        markdownContent += `## Characters\n\n${story.characterProfiles}\n\n`;
    }

    // Add Outline if available
    if (story.outlineText) {
        markdownContent += `## Outline\n\n${story.outlineText}\n\n`;
    }

    // Add Chapters
    markdownContent += `## Chapters\n\n`;
    story.chapters.forEach(chapter => {
      markdownContent += `### Chapter ${chapter.chapterNumber}${chapter.title ? `: ${chapter.title}` : ''}\n\n`;
      markdownContent += `${chapter.content || '*(No content)*'}\n\n`; // Add placeholder if content is null/empty
    });
    // --- End Markdown Compilation ---

    // Create a sanitized filename for Markdown
    const filename = `${story.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'story'}.md`;

    // Return the Markdown content directly
    return new NextResponse(markdownContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=UTF-8', // Set correct MIME type for Markdown
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error(`Error compiling book for story ${storyId}:`, error);
    // Handle specific Prisma error for record not found separately if needed
    if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Story not found during compilation' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to compile book', details: error.message }, { status: 500 });
  }
}
