'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useCompletion } from 'ai/react';
import StageLayout from '@/components/StageLayout';
import { useStoryContext } from '@/context/StoryContext';
import { useRouter } from 'next/navigation';

// Define structure for parsed chapters
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
  rawContent: string;
}

// Scene Management State Interface
interface Scene {
  id: string;
  description: string;
  content: string;
  isGenerating?: boolean;
}

// Define keys for story-specific data (used for localStorage chat history key)
const STORY_DATA_KEYS = {
  WORLD_DESCRIPTION: 'world_description',
  CHARACTER_PROFILES: 'character_profiles',
  OUTLINE: 'outline',
  PARSED_CHAPTERS: 'parsed_chapters', // Still used for saving parsed outline from Outline stage
  GENERATED_CHAPTER_CONTENT_PREFIX: 'chapter_content_',
  CHAPTER_SCENES_PREFIX: 'chapter_scenes_',
};

// Define filenames for backend storage
const FILENAMES = {
    WORLD_DESCRIPTION: 'world.md',
    CHARACTER_PROFILES: 'characters.md',
    OUTLINE: 'outline.md',
    // Chapter content and scenes use dynamic names
}

export default function WriteChapterPage() {
  const { activeStoryId, getStoryData, setStoryData, stories } = useStoryContext();
  const router = useRouter();

  // Context state
  const [worldDescription, setWorldDescription] = useState<string>('');
  const [characterProfiles, setCharacterProfiles] = useState<string>('');
  const [fullOutline, setFullOutline] = useState<string>('');
  const [parsedChapters, setParsedChapters] = useState<Chapter[]>([]);

  // Chapter specific state
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string>(''); // Full chapter content
  const [previousChapterContent, setPreviousChapterContent] = useState<string>('');
  const [chapterScenes, setChapterScenes] = useState<Scene[]>([]);

  // UI states
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [manuscriptMdPath, setManuscriptMdPath] = useState<string | null>(null);
  const [manuscriptFilename, setManuscriptFilename] = useState<string>('full_manuscript.md');

  // Redirect if no active story
  useEffect(() => {
    if (!activeStoryId) {
      router.replace('/stories');
    }
  }, [activeStoryId, router]);

  // Function to fetch data from backend file
  const loadDataFromFile = useCallback(async (filename: string, defaultValue: string = '') => {
    if (!activeStoryId) return defaultValue;
    try {
        const response = await fetch(`/api/read-story-file?storyId=${encodeURIComponent(activeStoryId)}&filename=${encodeURIComponent(filename)}`);
        if (!response.ok) {
            if (response.status !== 404) console.error(`Error loading ${filename}: ${response.statusText}`);
            return defaultValue;
        }
        const data = await response.json();
        return data.content || defaultValue;
    } catch (error) {
        console.error(`Error fetching ${filename}:`, error);
        return defaultValue;
    }
  }, [activeStoryId]);

  // --- Outline Parsing Logic (copied from outline page) ---
  const parseOutline = useCallback((outlineText: string): Chapter[] => {
    const chapters: Chapter[] = [];
    const chapterRegex = /^##\s+Chapter\s+(\d+):\s*(.*)$/gm;
    let match;
    while ((match = chapterRegex.exec(outlineText)) !== null) {
      const chapterNumber = parseInt(match[1], 10);
      const title = match[2].trim();
      const startIndex = match.index;
      chapterRegex.lastIndex = startIndex + match[0].length;
      const nextMatch = chapterRegex.exec(outlineText);
      chapterRegex.lastIndex = match.index + match[0].length;
      const endIndex = nextMatch ? nextMatch.index : outlineText.length;
      const rawContent = outlineText.substring(startIndex, endIndex).trim();
      // Basic parsing (can be enhanced)
      const summaryMatch = rawContent.match(/\*\s+\*\*Summary:\*\*\s*([\s\S]*?)(?=\n\s*\*\s+\*\*|$)/);
      const eventsMatch = rawContent.match(/\*\s+\*\*Key Events:\*\*\s*([\s\S]*?)(?=\n\s*\*\s+\*\*|$)/);
      chapters.push({
        chapterNumber, title, rawContent,
        summary: summaryMatch ? summaryMatch[1].trim() : undefined,
        keyEvents: eventsMatch ? eventsMatch[1].trim().split('\n').map(e => e.trim().replace(/^\*\s*/, '')).filter(e => e) : undefined,
      });
    }
    chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    return chapters;
  }, []);

  // Load general context from backend files
  useEffect(() => {
    const loadGeneralData = async () => {
      if (activeStoryId) {
        setIsLoadingData(true);
        const [loadedWorld, loadedChars, loadedOutline] = await Promise.all([
            loadDataFromFile(FILENAMES.WORLD_DESCRIPTION),
            loadDataFromFile(FILENAMES.CHARACTER_PROFILES),
            loadDataFromFile(FILENAMES.OUTLINE)
        ]);
        setWorldDescription(loadedWorld);
        setCharacterProfiles(loadedChars);
        setFullOutline(loadedOutline);
        // Parse the loaded outline here
        setParsedChapters(parseOutline(loadedOutline));
        // Loading state handled in chapter data loading effect
      } else {
          setWorldDescription('');
          setCharacterProfiles('');
          setFullOutline('');
          setParsedChapters([]);
          setSelectedChapter(null);
          setIsLoadingData(false);
      }
    };
    loadGeneralData();
  }, [activeStoryId, loadDataFromFile, parseOutline]); // Added parseOutline

  // Get local storage key helpers
  const getChapterScenesKey = useCallback((chapterNumber: number) =>
    `${STORY_DATA_KEYS.CHAPTER_SCENES_PREFIX}${chapterNumber}`,
  [],);
  const getChapterContentKey = useCallback((chapterNumber: number) =>
    `${STORY_DATA_KEYS.GENERATED_CHAPTER_CONTENT_PREFIX}${chapterNumber}`,
  [],);

  // Load specific chapter content and scenes
  useEffect(() => {
    const loadChapterData = async () => {
        if (selectedChapter && activeStoryId) {
            setIsLoadingData(true);
            const chapterFilename = `chapter_${selectedChapter.chapterNumber}.md`;
            const scenesKey = getChapterScenesKey(selectedChapter.chapterNumber);

            const [loadedChapterContent, loadedScenes] = await Promise.all([
                loadDataFromFile(chapterFilename, ''),
                Promise.resolve(getStoryData(activeStoryId, scenesKey, [])) // Scenes still from localStorage
            ]);

            setGeneratedContent(loadedChapterContent);
            setChapterScenes(loadedScenes);

            if (selectedChapter.chapterNumber > 1) {
                const prevChapterFilename = `chapter_${selectedChapter.chapterNumber - 1}.md`;
                const prevContent = await loadDataFromFile(prevChapterFilename, "Previous chapter content not found.");
                setPreviousChapterContent(prevContent);
            } else {
                setPreviousChapterContent("This is the first chapter.");
            }
            setIsLoadingData(false);
        } else {
            setGeneratedContent('');
            setPreviousChapterContent('');
            setChapterScenes([]);
            // Only set loading false if no chapter is selected AFTER initial context load is done
            if (!activeStoryId || (activeStoryId && worldDescription !== undefined)) { // Check if context is loaded
                 setIsLoadingData(false);
            }
        }
    };
    // Ensure general data (like parsedChapters) is loaded before trying to load chapter data
    if (parsedChapters.length > 0 || !activeStoryId) {
        loadChapterData();
    } else if (activeStoryId && fullOutline !== undefined) {
        // If outline is loaded but chapters aren't parsed yet (edge case), ensure loading stops
        setIsLoadingData(false);
    }
  }, [selectedChapter, activeStoryId, loadDataFromFile, getStoryData, getChapterScenesKey, parsedChapters, fullOutline, worldDescription]); // Added dependencies

  // Save scenes to localStorage via context
  useEffect(() => {
    if (selectedChapter && activeStoryId) {
      const scenesKey = getChapterScenesKey(selectedChapter.chapterNumber);
      if (chapterScenes.length > 0 || getStoryData(activeStoryId, scenesKey, null) !== null) {
        setStoryData(activeStoryId, scenesKey, chapterScenes);
      }
    }
  }, [chapterScenes, selectedChapter, activeStoryId, setStoryData, getChapterScenesKey, getStoryData]);

  // --- Chapter Generation Logic ---
  const { complete, isLoading: isGenerating, error: generationError } = useCompletion({
    api: '/api/ai-writer/chapter/generate',
    onFinish: (_, finalCompletion) => {
      setGeneratedContent(finalCompletion);
    },
    onError: (err) => {
      console.error("Chapter generation error:", err);
      setGeneratedContent(`Error generating chapter: ${err.message}`);
    }
  });

  // --- Scene Generation Logic ---
  const { complete: completeScene, isLoading: isGeneratingAnyScene } = useCompletion({
    api: '/api/ai-writer/scene/generate',
    onError: (err) => {
      console.error("Scene generation error:", err);
      setChapterScenes(prevScenes => prevScenes.map(scene =>
        scene.isGenerating ? { ...scene, content: `Error: ${err.message}`, isGenerating: false } : scene
      ));
    }
  });

  // Scene Management Functions
  const addScene = () => {
    const newScene: Scene = { id: Date.now().toString(), description: '', content: '' };
    setChapterScenes(prevScenes => [...prevScenes, newScene]);
  };
  const updateScene = (id: string, field: 'description' | 'content', value: string) => {
    setChapterScenes(prevScenes => prevScenes.map(scene =>
      scene.id === id ? { ...scene, [field]: value } : scene
    ));
  };
  const deleteScene = (id: string) => {
    setChapterScenes(prevScenes => prevScenes.filter(scene => scene.id !== id));
  };
  const handleGenerateScene = async (sceneId: string) => {
    const sceneToGenerate = chapterScenes.find(s => s.id === sceneId);
    if (!sceneToGenerate || !selectedChapter || !sceneToGenerate.description.trim() || !activeStoryId) return;
    if (!worldDescription || !characterProfiles || !fullOutline) { alert('Missing required context.'); return; }

    setChapterScenes(prevScenes => prevScenes.map(scene =>
      scene.id === sceneId ? { ...scene, isGenerating: true, content: 'Generating...' } : scene
    ));
    const sceneIndex = chapterScenes.findIndex(s => s.id === sceneId);
    const previousContextForScene = sceneIndex > 0 ? chapterScenes[sceneIndex - 1].content : 'Start of the chapter.';

    try {
      const finalCompletion = await completeScene('', {
        body: {
          worldContext: worldDescription, characterContext: characterProfiles, outlineContext: fullOutline,
          previousContext: previousContextForScene, chapterNumber: selectedChapter.chapterNumber,
          chapterTitle: selectedChapter.title, chapterOutline: selectedChapter.rawContent,
          sceneDescription: sceneToGenerate.description,
        }
      });
      if (finalCompletion) {
        setChapterScenes(prevScenes => prevScenes.map(scene =>
          scene.id === sceneId ? { ...scene, content: finalCompletion, isGenerating: false } : scene
        ));
      } else {
         setChapterScenes(prevScenes => prevScenes.map(scene =>
           scene.id === sceneId ? { ...scene, content: scene.content.startsWith('Error:') ? scene.content : 'Generation failed.', isGenerating: false } : scene
         ));
      }
    } catch (error) {
       console.error("Error in handleGenerateScene:", error);
       setChapterScenes(prevScenes => prevScenes.map(scene =>
         scene.id === sceneId ? { ...scene, content: `Error: ${(error as Error).message}`, isGenerating: false } : scene
       ));
    }
  };

  // Chapter Generation Function
  const handleGenerateChapter = useCallback(async () => {
    if (!selectedChapter || !activeStoryId) { alert('Please select a chapter.'); return; }
    if (!worldDescription || !characterProfiles || !fullOutline) { alert('Missing required context.'); return; }
    if (chapterScenes.length === 0) { alert('Please add and generate at least one scene first.'); return; }

    const formattedScenes = chapterScenes.map((scene, index) =>
        `Scene ${index + 1} Description: ${scene.description}\nScene ${index + 1} Content:\n${scene.content}`
      ).join('\n\n---\n\n');

    await complete('', { body: {
      worldContext: worldDescription, characterContext: characterProfiles, outlineContext: fullOutline,
      previousChapterContext: previousChapterContent, chapterNumber: selectedChapter.chapterNumber,
      chapterTitle: selectedChapter.title, chapterOutline: selectedChapter.rawContent,
      chapterScenes: formattedScenes
    }});
  }, [selectedChapter, activeStoryId, worldDescription, characterProfiles, fullOutline, previousChapterContent, chapterScenes, complete]);

  // Save and Proceed Function
  const handleSaveAndProceed = async () => {
     if (!selectedChapter || !activeStoryId) return;
     setIsSaving(true);
     const chapterFilename = `chapter_${selectedChapter.chapterNumber}.md`;
     // Save full chapter content to file via API
     try {
       const response = await fetch('/api/save-file', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ storyId: activeStoryId, filename: chapterFilename, content: generatedContent }),
       });
       if (!response.ok) throw new Error((await response.json()).error || 'Failed to save chapter file');
       console.log(`Chapter ${selectedChapter.chapterNumber} saved to file successfully.`);

       // Save scenes to localStorage
       const scenesKey = getChapterScenesKey(selectedChapter.chapterNumber);
       setStoryData(activeStoryId, scenesKey, chapterScenes);

       const isLastChapter = selectedChapter.chapterNumber === parsedChapters.length;
       if (isLastChapter) {
          alert('Last chapter saved! You can now compile the full manuscript.');
          setManuscriptMdPath(null);
       } else {
         const nextChapterIndex = parsedChapters.findIndex(chap => chap.chapterNumber === selectedChapter.chapterNumber + 1);
         if (nextChapterIndex !== -1) setSelectedChapter(parsedChapters[nextChapterIndex]);
       }
     } catch (error: any) {
       console.error(`Error saving ${chapterFilename}:`, error);
       alert(`Error saving file: ${error.message}`);
     } finally {
       setIsSaving(false);
     }
  };

  // Compile Manuscript Function
  const handleCompile = async () => {
      console.log("handleCompile called. activeStoryId:", activeStoryId); // Log entry
      if (!activeStoryId) {
          console.log("handleCompile aborted: No activeStoryId");
          return;
      }

      // Ensure state is reset even if finding title fails (though unlikely)
      let storyTitle = 'Untitled_Story';
      try {
          console.log("Setting isCompiling to true");
          setIsCompiling(true);
          setManuscriptMdPath(null);
          setManuscriptFilename('full_manuscript.md'); // Default filename

          const currentStory = stories.find(s => s.id === activeStoryId);
          storyTitle = currentStory?.title || 'Untitled_Story'; // Get title or use default
          console.log("Found story title:", storyTitle);

          console.log("Calling /api/compile-book with:", { storyId: activeStoryId, storyTitle });
          const response = await fetch('/api/compile-book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storyId: activeStoryId, storyTitle }) // Send storyId and title
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Failed to compile manuscript');
          setManuscriptMdPath(result.mdPath);
          setManuscriptFilename(result.filename || 'full_manuscript.md');
          alert('Manuscript compiled successfully!');
      } catch (error: any) {
        console.error('Error compiling manuscript:', error);
        alert(`Error compiling manuscript: ${error.message}`);
      } finally {
        console.log("Setting isCompiling back to false");
        setIsCompiling(false);
      }
  };


  return (
    <StageLayout>
      {!activeStoryId && (
         <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-md">
           Please select or create a story from the <a href="/stories" className="font-bold underline">Stories page</a> to begin.
         </div>
       )}
       {/* Updated warning condition */}
       {activeStoryId && !isLoadingData && fullOutline && parsedChapters.length === 0 && (
         <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-md">
           <strong>Warning:</strong> Could not parse chapters from the outline file. Please check the outline format in Stage 3.
         </div>
       )}
       {isLoadingData && activeStoryId && ( // Loading indicator
           <div className="text-center p-10">Loading story data...</div>
       )}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 ${isLoadingData ? 'opacity-50 pointer-events-none' : ''}`}> {/* Disable interactions while loading */}
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
                     disabled={!activeStoryId || isLoadingData}
                   >
                     Chapter {chap.chapterNumber}: {chap.title}
                   </button>
                 </li>
               ))}
             </ul>
           ) : (
             <p className="text-gray-500">{activeStoryId ? 'No chapters found or outline empty/invalid.' : 'Select a story first.'}</p>
           )}
        </div>

        {/* Right Column: Generation Area */}
        <div className="md:col-span-2">
          {selectedChapter && activeStoryId ? (
            <div>
              {/* ... (rest of the component: chapter title, outline focus, scene management, chapter generation, save button, compilation section) ... */}
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
                     {/* ... scene description, content, buttons ... */}
                      <label htmlFor={`scene-desc-${scene.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scene {index + 1} Description:</label>
                      <textarea id={`scene-desc-${scene.id}`} value={scene.description} onChange={(e) => updateScene(scene.id, 'description', e.target.value)} placeholder="Describe the scene goal..." rows={3} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white mb-2" disabled={scene.isGenerating || isGeneratingAnyScene}/>
                      <label htmlFor={`scene-content-${scene.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 mt-2">Scene Content:</label>
                      <textarea id={`scene-content-${scene.id}`} value={scene.isGenerating ? 'Generating...' : scene.content} onChange={(e) => updateScene(scene.id, 'content', e.target.value)} placeholder="Generated scene content..." rows={10} className={`w-full p-2 border rounded-md dark:border-gray-600 dark:text-white whitespace-pre-wrap mb-2 ${scene.isGenerating ? 'bg-gray-100 dark:bg-gray-900' : 'dark:bg-gray-700'}`} readOnly={scene.isGenerating || isGeneratingAnyScene}/>
                      <div className="flex justify-between items-center">
                         <button onClick={() => handleGenerateScene(scene.id)} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-1 px-3 rounded text-sm disabled:opacity-50" disabled={scene.isGenerating || isGeneratingAnyScene || !scene.description.trim()}>{scene.isGenerating ? 'Generating...' : (scene.content ? 'Regenerate' : 'Generate')}</button>
                         <button onClick={() => deleteScene(scene.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium" disabled={scene.isGenerating || isGeneratingAnyScene}>Delete Scene</button>
                      </div>
                   </div>
                 ))}
                 <button onClick={addScene} className="mt-2 w-full border-dashed border-2 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium py-2 px-4 rounded" disabled={isGeneratingAnyScene}>+ Add Scene</button>
               </div>
               {/* --- End Scene Management Section --- */}

               {/* --- Full Chapter Generation Section --- */}
               <div>
                  <h3 className="text-xl font-semibold mb-4">Full Chapter Content</h3>
                  <button onClick={handleGenerateChapter} disabled={!activeStoryId || isGenerating || !worldDescription || !characterProfiles || !fullOutline || chapterScenes.length === 0} className="w-full mb-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50" title={chapterScenes.length === 0 ? "Add and generate scenes first" : `Generate full chapter using outline and ${chapterScenes.length} scene(s)`}>{isGenerating ? 'Generating Full Chapter...' : `Generate Full Chapter (using ${chapterScenes.length} scene(s))`}</button>
                  {generationError && (<p className="text-red-500 mb-2">Error generating chapter: {generationError.message}</p>)}
                  <textarea value={isGenerating ? 'Generating...' : generatedContent} onChange={(e) => setGeneratedContent(e.target.value)} placeholder={`Generated full chapter content...`} rows={25} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white whitespace-pre-wrap" readOnly={!activeStoryId || isGenerating || isSaving}/>
                  <button onClick={handleSaveAndProceed} className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50" disabled={!activeStoryId || isSaving || isGenerating || !generatedContent}>{isSaving ? 'Saving...' : `Save Chapter ${selectedChapter.chapterNumber} & Proceed`}</button>
               </div>
                {/* --- End Full Chapter Generation Section --- */}

               {/* Display compile button/link after last chapter is saved */}
               {selectedChapter.chapterNumber === parsedChapters.length && !isSaving && (
                 <div className="mt-6 border-t pt-4">
                   <h3 className="text-lg font-semibold mb-2">Manuscript Compilation</h3>
                   {!manuscriptMdPath ? (
                     <button onClick={handleCompile} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50" disabled={!activeStoryId || isCompiling}>{isCompiling ? 'Compiling...' : 'Compile Full Manuscript (.md)'}</button>
                   ) : (
                     <div className="text-center space-y-3">
                       <p className="text-green-700 dark:text-green-400">Manuscript compiled!</p>
                       <a href={manuscriptMdPath} download={manuscriptFilename} className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Download Manuscript (.md)</a>
                        <button onClick={() => setManuscriptMdPath(null)} className="ml-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">Recompile</button>
                     </div>
                   )}
                 </div>
               )}
            </div>
          ) : (
             <div className="flex items-center justify-center h-full text-gray-500">
               <p>{activeStoryId ? 'Select a chapter from the list to begin.' : 'Select or create a story first.'}</p>
             </div>
          )}
        </div>
      </div>
    </StageLayout>
  );
}
