'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { type Message, useCompletion } from 'ai/react';
import StageLayout from '@/components/StageLayout';
import ChatInterface from '@/components/ChatInterface';
import { useStoryContext } from '@/context/StoryContext';

// Define keys for story-specific data (used for localStorage chat history key)
const STORY_DATA_KEYS = {
  WORLD_DESCRIPTION: 'world_description',
  CHARACTER_PROFILES: 'character_profiles',
  CHARACTER_CHAT_HISTORY: 'character_chat_history',
  NUM_CHARACTERS: 'num_characters',
};

// Define filenames for backend storage
const FILENAMES = {
    WORLD_DESCRIPTION: 'world.md', // Need to load this
    CHARACTER_PROFILES: 'characters.md',
    NUM_CHARACTERS: 'num_characters.txt', // Store number as text
}

export default function CharacterCreationPage() {
  const { activeStoryId, getStoryData, setStoryData } = useStoryContext(); // Keep set/get for chat history
  const router = useRouter();

  const [worldDescription, setWorldDescription] = useState<string>('');
  const [characterProfiles, setCharacterProfiles] = useState<string>('');
  const [numCharacters, setNumCharacters] = useState<number>(3);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

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

  // Load initial state from backend files
  useEffect(() => {
    const loadInitialData = async () => {
      if (activeStoryId) {
        setIsLoadingData(true);
        const [loadedWorld, loadedProfiles, loadedNumCharsStr] = await Promise.all([
            loadDataFromFile(FILENAMES.WORLD_DESCRIPTION),
            loadDataFromFile(FILENAMES.CHARACTER_PROFILES),
            loadDataFromFile(FILENAMES.NUM_CHARACTERS, '3') // Default to '3' if file not found
        ]);
        setWorldDescription(loadedWorld);
        setCharacterProfiles(loadedProfiles);
        setNumCharacters(parseInt(loadedNumCharsStr, 10) || 3); // Parse number, default to 3 on error
        setIsLoadingData(false);
      } else {
          setWorldDescription('');
          setCharacterProfiles('');
          setNumCharacters(3);
          setIsLoadingData(false);
      }
    };
    loadInitialData();
  }, [activeStoryId, loadDataFromFile]);

  // --- Finalization Logic ---
  const { complete, isLoading: isFinalizationLoading, error: finalizationError } = useCompletion({
    api: '/api/ai-writer/characters/finalize',
    onFinish: (_, finalCompletion) => {
       setCharacterProfiles(finalCompletion); // Update state, save happens on proceed
       setIsFinalizing(false);
    },
    onError: (err) => {
        console.error("Character finalization error:", err);
        setIsFinalizing(false);
    }
  });

  const handleFinalize = useCallback(async () => {
    if (!activeStoryId) return;
    const chatHistoryKey = `shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.CHARACTER_CHAT_HISTORY}`;
    const historyToFinalize = getStoryData<Message[]>(activeStoryId, chatHistoryKey, []);

    if (historyToFinalize.length === 0) { alert('Chat history is empty.'); return; }
    if (!worldDescription) { alert('World Description is missing.'); return; }

    setIsFinalizing(true);
    await complete('', { body: {
        messages: historyToFinalize,
        worldContext: worldDescription,
        numCharacters: numCharacters
    }});
  }, [activeStoryId, worldDescription, numCharacters, complete, getStoryData]);

  // Save & Proceed Handler
  const handleSaveAndProceed = async () => {
      if (!activeStoryId) return;
      setIsSaving(true);
      try {
        const savePromises = [
          fetch('/api/save-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storyId: activeStoryId, filename: FILENAMES.CHARACTER_PROFILES, content: characterProfiles }),
          }),
           fetch('/api/save-file', { // Save num characters as well
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storyId: activeStoryId, filename: FILENAMES.NUM_CHARACTERS, content: String(numCharacters) }),
          })
        ];
        const responses = await Promise.all(savePromises);
        for (const response of responses) {
            if (!response.ok) throw new Error((await response.json()).error || 'Failed to save one or more files');
        }
        console.log('Character profiles and count saved to files successfully.');
        router.push('/outline');
      } catch (error: any) {
        console.error('Error saving character data files:', error);
        alert(`Error saving files: ${error.message}`);
      } finally {
        setIsSaving(false);
      }
    };

  if (isLoadingData && activeStoryId) {
      return <StageLayout><div>Loading story data...</div></StageLayout>;
  }

  return (
    <StageLayout>
       {!worldDescription && activeStoryId && (
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
              disabled={!activeStoryId || isSaving || isFinalizing}
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
            disabled={!activeStoryId || isFinalizing || isFinalizationLoading || !worldDescription}
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
          <textarea
            value={isFinalizing || isFinalizationLoading ? 'Generating...' : characterProfiles}
            onChange={(e) => setCharacterProfiles(e.target.value)}
            placeholder="The finalized character profiles will appear here after generation..."
            rows={25}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white whitespace-pre-wrap"
            readOnly={!activeStoryId || isFinalizing || isFinalizationLoading || isSaving}
          />
           <button
            onClick={handleSaveAndProceed} // Use new handler
            className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            disabled={!activeStoryId || isSaving || isFinalizing || isFinalizationLoading || !characterProfiles}
          >
            {isSaving ? 'Saving...' : 'Save & Proceed to Outline'}
          </button>
        </div>
      </div>
    </StageLayout>
  );
}
