'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useCompletion } from 'ai/react';
import StageLayout from '@/components/StageLayout';

// Define structure for parsed chapters (consistent with outline page)
interface Chapter {
  chapterNumber: number;
  title: string;
  summary?: string;
  keyEvents?: string[];
  characterDevelopment?: string[];
  setting?: string;
  themes?: string;
  setup?: string;
  endingHook?: string;
  rawContent: string; // The specific outline section for this chapter
}

// Local storage keys
const LOCAL_STORAGE_KEYS = {
  WORLD_DESCRIPTION: 'shadowquill_world_description',
  CHARACTER_PROFILES: 'shadowquill_character_profiles',
  OUTLINE: 'shadowquill_outline', // Full outline text
  PARSED_CHAPTERS: 'shadowquill_parsed_chapters',
  GENERATED_CHAPTER_CONTENT_PREFIX: 'shadowquill_chapter_content_', // Prefix for chapter content keys
};

export default function WriteChapterPage() {
  const [worldDescription, setWorldDescription] = useState<string>('');
  const [characterProfiles, setCharacterProfiles] = useState<string>('');
  const [fullOutline, setFullOutline] = useState<string>('');
  const [parsedChapters, setParsedChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [previousChapterContent, setPreviousChapterContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false); // State for save button loading
  const [isCompiling, setIsCompiling] = useState<boolean>(false); // State for compilation
  const [manuscriptPath, setManuscriptPath] = useState<string | null>(null); // State for download path

  // Load context and parsed chapters from local storage
  useEffect(() => {
    setWorldDescription(localStorage.getItem(LOCAL_STORAGE_KEYS.WORLD_DESCRIPTION) || '');
    setCharacterProfiles(localStorage.getItem(LOCAL_STORAGE_KEYS.CHARACTER_PROFILES) || '');
    setFullOutline(localStorage.getItem(LOCAL_STORAGE_KEYS.OUTLINE) || '');
    const savedChapters = localStorage.getItem(LOCAL_STORAGE_KEYS.PARSED_CHAPTERS);
    if (savedChapters) {
      try {
        setParsedChapters(JSON.parse(savedChapters));
      } catch (e) {
        console.error("Failed to parse saved chapters", e);
      }
    }
  }, []);

  // Load content for the selected chapter or previous chapter when selection changes
  useEffect(() => {
    if (selectedChapter) {
      // Load current chapter's saved content
      const savedContent = localStorage.getItem(
        `${LOCAL_STORAGE_KEYS.GENERATED_CHAPTER_CONTENT_PREFIX}${selectedChapter.chapterNumber}`
      );
      setGeneratedContent(savedContent || '');

      // Load previous chapter's content for context
      if (selectedChapter.chapterNumber > 1) {
        const prevSavedContent = localStorage.getItem(
          `${LOCAL_STORAGE_KEYS.GENERATED_CHAPTER_CONTENT_PREFIX}${selectedChapter.chapterNumber - 1}`
        );
        // Maybe just use the last N characters/words as context? Or a summary?
        // For now, using full previous content if available.
        setPreviousChapterContent(prevSavedContent || "Previous chapter content not found.");
      } else {
        setPreviousChapterContent("This is the first chapter.");
      }
    } else {
      setGeneratedContent('');
      setPreviousChapterContent('');
    }
  }, [selectedChapter]);

  // --- Chapter Generation Logic ---
  const { complete, completion, isLoading: isGenerating, error: generationError } = useCompletion({
    api: '/api/ai-writer/chapter/generate',
    onFinish: (_, finalCompletion) => {
      setGeneratedContent(finalCompletion);
      // Save generated content automatically
      if (selectedChapter) {
        localStorage.setItem(
          `${LOCAL_STORAGE_KEYS.GENERATED_CHAPTER_CONTENT_PREFIX}${selectedChapter.chapterNumber}`,
          finalCompletion
        );
      }
    },
    onError: (err) => {
      console.error("Chapter generation error:", err);
      // Display error to user?
    }
  });

  const handleGenerateChapter = useCallback(async () => {
    if (!selectedChapter) {
      alert('Please select a chapter to generate.');
      return;
    }
    if (!worldDescription || !characterProfiles || !fullOutline) {
      alert('Missing required context (World, Characters, or Outline). Please complete previous stages.');
      return;
    }

    // Call the generation API
    await complete('', { body: {
      worldContext: worldDescription,
      characterContext: characterProfiles,
      outlineContext: fullOutline, // Pass the full outline text
      previousChapterContext: previousChapterContent,
      chapterNumber: selectedChapter.chapterNumber,
      chapterTitle: selectedChapter.title,
      chapterOutline: selectedChapter.rawContent, // Pass the specific outline section for this chapter
    }});
  }, [selectedChapter, worldDescription, characterProfiles, fullOutline, previousChapterContent, complete]);

  // Function to save manually edited content
  const saveManualEdits = () => {
    if (selectedChapter) {
      localStorage.setItem(
        `${LOCAL_STORAGE_KEYS.GENERATED_CHAPTER_CONTENT_PREFIX}${selectedChapter.chapterNumber}`,
        generatedContent
      );
      alert(`Chapter ${selectedChapter.chapterNumber} content saved.`);
    }
  };

  return (
    <StageLayout> {/* Removed title prop */}
      {parsedChapters.length === 0 && (
         <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-md">
           <strong>Warning:</strong> No chapters found. Please generate and save an outline in Stage 3 first.
         </div>
       )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Chapter List */}
        <div className="md:col-span-1 border-r pr-4">
          <h2 className="text-xl font-semibold mb-4">Chapters</h2>
          {parsedChapters.length > 0 ? (
            <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
              {parsedChapters.map((chap) => (
                <li key={chap.chapterNumber}>
                  <button
                    onClick={() => setSelectedChapter(chap)}
                    className={`w-full text-left p-2 rounded ${
                      selectedChapter?.chapterNumber === chap.chapterNumber
                        ? 'bg-blue-100 dark:bg-blue-900 font-semibold'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    Chapter {chap.chapterNumber}: {chap.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No chapters parsed from outline.</p>
          )}
        </div>

        {/* Right Column: Generation Area */}
        <div className="md:col-span-2">
          {selectedChapter ? (
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                Chapter {selectedChapter.chapterNumber}: {selectedChapter.title}
              </h2>
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded border dark:border-gray-600">
                <h3 className="font-semibold mb-1">Outline Focus:</h3>
                <p className="text-sm whitespace-pre-wrap">{selectedChapter.rawContent}</p>
              </div>

              <button
                onClick={handleGenerateChapter}
                disabled={isGenerating || !worldDescription || !characterProfiles || !fullOutline}
                className="w-full mb-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : `Generate Content for Chapter ${selectedChapter.chapterNumber}`}
              </button>
              {generationError && (
                <p className="text-red-500 mb-2">Error generating: {generationError.message}</p>
              )}

              <textarea
                value={isGenerating ? 'Generating...' : generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                placeholder={`Generated content for Chapter ${selectedChapter.chapterNumber} will appear here...`}
                rows={25}
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white whitespace-pre-wrap"
                readOnly={isGenerating || isSaving} // Disable textarea while saving
              />
              <button
                onClick={async () => {
                  if (!selectedChapter) return;
                  setIsSaving(true);
                  const chapterFilename = `chapter_${selectedChapter.chapterNumber}.md`;
                  const localStorageKey = `${LOCAL_STORAGE_KEYS.GENERATED_CHAPTER_CONTENT_PREFIX}${selectedChapter.chapterNumber}`;

                  // 1. Save to local storage
                  localStorage.setItem(localStorageKey, generatedContent);

                  // 2. Save to file via API
                  try {
                    const response = await fetch('/api/save-file', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        filename: chapterFilename,
                        content: generatedContent
                      }),
                    });
                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.error || 'Failed to save chapter file');
                    }
                    console.log(`Chapter ${selectedChapter.chapterNumber} saved to file successfully.`);

                    // 3. Check if it was the last chapter
                    const isLastChapter = selectedChapter.chapterNumber === parsedChapters.length;

                    if (isLastChapter) {
                      // Don't automatically navigate, user can now compile
                       alert('Last chapter saved! You can now compile the full manuscript.');
                       setManuscriptPath(null); // Reset compile state if last chapter is re-saved
                    } else {
                      // Navigate to the next chapter
                      const nextChapterIndex = parsedChapters.findIndex(chap => chap.chapterNumber === selectedChapter.chapterNumber + 1);
                      if (nextChapterIndex !== -1) {
                        setSelectedChapter(parsedChapters[nextChapterIndex]);
                      }
                    }
                  } catch (error: any) {
                    console.error(`Error saving ${chapterFilename}:`, error);
                    alert(`Error saving file: ${error.message}`);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50" // Updated styles
                disabled={isSaving || isGenerating || !generatedContent} // Disable if saving/generating or no content
              >
                {isSaving ? 'Saving...' : `Save Chapter ${selectedChapter.chapterNumber} & Proceed`}
              </button>

              {/* Display compile button/link after last chapter is saved */}
              {selectedChapter.chapterNumber === parsedChapters.length && !isSaving && (
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-lg font-semibold mb-2">Manuscript Compilation</h3>
                  {!manuscriptPath ? (
                    <button
                      onClick={async () => {
                        setIsCompiling(true);
                        setManuscriptPath(null); // Reset path
                        try {
                          const response = await fetch('/api/compile-book', { method: 'POST' });
                          if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || 'Failed to compile manuscript');
                          }
                          const result = await response.json();
                          setManuscriptPath(result.path); // Set the download path
                          alert('Manuscript compiled successfully!');
                        } catch (error: any) {
                          console.error('Error compiling manuscript:', error);
                          alert(`Error compiling manuscript: ${error.message}`);
                        } finally {
                          setIsCompiling(false);
                        }
                      }}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                      disabled={isCompiling}
                    >
                      {isCompiling ? 'Compiling...' : 'Compile Full Manuscript'}
                    </button>
                  ) : (
                    <div className="text-center">
                      <p className="mb-2 text-green-700 dark:text-green-400">Manuscript compiled!</p>
                      <a
                        href={manuscriptPath}
                        download="full_manuscript.md"
                        className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
                      >
                        Download Manuscript (.md)
                      </a>
                       <button
                         onClick={() => setManuscriptPath(null)} // Allow recompiling
                         className="ml-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                       >
                         Recompile
                       </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select a chapter from the list to view or generate content.</p>
            </div>
          )}
        </div>
      </div>
    </StageLayout>
  );
}
