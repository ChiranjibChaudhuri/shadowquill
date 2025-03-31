import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const BASE_OUTPUT_DIRECTORY = path.resolve(process.cwd(), 'public', 'ai-writer-output');

interface CreateDirectoryRequestBody {
  storyId: string;
}

export async function POST(req: Request) {
  let safeStoryId = ''; // Declare outside try block
  try {
    const { storyId }: CreateDirectoryRequestBody = await req.json();

    if (!storyId) {
      return NextResponse.json({ error: 'Missing storyId' }, { status: 400 });
    }

    // Basic sanitization for storyId
    safeStoryId = storyId.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safeStoryId) {
         return NextResponse.json({ error: 'Invalid storyId resulting in empty directory name' }, { status: 400 });
    }

    // Create story-specific directory path including 'chapters' subdirectory
    const storyDirectory = path.join(BASE_OUTPUT_DIRECTORY, safeStoryId);
    const chaptersDirectory = path.join(storyDirectory, 'chapters');

    // Ensure the story-specific directory and the chapters subdirectory exist
    await fs.mkdir(chaptersDirectory, { recursive: true }); // This creates both if they don't exist

    console.log(`Directory structure created successfully (or already existed): ${chaptersDirectory}`);
    return NextResponse.json({ message: 'Directory structure created successfully', path: storyDirectory });

  } catch (error: any) {
    console.error('Error creating story directory structure:', error);
    // If the error is just that the directory already exists, it's not a failure.
    // We still want to ensure the 'chapters' subdir exists in this case.
    if (error.code === 'EEXIST' && safeStoryId) {
        try {
            const storyDirectory = path.join(BASE_OUTPUT_DIRECTORY, safeStoryId);
            const chaptersDirectory = path.join(storyDirectory, 'chapters');
            await fs.mkdir(chaptersDirectory, { recursive: true }); // Attempt to create chapters subdir specifically
            console.log(`Base directory existed, ensured chapters subdirectory exists: ${chaptersDirectory}`);
            return NextResponse.json({ message: 'Directory structure ensured', path: storyDirectory });
        } catch (subDirError: any) {
             // If creating subdir also fails (unexpected), log and return main error
             console.error('Error ensuring chapters subdirectory exists:', subDirError);
             return NextResponse.json({ error: 'Failed to ensure directory structure', details: subDirError.message }, { status: 500 });
        }
    }
    // For other initial errors, return a failure response.
    return NextResponse.json({ error: 'Failed to create directory structure', details: error.message }, { status: 500 });
  }
}
