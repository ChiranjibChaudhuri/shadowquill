import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { URL } from 'url'; // Import URL for parsing query parameters

const BASE_OUTPUT_DIRECTORY = path.resolve(process.cwd(), 'public', 'ai-writer-output');

export async function GET(req: Request) {
  try {
    // Use URL constructor to parse query parameters from the request URL
    const url = new URL(req.url);
    const storyId = url.searchParams.get('storyId');
    const filename = url.searchParams.get('filename');

    if (!storyId || !filename) {
      return NextResponse.json({ error: 'Missing storyId or filename query parameter' }, { status: 400 });
    }

    // Basic sanitization
    const safeFilename = path.basename(filename);
    if (safeFilename !== filename) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    const safeStoryId = storyId.replace(/[^a-zA-Z0-9_-]/g, '_');
     if (!safeStoryId) {
         return NextResponse.json({ error: 'Invalid storyId' }, { status: 400 });
    }

    // Construct the path, checking if it's a chapter file
    const storyDirectory = path.join(BASE_OUTPUT_DIRECTORY, safeStoryId);
    let filePath: string;
    if (safeFilename.startsWith('chapter_')) {
        filePath = path.join(storyDirectory, 'chapters', safeFilename);
    } else {
        filePath = path.join(storyDirectory, safeFilename);
    }

    // Try reading the file
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return NextResponse.json({ content });
    } catch (readError: any) {
      if (readError.code === 'ENOENT') {
        // File not found, return empty content which is expected for new/unsaved data
        return NextResponse.json({ content: '' });
      }
      // For other read errors, re-throw
      throw readError;
    }

  } catch (error: any) {
    console.error('Error reading story file:', error);
    return NextResponse.json({ error: 'Failed to read file', details: error.message }, { status: 500 });
  }
}
