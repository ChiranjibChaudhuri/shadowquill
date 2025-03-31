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

export default function WriteChapterPage() {
  const { activeStoryId, stories } = useStoryContext();
  const router = useRouter();

  // Context state loaded from DB
  const [worldDescription, setWorldDescription] = useState<string>('');
  const [characterProfiles, setCharacterProfiles] = useState<string>('');
  const [fullOutline, setFullOutline] = useState<string>('');
  const [mindMapData, setMindMapData] = useState<any>(null); // Added state for mind map data
  const [parsedChapters, setParsedChapters] = useState<Chapter[]>([]);

  // Chapter specific state
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string>(''); // Loaded/Saved via API
  const [previousChapterContent, setPreviousChapterContent] = useState<string>(''); // Loaded via API
  const [chapterScenes, setChapterScenes] = useState<Scene[]>([]); // Still uses localStorage

  // UI states
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCompiling, setIsCompiling] = useState<boolean>(false); // Added for compilation state

  // Redirect if no active story
  useEffect(() => {
    if (!activeStoryId) {
      router.replace('/stories');
    }
  }, [activeStoryId, router]);

  // Function to fetch data from backend API
  const loadDataFromApi = useCallback(async (endpoint: string, params: Record<string, string>, defaultValue: any = '') => {
    if (!activeStoryId) return defaultValue;
    const queryParams = new URLSearchParams({ storyId: activeStoryId, ...params }).toString();
    try {
        const response = await fetch(`${endpoint}?${queryParams}`);
        if (!response.ok) {
            if (response.status !== 404) console.error(`Error loading data from ${endpoint}: ${response.statusText}`);
            return defaultValue;
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching data from ${endpoint}:`, error);
        return defaultValue;
    }
  }, [activeStoryId]);

  // --- Outline Parsing Logic ---
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

  // Load general context from backend APIs (including Mind Map)
  useEffect(() => {
    const loadGeneralData = async () => {
      if (activeStoryId) {
        setIsLoadingData(true); // Set loading true at the start
        try {
            // Fetch world, characters, outline, and mind map data
            const [worldData, charData, outlineData, mapData] = await Promise.all([
                loadDataFromApi('/api/story-data/world', {}),
                loadDataFromApi('/api/story-data/characters', {}),
                loadDataFromApi('/api/story-data/outline', {}),
                loadDataFromApi('/api/story-data/mindmap', {}, { mindMapData: null }) // Fetch mind map data, default null
            ]);
            setWorldDescription(worldData?.description ?? '');
            setCharacterProfiles(charData?.profiles ?? '');
            setFullOutline(outlineData?.outline ?? '');
            setMindMapData(mapData?.mindMapData ?? null); // Store mind map data
            setParsedChapters(parseOutline(outlineData?.outline ?? ''));
        } catch (error) {
            console.error("Error loading general story data:", error);
            setWorldDescription(''); setCharacterProfiles(''); setFullOutline('');
            setMindMapData(null); setParsedChapters([]);
        } finally {
            // Loading state is handled later in the chapter data loading effect
            // to ensure all context is available before chapter-specific loading starts
        }
      } else {
          // Reset all state if no active story
          setWorldDescription(''); setCharacterProfiles(''); setFullOutline('');
          setMindMapData(null); setParsedChapters([]); setSelectedChapter(null);
          setIsLoadingData(false); // Stop loading if no active story
      }
    };
    loadGeneralData();
    // Dependencies now include setMindMapData
  }, [activeStoryId, loadDataFromApi, parseOutline, setMindMapData]);

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

            const getLocalStorageScenes = (key: string, defaultValue: Scene[]): Scene[] => {
                const storedData = localStorage.getItem(key);
                 if (storedData !== null) { try { return JSON.parse(storedData) as Scene[]; } catch (e) { console.error("Parse error", e); return defaultValue; } }
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
            setGeneratedContent(''); setPreviousChapterContent(''); setChapterScenes([]);
            if (!activeStoryId || (activeStoryId && fullOutline !== undefined)) {
                 setIsLoadingData(false);
            }
        }
    };
    if (parsedChapters.length > 0 || !activeStoryId || (activeStoryId && fullOutline !== undefined)) {
        loadChapterData();
    }
  }, [selectedChapter, activeStoryId, loadDataFromApi, getChapterScenesKey, parsedChapters, fullOutline]); // Removed worldDescription

  // Save scenes to localStorage directly
  useEffect(() => {
    if (selectedChapter && activeStoryId) {
      const scenesKey = getChapterScenesKey(selectedChapter.chapterNumber);
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
    onFinish: (_, finalCompletion) => { setGeneratedContent(finalCompletion); },
    onError: (err) => { console.error("Chapter generation error:", err); setGeneratedContent(`Error: ${err.message}`); }
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
    // Check for mind map data as well if needed (optional context)
    if (!worldDescription || !characterProfiles || !fullOutline) { alert('Missing required context (World, Characters, Outline).'); return; }

    setChapterScenes(prevScenes => prevScenes.map(scene =>
      scene.id === sceneId ? { ...scene, isGenerating: true, content: 'Generating...' } : scene
    ));
    const sceneIndex = chapterScenes.findIndex(s => s.id === sceneId);
    const previousContextForScene = sceneIndex > 0 ? chapterScenes[sceneIndex - 1].content : 'Start of the chapter.';

    try {
      const finalCompletion = await completeScene('', {
        body: {
          worldContext: worldDescription,
          characterContext: characterProfiles,
          outlineContext: fullOutline,
          mindMapContext: mindMapData ? JSON.stringify(mindMapData) : null, // Pass mind map data
          previousContext: previousContextForScene,
          chapterNumber: selectedChapter.chapterNumber,
          chapterTitle: selectedChapter.title,
          chapterOutline: selectedChapter.rawContent,
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
    // Check for mind map data as well (optional context)
    if (!worldDescription || !characterProfiles || !fullOutline) { alert('Missing required context (World, Characters, Outline).'); return; }
    if (chapterScenes.length === 0) { alert('Please add and generate at least one scene first.'); return; }

    const formattedScenes = chapterScenes.map((scene, index) =>
        `Scene ${index + 1} Description: ${scene.description}\nScene ${index + 1} Content:\n${scene.content}`
      ).join('\n\n---\n\n');

    await complete('', { body: {
      worldContext: worldDescription,
      characterContext: characterProfiles,
      outlineContext: fullOutline,
      mindMapContext: mindMapData ? JSON.stringify(mindMapData) : null, // Pass mind map data
      previousChapterContext: previousChapterContent,
      chapterNumber: selectedChapter.chapterNumber,
      chapterTitle: selectedChapter.title,
      chapterOutline: selectedChapter.rawContent,
      chapterScenes: formattedScenes
    }});
    // Dependencies now include mindMapData
  }, [selectedChapter, activeStoryId, worldDescription, characterProfiles, fullOutline, mindMapData, previousChapterContent, chapterScenes, complete]);

  // Save and Proceed Function - Saves chapter content to DB via API
  const handleSaveAndProceed = async () => {
     if (!selectedChapter || !activeStoryId) return;
     setIsSaving(true);
     try {
       const response = await fetch('/api/story-data/chapter', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
             storyId: activeStoryId,
             chapterNumber: selectedChapter.chapterNumber,
             title: selectedChapter.title,
             content: generatedContent
         }),
       });
       if (!response.ok) throw new Error((await response.json()).error || 'Failed to save chapter data');
       console.log(`Chapter ${selectedChapter.chapterNumber} saved to database successfully.`);

       // Save scenes to localStorage
       const scenesKey = getChapterScenesKey(selectedChapter.chapterNumber);
       localStorage.setItem(scenesKey, JSON.stringify(chapterScenes));

       const isLastChapter = selectedChapter.chapterNumber === parsedChapters.length;
       if (isLastChapter) {
          alert('Last chapter saved! Manuscript is complete (in database).');
          // No compilation UI needed here anymore
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

  // --- Compile Manuscript Function ---
  const handleCompileBook = async () => {
    if (!activeStoryId) {
      alert('No active story selected.');
      return;
    }
    setIsCompiling(true);
    try {
      // Construct the URL for the GET request
      const compileUrl = `/api/compile-book?storyId=${encodeURIComponent(activeStoryId)}`;
      // Navigate to the URL to trigger download
      window.location.href = compileUrl;
      // Note: We can't easily track download completion client-side this way.
      // The button will re-enable after a short delay.
      setTimeout(() => setIsCompiling(false), 3000); // Re-enable after 3 seconds
    } catch (error: any) {
      console.error("Error initiating book compilation:", error);
      alert(`Failed to start book compilation: ${error.message}`);
      setIsCompiling(false);
    }
  };
  // --- End Compile Manuscript Function ---

  return (
    <StageLayout>
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
           {/* Add Compile Button Below Chapter List */}
           {activeStoryId && parsedChapters.length > 0 && (
             <div className="mt-6">
                <button
                  onClick={handleCompileBook}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                  disabled={isCompiling || isLoadingData}
                  title="Compile world, characters, outline, and all chapters into a downloadable Markdown (.md) file"
                >
                  {isCompiling ? 'Compiling...' : 'Compile & Download Markdown'}
                </button>
             </div>
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

               {/* Removed Manuscript Compilation Section */}

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
