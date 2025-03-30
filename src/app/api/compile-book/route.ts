import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
// Removed md-to-pdf import

const OUTPUT_DIRECTORY = path.resolve(process.cwd(), 'public', 'ai-writer-output');
const MANUSCRIPT_MD_FILENAME = 'full_manuscript.md';
// Removed PDF filename constant

// Helper function to extract chapter number from filename (e.g., chapter_10.md -> 10)
const getChapterNumber = (filename: string): number | null => {
  const match = filename.match(/^chapter_(\d+)\.md$/);
  return match ? parseInt(match[1], 10) : null;
};

export async function POST(req: Request) {
  try {
    // 1. Read directory contents
    let files;
    try {
      files = await fs.readdir(OUTPUT_DIRECTORY);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Directory doesn't exist, means no chapters saved yet
        return NextResponse.json({ error: 'Output directory not found. No chapters to compile.' }, { status: 404 });
      }
      throw error; // Re-throw other errors
    }


    // 2. Filter and sort chapter files
    const chapterFiles = files
      .map(file => ({ name: file, number: getChapterNumber(file) }))
      .filter(file => file.number !== null)
      .sort((a, b) => a.number! - b.number!); // Sort numerically

    if (chapterFiles.length === 0) {
      return NextResponse.json({ error: 'No chapter files found to compile.' }, { status: 404 });
    }

    // 3. Read and concatenate content
    let fullContent = '';
    for (const file of chapterFiles) {
      const filePath = path.join(OUTPUT_DIRECTORY, file.name);
      const chapterContent = await fs.readFile(filePath, 'utf8');
      // Optional: Add a separator or chapter heading if not already in the content
      // fullContent += `\n\n# Chapter ${file.number}\n\n`; // Example separator
      fullContent += chapterContent + '\n\n'; // Add double newline between chapters
    }

    // 4. Write the full manuscript Markdown file
    const manuscriptMdPath = path.join(OUTPUT_DIRECTORY, MANUSCRIPT_MD_FILENAME);
    const finalMdContent = fullContent.trim();
    await fs.writeFile(manuscriptMdPath, finalMdContent, 'utf8');
    console.log(`Manuscript Markdown saved successfully: ${manuscriptMdPath}`);

    // 5. Return success response with the relative path for MD download link
    const downloadMdPath = `/ai-writer-output/${MANUSCRIPT_MD_FILENAME}`;
    return NextResponse.json({
        message: 'Manuscript compiled successfully (Markdown)',
        mdPath: downloadMdPath,
    });

  } catch (error: any) {
    console.error('Error compiling manuscript:', error);
    return NextResponse.json({ error: 'Failed to compile manuscript', details: error.message }, { status: 500 });
  }
}
