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
  CHAPTER_SCENES_PREFIX: 'chapter_scenes_', // Keep for scenes localStorage
};

// Define filenames for backend storage
const FILENAMES = {
    WORLD_DESCRIPTION: 'world.md',
    CHARACTER_PROFILES: 'characters.md',
    OUTLINE: 'outline.md',
}

export default function WriteChapterPage() {
  const { activeStoryId, stories } = useStoryContext(); // Removed get/setStoryData
  const router = useRouter();

  // Context state loaded from files
  const [worldDescription, setWorldDescription] = useState<string>('');
  const [characterProfiles, setCharacterProfiles] = useState<string>('');
  const [fullOutline, setFullOutline] = useState<string>('');
  const [parsedChapters, setParsedChapters] = useState<Chapter[]>([]);

  // Chapter specific state
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string>(''); // Loaded/Saved via API
  const [previousChapterContent, setPreviousChapterContent] = useState<string>(''); // Loaded via API
  const [chapterScenes, setChapterScenes] = useState<Scene[]>([]); // Still uses localStorage

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

  // Function to fetch data from backend file API
  const loadDataFromApi = useCallback(async (endpoint: string, params: Record<string, string>, defaultValue: any = '') => {
    if (!activeStoryId) return defaultValue;
    const queryParams = new URLSearchParams({ storyId: activeStoryId, ...params }).toString();
    try {
        const response = await fetch(`${endpoint}?${queryParams}`);
        if (!response.ok) {
            if (response.status !== 404) console.error(`Error loading data from ${endpoint}: ${response.statusText}`);
            return defaultValue;
        }
        return await response.json(); // Return the parsed JSON data
    } catch (error) {
        console.error(`Error fetching data from ${endpoint}:`, error);
        return defaultValue;
    }
  }, [activeStoryId]);

  // --- Outline Parsing Logic ---
  const parseOutline = useCallback((outlineText: string): Chapter[] => {
    // ... (parsing logic remains the same)
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

  // Load general context from backend files/APIs
  useEffect(() => {
    const loadGeneralData = async () => {
      if (activeStoryId) {
        setIsLoadingData(true);
        const [worldData, charData, outlineData] = await Promise.all([
            loadDataFromApi('/api/story-data/world', {}),
            loadDataFromApi('/api/story-data/characters', {}),
            loadDataFromApi('/api/story-data/outline', {})
        ]);
        setWorldDescription(worldData?.description ?? '');
        setCharacterProfiles(charData?.profiles ?? '');
        setFullOutline(outlineData?.outline ?? '');
        setParsedChapters(parseOutline(outlineData?.outline ?? ''));
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
  }, [activeStoryId, loadDataFromApi, parseOutline]);

  // Get localStorage key helper for scenes
  const getChapterScenesKey = useCallback((chapterNumber: number) =>
    `shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.CHAPTER_SCENES_PREFIX}${chapterNumber}`,
  [activeStoryId]);

  // Load specific chapter content (from API) and scenes (from localStorage)
  useEffect(() => {
    const loadChapterData = async () => {
        if (selectedChapter && activeStoryId) {
            setIsLoadingData(true);
            const scenesKey = getChapterScenesKey(selectedChapter.chapterNumber);

            // Use standard localStorage access for scenes
            const getLocalStorageScenes = (key: string, defaultValue: Scene[]): Scene[] => {
                const storedData = localStorage.getItem(key);
                 if (storedData !== null) {
                   try { return JSON.parse(storedData) as Scene[]; } catch (e) { console.error("Parse error for scenes", e); return defaultValue; }
                 }
                 return defaultValue;
            }

            const [chapterData, loadedScenes, prevChapterData] = await Promise.all([
                loadDataFromApi('/api/story-data/chapter', { chapterNumber: String(selectedChapter.chapterNumber) }, { content: '' }),
                Promise.resolve(getLocalStorageScenes(scenesKey, [])),
                selectedChapter.chapterNumber > 1
                    ? loadDataFromApi('/api/story-data/chapter', { chapterNumber: String(selectedChapter.chapterNumber - 1) }, { content: "Previous chapter content not found." })
                    : Promise.resolve({ content: "This is the first chapter." })
            ]);

            setGeneratedContent(chapterData?.content ?? '');
            setChapterScenes(loadedScenes);
            setPreviousChapterContent(prevChapterData?.content ?? "Previous chapter content not found.");

            setIsLoadingData(false);
        } else {
            setGeneratedContent('');
            setPreviousChapterContent('');
            setChapterScenes([]);
            if (!activeStoryId || (activeStoryId && worldDescription !== undefined)) {
                 setIsLoadingData(false);
            }
        }
    };
    // Ensure general data is loaded before trying to load chapter data
     if (parsedChapters.length > 0 || !activeStoryId || (activeStoryId && fullOutline !== undefined)) {
        loadChapterData();
    }
  }, [selectedChapter, activeStoryId, loadDataFromApi, getChapterScenesKey, parsedChapters, fullOutline, worldDescription]);

  // Save scenes to localStorage directly
  useEffect(() => {
    if (selectedChapter && activeStoryId) {
      const scenesKey = getChapterScenesKey(selectedChapter.chapterNumber);
      // Use standard localStorage access for scenes
      const getLocalStorageScenes = (key: string, defaultValue: Scene[] | null): Scene[] | null => {
          const stored = localStorage.getItem(key);
          if (stored) { try { return JSON.parse(stored); } catch { return defaultValue; } }
          return defaultValue;
       };
      const setLocalStorageScenes = (key: string, value: Scene[]): void => { localStorage.setItem(key, JSON.stringify(value)); };

      if (chapterScenes.length > 0 || getLocalStorageScenes(scenesKey, null) !== null) {
        setLocalStorageScenes(scenesKey, chapterScenes);
      }
    }
  }, [chapterScenes, selectedChapter, activeStoryId, getChapterScenesKey]);


  // --- Chapter Generation Logic ---
  const { complete, isLoading: isGenerating, error: generationError } = useCompletion({
    api: '/api/ai-writer/chapter/generate',
    onFinish: (_, finalCompletion) => {
      setGeneratedContent(finalCompletion); // Update state only
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

  // Scene Management Functions (remain the same)
  const addScene = () => { /* ... */ };
  const updateScene = (id: string, field: 'description' | 'content', value: string) => { /* ... */ };
  const deleteScene = (id: string) => { /* ... */ };
  const handleGenerateScene = async (sceneId: string) => { /* ... */ };

  // Chapter Generation Function (remains the same)
  const handleGenerateChapter = useCallback(async () => { /* ... */ }, [/* ... */]);

  // Save and Proceed Function - Saves chapter content to DB via API
  const handleSaveAndProceed = async () => {
     if (!selectedChapter || !activeStoryId) return;
     setIsSaving(true);
     try {
       const response = await fetch('/api/story-data/chapter', { // Use chapter data API
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
             storyId: activeStoryId,
             chapterNumber: selectedChapter.chapterNumber,
             title: selectedChapter.title, // Pass title in case it needs creation
             content: generatedContent
         }),
       });
       if (!response.ok) throw new Error((await response.json()).error || 'Failed to save chapter data');
       console.log(`Chapter ${selectedChapter.chapterNumber} saved to database successfully.`);

       // Save scenes to localStorage (still using this)
       const scenesKey = getChapterScenesKey(selectedChapter.chapterNumber);
       localStorage.setItem(scenesKey, JSON.stringify(chapterScenes));

       const isLastChapter = selectedChapter.chapterNumber === parsedChapters.length;
       if (isLastChapter) {
          alert('Last chapter saved! You can now compile the full manuscript.');
          setManuscriptMdPath(null);
       } else {
         const nextChapterIndex = parsedChapters.findIndex(chap => chap.chapterNumber === selectedChapter.chapterNumber + 1);
         if (nextChapterIndex !== -1) setSelectedChapter(parsedChapters[nextChapterIndex]);
       }
     } catch (error: any) {
       console.error(`Error saving chapter ${selectedChapter.chapterNumber}:`, error);
       alert(`Error saving chapter: ${error.message}`);
     } finally {
       setIsSaving(false);
     }
  };

  // Compile Manuscript Function (remains the same)
  const handleCompile = async () => { /* ... */ };


  return (
    <StageLayout>
      {/* ... (rest of the JSX remains largely the same) ... */}
       {!activeStoryId && (
         <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-md">
           Please select or create a story from the <a href="/stories" className="font-bold underline">Stories page</a> to begin.
         </div>
       )}
       {activeStoryId && !isLoadingData && fullOutline && parsedChapters.length === 0 && (
         <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-md">
           <strong>Warning:</strong> Could not parse chapters from the outline file. Please check the outline format in Stage 3.
         </div>
       )}
       {isLoadingData && activeStoryId && (
           <div className="text-center p-10">Loading story data...</div>
       )}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 ${isLoadingData ? 'opacity-50 pointer-events-none' : ''}`}>
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
