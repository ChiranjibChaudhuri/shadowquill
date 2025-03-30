import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

// Define the base directory for saving files relative to the project root
// IMPORTANT: Ensure this directory exists or handle its creation.
// Saving directly into 'public' might have deployment implications.
const SAVE_DIRECTORY = path.resolve(process.cwd(), 'public', 'ai-writer-output');

interface SaveFileRequestBody {
  filename: string;
  content: string;
}

export async function POST(req: Request) {
  try {
    const { filename, content }: SaveFileRequestBody = await req.json();

    if (!filename || typeof content === 'undefined') {
      return NextResponse.json({ error: 'Missing filename or content' }, { status: 400 });
    }

    // Basic sanitization to prevent path traversal
    const safeFilename = path.basename(filename);
    if (safeFilename !== filename) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(SAVE_DIRECTORY, safeFilename);

    // Ensure the directory exists
    try {
        await fs.mkdir(SAVE_DIRECTORY, { recursive: true });
    } catch (dirError: any) {
        // Ignore error if directory already exists, otherwise rethrow
        if (dirError.code !== 'EEXIST') {
            throw dirError;
        }
    }


    // Write the file
    await fs.writeFile(filePath, content, 'utf8');

    console.log(`File saved successfully: ${filePath}`);
    return NextResponse.json({ message: 'File saved successfully', path: filePath });

  } catch (error: any) {
    console.error('Error saving file:', error);
    return NextResponse.json({ error: 'Failed to save file', details: error.message }, { status: 500 });
  }
}
