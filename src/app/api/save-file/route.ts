import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const BASE_OUTPUT_DIRECTORY = path.resolve(process.cwd(), 'public', 'ai-writer-output');

interface SaveFileRequestBody {
  storyId: string; // Add storyId
  filename: string;
  content: string;
}

export async function POST(req: Request) {
  try {
    const { storyId, filename, content }: SaveFileRequestBody = await req.json();

    if (!storyId || !filename || typeof content === 'undefined') {
      return NextResponse.json({ error: 'Missing storyId, filename, or content' }, { status: 400 });
    }

    // Basic sanitization to prevent path traversal
    const safeFilename = path.basename(filename);
    if (safeFilename !== filename) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    // Basic sanitization for storyId
    const safeStoryId = storyId.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safeStoryId) {
         return NextResponse.json({ error: 'Invalid storyId resulting in empty directory name' }, { status: 400 });
    }

    // Create base story-specific directory path
    const storyDirectory = path.join(BASE_OUTPUT_DIRECTORY, safeStoryId);

    // Determine the final file path (inside 'chapters' subdir if filename starts with 'chapter_')
    let filePath: string;
    let directoryToEnsure: string;
    if (safeFilename.startsWith('chapter_')) {
        directoryToEnsure = path.join(storyDirectory, 'chapters');
        filePath = path.join(directoryToEnsure, safeFilename);
    } else {
        directoryToEnsure = storyDirectory;
        filePath = path.join(directoryToEnsure, safeFilename);
    }

    // Ensure the target directory exists
    try {
        await fs.mkdir(directoryToEnsure, { recursive: true });
    } catch (dirError: any) {
        // Ignore error if directory already exists, otherwise re-throw
        if (dirError.code !== 'EEXIST') {
            throw dirError;
        }
    }


    // Write the file
    await fs.writeFile(filePath, content, 'utf8');

    console.log(`File saved successfully: ${filePath}`);
    // Return the server path, not the web path, as it's just confirmation
    return NextResponse.json({ message: 'File saved successfully', path: filePath });

  } catch (error: any) {
    console.error('Error saving file:', error);
    return NextResponse.json({ error: 'Failed to save file', details: error.message }, { status: 500 });
  }
}
