import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
// Removed md-to-pdf import

const OUTPUT_DIRECTORY = path.resolve(process.cwd(), 'public', 'ai-writer-output');
// Removed static manuscript filename constant

// Helper function to extract chapter number from filename (e.g., chapter_10.md -> 10)
const getChapterNumber = (filename: string): number | null => {
  const match = filename.match(/^chapter_(\d+)\.md$/);
  return match ? parseInt(match[1], 10) : null;
};

interface CompileBookRequestBody {
  storyId: string;
  storyTitle?: string; // Add optional storyTitle
}

export async function POST(req: Request) {
  try {
    const { storyId, storyTitle = 'Untitled_Story' }: CompileBookRequestBody = await req.json(); // Get title, provide default

    if (!storyId) {
      return NextResponse.json({ error: 'Missing storyId' }, { status: 400 });
    }

    // Sanitize storyId for directory name
    const safeStoryId = storyId.replace(/[^a-zA-Z0-9_-]/g, '_');
     if (!safeStoryId) {
          return NextResponse.json({ error: 'Invalid storyId resulting in empty directory name' }, { status: 400 });
     }
     const storyDirectory = path.join(OUTPUT_DIRECTORY, safeStoryId);
     const chaptersDirectory = path.join(storyDirectory, 'chapters'); // Define chapters subdir path

     // 1. Read chapters subdirectory contents
    let files;
    console.log(`Attempting to read directory: ${chaptersDirectory}`); // Log directory path
    try {
      files = await fs.readdir(chaptersDirectory); // Read from chapters subdir
      console.log(`Files found in directory: ${files.join(', ') || 'None'}`); // Log found files
    } catch (error: any) {
      console.error(`Error reading directory ${chaptersDirectory}:`, error); // Log specific error
      if (error.code === 'ENOENT') {
        // Directory doesn't exist, means no chapters saved yet
        return NextResponse.json({ error: 'Output directory not found. No chapters to compile.' }, { status: 404 });
      }
      throw error; // Re-throw other errors
    }


    // 2. Filter and sort chapter files within the story directory
    const chapterFiles = files
      .map(file => ({ name: file, number: getChapterNumber(file) }))
      .filter(file => file.number !== null)
      .sort((a, b) => a.number! - b.number!); // Sort numerically

    if (chapterFiles.length === 0) {
      return NextResponse.json({ error: 'No chapter files found to compile.' }, { status: 404 });
    }

    // 3. Read and concatenate content from the chapters subdirectory
    let fullContent = '';
    for (const file of chapterFiles) {
      const filePath = path.join(chaptersDirectory, file.name); // Read from chapters subdir
      const chapterContent = await fs.readFile(filePath, 'utf8');
      // Optional: Add a separator or chapter heading if not already in the content
      // fullContent += `\n\n# Chapter ${file.number}\n\n`; // Example separator
      fullContent += chapterContent + '\n\n'; // Add double newline between chapters
    }

    // Sanitize the story title for use as a filename
    const safeTitle = storyTitle.replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/\s+/g, '_');
    const manuscriptFilename = safeTitle ? `${safeTitle}.md` : 'full_manuscript.md'; // Fallback filename

    // 4. Write the full manuscript Markdown file into the story directory with the new name
    const manuscriptMdPath = path.join(storyDirectory, manuscriptFilename); // Use storyDirectory and dynamic name
    const finalMdContent = fullContent.trim();
    await fs.writeFile(manuscriptMdPath, finalMdContent, 'utf8');
    console.log(`Manuscript Markdown saved successfully: ${manuscriptMdPath}`);

    // 5. Return success response with the relative path for MD download link (including storyId and new filename)
    const downloadMdPath = `/ai-writer-output/${safeStoryId}/${manuscriptFilename}`;
    return NextResponse.json({
        message: 'Manuscript compiled successfully (Markdown)',
        mdPath: downloadMdPath,
        filename: manuscriptFilename // Also return the filename for the download attribute
    });

  } catch (error: any) {
    console.error('Error compiling manuscript:', error);
    return NextResponse.json({ error: 'Failed to compile manuscript', details: error.message }, { status: 500 });
  }
}
