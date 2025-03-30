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
  const [manuscriptMdPath, setManuscriptMdPath] = useState<string | null>(null); // State for MD download path
  // Removed PDF path state

  // Scene Management State
  interface Scene {
    id: string; // Unique ID for React keys and updates
    description: string; // User prompt for the scene
    content: string; // Generated/edited scene content
    isGenerating?: boolean; // Optional loading state per scene
  }
  const [chapterScenes, setChapterScenes] = useState<Scene[]>([]);
  const [sceneDescription, setSceneDescription] = useState<string>(''); // Re-add state for the input field

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

  // Get local storage key for a chapter's scenes
  const getChapterScenesKey = (chapterNumber: number) => `shadowquill_chapter_${chapterNumber}_scenes`;

  // Load content and scenes for the selected chapter or previous chapter when selection changes
  useEffect(() => {
    if (selectedChapter) {
      // Load current chapter's saved full content
      const chapterContentKey = `${LOCAL_STORAGE_KEYS.GENERATED_CHAPTER_CONTENT_PREFIX}${selectedChapter.chapterNumber}`;
      const savedContent = localStorage.getItem(chapterContentKey);
      setGeneratedContent(savedContent || '');

      // Load current chapter's saved scenes
      const scenesKey = getChapterScenesKey(selectedChapter.chapterNumber);
      const savedScenes = localStorage.getItem(scenesKey);
      if (savedScenes) {
        try {
          setChapterScenes(JSON.parse(savedScenes));
        } catch (e) {
          console.error("Failed to parse saved scenes", e);
          setChapterScenes([]);
        }
      } else {
        setChapterScenes([]); // Initialize if no scenes saved
      }


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
      // Clear state when no chapter is selected
      setGeneratedContent('');
      setPreviousChapterContent('');
      setChapterScenes([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapter]); // Dependency: selectedChapter

  // Save scenes to local storage whenever they change for the selected chapter
  useEffect(() => {
    if (selectedChapter && chapterScenes.length > 0) {
      const scenesKey = getChapterScenesKey(selectedChapter.chapterNumber);
      localStorage.setItem(scenesKey, JSON.stringify(chapterScenes));
    }
    // If scenes array becomes empty for a selected chapter, remove from storage? Optional.
    // else if (selectedChapter && chapterScenes.length === 0) {
    //   const scenesKey = getChapterScenesKey(selectedChapter.chapterNumber);
    //   localStorage.removeItem(scenesKey);
    // }
  }, [chapterScenes, selectedChapter]);

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

  // --- Scene Generation Logic ---
  const { complete: completeScene, isLoading: isGeneratingAnyScene } = useCompletion({
    api: '/api/ai-writer/scene/generate',
    // onFinish needs to be handled per-scene call
    onError: (err) => {
      console.error("Scene generation error:", err);
      // Find the scene that was generating and update its content with error
      setChapterScenes(prevScenes => prevScenes.map(scene =>
        scene.isGenerating ? { ...scene, content: `Error: ${err.message}`, isGenerating: false } : scene
      ));
    }
  });

  // Function to add a new empty scene
  const addScene = () => {
    const newScene: Scene = {
      id: Date.now().toString(), // Simple unique ID
      description: '',
      content: '',
    };
    setChapterScenes(prevScenes => [...prevScenes, newScene]);
  };

  // Function to update a scene's description or content
  const updateScene = (id: string, field: 'description' | 'content', value: string) => {
    setChapterScenes(prevScenes => prevScenes.map(scene =>
      scene.id === id ? { ...scene, [field]: value } : scene
    ));
  };

  // Function to delete a scene
  const deleteScene = (id: string) => {
    setChapterScenes(prevScenes => prevScenes.filter(scene => scene.id !== id));
  };

  // Function to trigger generation for a specific scene
  const handleGenerateScene = async (sceneId: string) => {
    const sceneToGenerate = chapterScenes.find(s => s.id === sceneId);
    if (!sceneToGenerate || !selectedChapter || !sceneToGenerate.description.trim()) {
      alert('Scene description is empty.');
      return;
    }
    if (!worldDescription || !characterProfiles || !fullOutline) {
      alert('Missing required context (World, Characters, or Outline).');
      return;
    }

    // Mark the specific scene as generating
    setChapterScenes(prevScenes => prevScenes.map(scene =>
      scene.id === sceneId ? { ...scene, isGenerating: true, content: 'Generating...' } : scene
    ));

    // Determine previous context (could be previous scene's content or chapter start)
    const sceneIndex = chapterScenes.findIndex(s => s.id === sceneId);
    const previousContextForScene = sceneIndex > 0
      ? chapterScenes[sceneIndex - 1].content
      : 'Start of the chapter.';

    try {
      const finalCompletion = await completeScene('', {
        body: {
          worldContext: worldDescription,
          characterContext: characterProfiles,
          outlineContext: fullOutline,
          previousContext: previousContextForScene,
          chapterNumber: selectedChapter.chapterNumber,
          chapterTitle: selectedChapter.title,
          chapterOutline: selectedChapter.rawContent,
          sceneDescription: sceneToGenerate.description,
        }
      });

      // Update the specific scene's content on completion
      if (finalCompletion) {
        setChapterScenes(prevScenes => prevScenes.map(scene =>
          scene.id === sceneId ? { ...scene, content: finalCompletion, isGenerating: false } : scene
        ));
      } else {
         // Handle case where completion is empty/null (might indicate an error handled by onError)
         setChapterScenes(prevScenes => prevScenes.map(scene =>
           scene.id === sceneId ? { ...scene, content: scene.content.startsWith('Error:') ? scene.content : 'Generation failed.', isGenerating: false } : scene
         ));
      }
    } catch (error) {
       // Error should be caught by the useCompletion onError, but just in case
       console.error("Error in handleGenerateScene:", error);
       setChapterScenes(prevScenes => prevScenes.map(scene =>
         scene.id === sceneId ? { ...scene, content: `Error: ${(error as Error).message}`, isGenerating: false } : scene
       ));
    }
  };


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
      chapterOutline: selectedChapter.rawContent, // Pass the specific outline section
      // Format scenes into a string for the prompt
      chapterScenes: chapterScenes.map((scene, index) =>
        `Scene ${index + 1} Description: ${scene.description}\nScene ${index + 1} Content:\n${scene.content}`
      ).join('\n\n---\n\n') // Separator between scenes
    }});
  }, [selectedChapter, worldDescription, characterProfiles, fullOutline, previousChapterContent, chapterScenes, complete]); // Add chapterScenes dependency

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

              {/* --- Scene Management Section --- */}
              <div className="mb-8 border-b pb-6">
                <h3 className="text-xl font-semibold mb-4">Chapter Scenes</h3>
                {chapterScenes.map((scene, index) => (
                  <div key={scene.id} className="mb-6 p-4 border rounded-md dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                    <label htmlFor={`scene-desc-${scene.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Scene {index + 1} Description:
                    </label>
                    <textarea
                      id={`scene-desc-${scene.id}`}
                      value={scene.description}
                      onChange={(e) => updateScene(scene.id, 'description', e.target.value)}
                      placeholder="Describe the scene goal, characters involved, setting, key actions..."
                      rows={3}
                      className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white mb-2"
                      disabled={scene.isGenerating || isGeneratingAnyScene}
                    />
                    <label htmlFor={`scene-content-${scene.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 mt-2">
                      Scene Content:
                    </label>
                    <textarea
                      id={`scene-content-${scene.id}`}
                      value={scene.isGenerating ? 'Generating...' : scene.content}
                      onChange={(e) => updateScene(scene.id, 'content', e.target.value)}
                      placeholder="Generated scene content will appear here. You can also write/edit directly."
                      rows={10}
                      className={`w-full p-2 border rounded-md dark:border-gray-600 dark:text-white whitespace-pre-wrap mb-2 ${scene.isGenerating ? 'bg-gray-100 dark:bg-gray-900' : 'dark:bg-gray-700'}`}
                      readOnly={scene.isGenerating || isGeneratingAnyScene}
                    />
                    <div className="flex justify-between items-center">
                       <button
                         onClick={() => handleGenerateScene(scene.id)}
                         className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-1 px-3 rounded text-sm disabled:opacity-50"
                         disabled={scene.isGenerating || isGeneratingAnyScene || !scene.description.trim()}
                       >
                         {scene.isGenerating ? 'Generating...' : (scene.content ? 'Regenerate' : 'Generate')}
                       </button>
                       <button
                         onClick={() => deleteScene(scene.id)}
                         className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                         disabled={scene.isGenerating || isGeneratingAnyScene}
                       >
                         Delete Scene
                       </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addScene}
                  className="mt-2 w-full border-dashed border-2 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium py-2 px-4 rounded"
                  disabled={isGeneratingAnyScene}
                >
                  + Add Scene
                </button>
              </div>
              {/* --- End Scene Management Section --- */}

              {/* --- Full Chapter Generation Section --- */}
              <div>
                 <h3 className="text-xl font-semibold mb-4">Full Chapter Content</h3>
                 <button
                   onClick={handleGenerateChapter}
                   disabled={isGenerating || !worldDescription || !characterProfiles || !fullOutline || chapterScenes.length === 0} // Disable if no scenes
                   className="w-full mb-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                   title={chapterScenes.length === 0 ? "Add and generate scenes first" : `Generate full chapter using outline and ${chapterScenes.length} scene(s)`}
                 >
                   {isGenerating ? 'Generating Full Chapter...' : `Generate Full Chapter (using ${chapterScenes.length} scene(s))`}
                 </button>
                 {generationError && (
                   <p className="text-red-500 mb-2">Error generating chapter: {generationError.message}</p>
                 )}

                 <textarea
                   value={isGenerating ? 'Generating...' : generatedContent}
                   onChange={(e) => setGeneratedContent(e.target.value)}
                   placeholder={`Generated full chapter content for Chapter ${selectedChapter.chapterNumber} will appear here...`}
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
                       setManuscriptMdPath(null); // Reset compile state if last chapter is re-saved
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
              </div>
               {/* --- End Full Chapter Generation Section --- */}


              {/* Display compile button/link after last chapter is saved */}
              {selectedChapter.chapterNumber === parsedChapters.length && !isSaving && (
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-lg font-semibold mb-2">Manuscript Compilation</h3>
                  {!manuscriptMdPath ? ( // Show compile button if MD path is not set
                    <button
                      onClick={async () => {
                        setIsCompiling(true);
                        setManuscriptMdPath(null); // Reset path
                        try {
                          const response = await fetch('/api/compile-book', { method: 'POST' });
                          const result = await response.json(); // Parse JSON
                          if (!response.ok) {
                             throw new Error(result.error || 'Failed to compile manuscript');
                          }
                          setManuscriptMdPath(result.mdPath); // Set the MD download path
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
                      {isCompiling ? 'Compiling...' : 'Compile Full Manuscript (.md)'}
                    </button>
                  ) : (
                    <div className="text-center space-y-3">
                      <p className="text-green-700 dark:text-green-400">Manuscript compiled!</p>
                      <a
                        href={manuscriptMdPath}
                        download="full_manuscript.md"
                        className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                      >
                        Download Manuscript (.md)
                      </a>
                       <button
                         onClick={() => setManuscriptMdPath(null)} // Reset path to allow recompiling
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
