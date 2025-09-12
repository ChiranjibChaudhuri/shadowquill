import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import fs from 'fs/promises';
import path from 'path';

interface CreateDirectoryRequestBody {
  storyId?: string;
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let storyId: string | undefined; // Declare storyId outside try block

  try {
    const body: CreateDirectoryRequestBody = await req.json();
    storyId = body.storyId; // Assign value inside try block

    if (!storyId) {
      return NextResponse.json({ error: 'Missing storyId' }, { status: 400 });
    }

    // Define the base directory for stories relative to the project root
    // IMPORTANT: Adjust this path based on your actual project structure and where you want story directories stored.
    // Using process.cwd() assumes the server runs from the project root.
    const baseStoryDirPath = path.join(process.cwd(), 'user_stories'); // Example base directory
    const userStoryDirPath = path.join(baseStoryDirPath, userId, storyId);

    // Create the directory, including parent directories if they don't exist
    await fs.mkdir(userStoryDirPath, { recursive: true });

    console.log(`Directory created for story ${storyId} at: ${userStoryDirPath}`);
    return NextResponse.json({ message: 'Directory created successfully', path: userStoryDirPath }, { status: 201 });

  } catch (error: unknown) { // Use unknown
    console.error('Error creating story directory:', error);
    // Check for specific file system errors if needed
    // Check if error is an object and has a 'code' property before accessing it
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST') {
        // Optionally handle the case where the directory already exists
        // Note: req.url might not be the best identifier here, consider using storyId
        console.warn(`Directory for story ${storyId} already exists.`);
        // You might want to return a success or a specific status code here
        return NextResponse.json({ message: 'Directory already exists' }, { status: 200 });
    }
    // Type check for general error message
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to create story directory', details: message }, { status: 500 });
  }
}
