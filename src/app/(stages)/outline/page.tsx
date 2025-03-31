'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { type Message, useCompletion } from 'ai/react';
import StageLayout from '@/components/StageLayout';
import ChatInterface from '@/components/ChatInterface';
import { useStoryContext } from '@/context/StoryContext';

// Define keys for story-specific data (used for localStorage chat history key)
const STORY_DATA_KEYS = {
  OUTLINE_CHAT_HISTORY: 'outline_chat_history',
};

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

export default function OutlineCreationPage() {
  const { activeStoryId } = useStoryContext();
  const router = useRouter();

  const [worldDescription, setWorldDescription] = useState<string>('');
  const [characterProfiles, setCharacterProfiles] = useState<string>('');
  const [outline, setOutline] = useState<string>('');
  const [numChapters, setNumChapters] = useState<number>(10);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [parsedChapters, setParsedChapters] = useState<Chapter[]>([]);

  // Redirect if no active story
  useEffect(() => {
    if (!activeStoryId) {
      router.replace('/stories');
    }
  }, [activeStoryId, router]);

  // --- Parsing Logic ---
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

  // Load initial state from DB via API
  useEffect(() => {
    const loadInitialData = async () => {
      if (activeStoryId) {
        setIsLoadingData(true);
        try {
          // Fetch world, characters, and outline data
          const [worldData, charData, outlineData] = await Promise.all([
            fetch(`/api/story-data/world?storyId=${encodeURIComponent(activeStoryId)}`).then(res => res.ok ? res.json() : { description: '' }),
            fetch(`/api/story-data/characters?storyId=${encodeURIComponent(activeStoryId)}`).then(res => res.ok ? res.json() : { profiles: '' }),
            fetch(`/api/story-data/outline?storyId=${encodeURIComponent(activeStoryId)}`).then(res => res.ok ? res.json() : { outline: '', numChapters: 10 })
          ]);

          setWorldDescription(worldData.description ?? '');
          setCharacterProfiles(charData.profiles ?? '');
          setOutline(outlineData.outline ?? '');
          setNumChapters(outlineData.numChapters ?? 10);
          setParsedChapters(parseOutline(outlineData.outline ?? ''));

        } catch (error) {
            console.error("Error loading outline page data:", error);
            setWorldDescription('');
            setCharacterProfiles('');
            setOutline('');
            setNumChapters(10);
            setParsedChapters([]);
        } finally {
            setIsLoadingData(false);
        }
      } else {
          setWorldDescription('');
          setCharacterProfiles('');
          setOutline('');
          setNumChapters(10);
          setParsedChapters([]);
          setIsLoadingData(false);
      }
    };
    loadInitialData();
  }, [activeStoryId, parseOutline]); // Removed loadDataFromFile

  // Re-parse outline whenever outline text changes
  useEffect(() => {
    const chapters = parseOutline(outline);
    setParsedChapters(chapters);
  }, [outline, parseOutline]);

  // --- Finalization Logic ---
  const { complete, isLoading: isFinalizationLoading, error: finalizationError } = useCompletion({
    api: '/api/ai-writer/outline/generate',
    onFinish: (_, finalCompletion) => {
      setOutline(finalCompletion); // Update state, useEffect above handles parsing
      setIsFinalizing(false);
    },
    onError: (err) => {
        console.error("Outline finalization error:", err);
        setIsFinalizing(false);
    }
  });

  const handleFinalize = useCallback(async () => {
    if (!activeStoryId) return;
    // Read chat history directly from localStorage
    const chatHistoryKey = `shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.OUTLINE_CHAT_HISTORY}`;
    let historyToFinalize: Message[] = [];
    const storedHistory = localStorage.getItem(chatHistoryKey);
     if (storedHistory) {
       try { historyToFinalize = JSON.parse(storedHistory); } catch (e) { console.error("Failed to parse chat history", e); }
     }

    if (historyToFinalize.length === 0) { alert('Chat history is empty.'); return; }
    if (!worldDescription || !characterProfiles) { alert('World/Character context missing.'); return; }

    setIsFinalizing(true);
    await complete('', { body: {
        messages: historyToFinalize, worldContext: worldDescription,
        characterContext: characterProfiles, numChapters: numChapters
    }});
  }, [activeStoryId, worldDescription, characterProfiles, numChapters, complete]);

  // Save & Proceed Handler - Saves to DB via API
  const handleSaveAndProceed = async () => {
      if (!activeStoryId) return;
      setIsSaving(true);
      try {
        const response = await fetch('/api/story-data/outline', { // Use DB API
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storyId: activeStoryId,
                outline: outline,
                numChapters: numChapters
            }),
        });

        if (!response.ok) {
            throw new Error((await response.json()).error || 'Failed to save outline data');
        }

        console.log('Outline data saved to database successfully.');
        router.push('/write');
      } catch (error: any) {
        console.error('Error saving outline data:', error);
        alert(`Error saving outline data: ${error.message}`);
      } finally {
        setIsSaving(false);
      }
    };

  if (isLoadingData && activeStoryId) {
      return <StageLayout><div>Loading story data...</div></StageLayout>;
  }

  return (
    <StageLayout>
       {(!worldDescription || !characterProfiles) && activeStoryId && !isLoadingData && (
         <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-md">
           <strong>Warning:</strong> World or Character context missing for this story. Please complete previous stages.
         </div>
       )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side: Chat and Controls */}
        <div>
           <div className="mb-4">
            <label htmlFor="numChapters" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Number of Chapters:
            </label>
            <input
              type="number"
              id="numChapters"
              value={numChapters}
              onChange={(e) => setNumChapters(Math.max(1, parseInt(e.target.value, 10) || 1))}
              min="1"
              className="w-20 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={!activeStoryId || isSaving || isFinalizing || isLoadingData}
            />
          </div>

          {activeStoryId && (
            <ChatInterface
              apiEndpoint="/api/ai-writer/outline/chat"
              title="Brainstorm Outline"
              placeholder="Discuss plot points, character arcs, and structure..."
              systemPromptContext={{
                  worldContext: worldDescription,
                  characterContext: characterProfiles,
                  numChapters: numChapters
              }}
              localStorageKey={`shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.OUTLINE_CHAT_HISTORY}`}
              storyId={activeStoryId}
            />
          )}

          <button
            onClick={handleFinalize}
            disabled={!activeStoryId || isFinalizing || isFinalizationLoading || !worldDescription || !characterProfiles || isLoadingData}
            className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {isFinalizing || isFinalizationLoading ? 'Finalizing...' : `Finalize ${numChapters}-Chapter Outline`}
          </button>
           {finalizationError && (
             <p className="text-red-500 mt-2">Error finalizing: {finalizationError.message}</p>
           )}
        </div>

        {/* Right Side: Finalized Outline */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Final Book Outline</h2>
          <textarea
            value={isFinalizing || isFinalizationLoading ? 'Generating...' : outline}
            onChange={(e) => setOutline(e.target.value)}
            placeholder="The finalized book outline will appear here after generation..."
            rows={25}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white whitespace-pre-wrap"
            readOnly={!activeStoryId || isFinalizing || isFinalizationLoading || isSaving || isLoadingData}
          />
           <button
            onClick={handleSaveAndProceed}
            className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            disabled={!activeStoryId || isSaving || isFinalizing || isFinalizationLoading || !outline || parsedChapters.length === 0 || isLoadingData}
          >
            {isSaving ? 'Saving...' : 'Save & Proceed to Write'}
          </button>
          {/* Display Parsed Chapters */}
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded max-h-60 overflow-y-auto">
            <h3 className="font-semibold mb-2">Parsed Chapters ({parsedChapters.length})</h3>
            {parsedChapters.length > 0 ? (
                <ul className="list-disc list-inside text-sm space-y-1">
                    {parsedChapters.map(ch => <li key={ch.chapterNumber}>Ch {ch.chapterNumber}: {ch.title}</li>)}
                </ul>
            ) : (
                <p className="text-sm text-gray-500">{isLoadingData ? 'Loading...' : 'No chapters parsed yet.'}</p>
            )}
          </div>
        </div>
      </div>
    </StageLayout>
  );
}
