'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { type Message, useCompletion } from 'ai/react';
import StageLayout from '@/components/StageLayout';
import ChatInterface from '@/components/ChatInterface';
import { useStoryContext } from '@/context/StoryContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// Define keys for story-specific data (used for localStorage chat history key)
const STORY_DATA_KEYS = {
  CHARACTER_CHAT_HISTORY: 'character_chat_history',
};

export default function CharacterCreationPage() {
  const { activeStoryId } = useStoryContext();
  const router = useRouter();

  const [worldDescription, setWorldDescription] = useState<string>(''); // Still needed for context
  const [characterProfiles, setCharacterProfiles] = useState<string>('');
  const [numCharacters, setNumCharacters] = useState<number>(3);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load initial state from DB via API
  useEffect(() => {
    const loadInitialData = async () => {
      if (activeStoryId) {
        setIsLoadingData(true);
        try {
          // Fetch world description (needed for chat context) via API
           const worldResponse = await fetch(`/api/story-data/world?storyId=${encodeURIComponent(activeStoryId)}`);
           if (worldResponse.ok) {
               const worldData = await worldResponse.json();
               setWorldDescription(worldData.description ?? '');
           } else if (worldResponse.status !== 404) {
               console.error(`Error loading world description: ${worldResponse.statusText}`);
           }

          // Fetch character data via API
          const response = await fetch(`/api/story-data/characters?storyId=${encodeURIComponent(activeStoryId)}`);
          if (!response.ok) {
            if (response.status === 404) { // Story exists but no character data yet
              setCharacterProfiles('');
              setNumCharacters(3);
            } else {
              throw new Error(`Failed to fetch character data: ${response.statusText}`);
            }
          } else {
            const data = await response.json();
            setCharacterProfiles(data.profiles ?? '');
            setNumCharacters(data.numCharacters ?? 3);
          }
        } catch (error) {
            console.error("Error loading character page data:", error);
            // Reset state on error?
            setWorldDescription('');
            setCharacterProfiles('');
            setNumCharacters(3);
        } finally {
            setIsLoadingData(false);
        }
      } else {
          setWorldDescription('');
          setCharacterProfiles('');
          setNumCharacters(3);
          setIsLoadingData(false);
      }
    };
    loadInitialData();
  }, [activeStoryId]); // Removed loadDataFromFile dependency

  // --- Finalization Logic ---
  const { complete, isLoading: isFinalizationLoading, error: finalizationError } = useCompletion({
    api: '/api/ai-writer/characters/finalize',
    onFinish: (_, finalCompletion) => {
       setCharacterProfiles(finalCompletion); // Update state only
       setIsFinalizing(false);
    },
    onError: (err) => {
        console.error("Character finalization error:", err);
        setIsFinalizing(false);
    }
  });

  const handleFinalize = useCallback(async () => {
    if (!activeStoryId) return;
    // Read chat history directly from localStorage
    const chatHistoryKey = `shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.CHARACTER_CHAT_HISTORY}`;
    let historyToFinalize: Message[] = [];
    const storedHistory = localStorage.getItem(chatHistoryKey);
     if (storedHistory) {
       try { historyToFinalize = JSON.parse(storedHistory); } catch (e) { console.error("Failed to parse chat history", e); }
     }

    if (historyToFinalize.length === 0) { alert('Chat history is empty.'); return; }
    if (!worldDescription) { alert('World Description context is missing.'); return; }

    setIsFinalizing(true);
    await complete('', { body: {
        messages: historyToFinalize,
        worldContext: worldDescription,
        numCharacters: numCharacters
    }});
  }, [activeStoryId, worldDescription, numCharacters, complete]);

  // Save & Proceed Handler - Saves to DB via API
  const handleSaveAndProceed = async () => {
      if (!activeStoryId) return;
      setIsSaving(true);
      try {
        const response = await fetch('/api/story-data/characters', { // Use DB API
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storyId: activeStoryId,
                profiles: characterProfiles,
                numCharacters: numCharacters
            }),
        });

        if (!response.ok) {
            throw new Error((await response.json()).error || 'Failed to save character data');
        }

        console.log('Character data saved to database successfully.');
        router.push('/outline');
      } catch (error: unknown) { // Use unknown
        console.error('Error saving character data:', error);
        // Type check for error message
        const message = error instanceof Error ? error.message : String(error);
        alert(`Error saving character data: ${message}`);
      } finally {
        setIsSaving(false);
      }
    };

  // Download Word-format document of final character profiles
  const handleDownloadCharacters = () => {
    const element = document.getElementById('charactersPreview');
    if (!element) return;
    const html = element.innerHTML;
    const header = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Character Profiles</title></head><body>';
    const footer = '</body></html>';
    const source = header + html + footer;
    const blob = new Blob(['\ufeff', source], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'character_profiles.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Edit mode toggle
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  if (isLoadingData && activeStoryId) {
      return <StageLayout><div>Loading story data...</div></StageLayout>;
  }

  return (
    <StageLayout>
       {!worldDescription && activeStoryId && !isLoadingData && (
         <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-md">
           <strong>Warning:</strong> World Description not found for this story. Please complete Stage 1 first.
         </div>
       )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side: Chat and Controls */}
        <div>
           <div className="mb-4">
            <label htmlFor="numChars" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number of Characters to Generate:
            </label>
            <input
              type="number"
              id="numChars"
              value={numCharacters}
              onChange={(e) => setNumCharacters(Math.max(1, parseInt(e.target.value, 10) || 1))}
              min="1"
              className="w-20 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={!activeStoryId || isSaving || isFinalizing || isLoadingData}
            />
          </div>

          {activeStoryId && (
            <ChatInterface
              apiEndpoint="/api/ai-writer/characters/chat"
              title="Brainstorm Characters"
              placeholder="Describe character ideas or ask for suggestions..."
              systemPromptContext={{ worldContext: worldDescription }}
              localStorageKey={`shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.CHARACTER_CHAT_HISTORY}`}
              storyId={activeStoryId}
            />
          )}

          <button
            onClick={handleFinalize}
            disabled={!activeStoryId || isFinalizing || isFinalizationLoading || !worldDescription || isLoadingData}
            className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {isFinalizing || isFinalizationLoading ? 'Finalizing...' : `Finalize ${numCharacters} Character Profiles`}
          </button>
           {finalizationError && (
             <p className="text-red-500 mt-2">Error finalizing: {finalizationError.message}</p>
           )}
        </div>

        {/* Right Side: Finalized Profiles */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Final Character Profiles</h2>
          <div className="flex space-x-2 mb-2">
            <button onClick={() => setIsEditMode(prev => !prev)} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded">
              {isEditMode ? 'Preview' : 'Edit'}
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto mb-4">
            {isEditMode ? (
              <textarea
                value={characterProfiles}
                onChange={(e) => setCharacterProfiles(e.target.value)}
                rows={25}
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white whitespace-pre-wrap"
                disabled={isFinalizing || isFinalizationLoading || isSaving || isLoadingData}
              />
            ) : isFinalizing || isFinalizationLoading ? (
              <div className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">Generating...</div>
            ) : (
              <div id="charactersPreview" className="prose dark:prose-dark max-w-none whitespace-pre-wrap">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{characterProfiles}</ReactMarkdown>
              </div>
            )}
          </div>
          <button
            onClick={handleSaveAndProceed}
            className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            disabled={!activeStoryId || isSaving || isFinalizing || isFinalizationLoading || !characterProfiles || isLoadingData}
          >
            {isSaving ? 'Saving...' : 'Save & Proceed to Outline'}
          </button>
          <button
            onClick={handleDownloadCharacters}
            className="mt-2 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
            disabled={!characterProfiles}
          >
            Download .doc
          </button>
        </div>
      </div>
    </StageLayout>
  );
}
