'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { type Message, useCompletion } from 'ai/react';
import StageLayout from '@/components/StageLayout';
import ChatInterface from '@/components/ChatInterface';
import { useStoryContext } from '@/context/StoryContext';

// Define keys for story-specific data (used for localStorage chat history key)
const STORY_DATA_KEYS = {
  WORLD_TOPIC: 'world_topic',
  WORLD_DESCRIPTION: 'world_description',
  WORLD_CHAT_HISTORY: 'world_chat_history',
};

// Define filenames for backend storage
const FILENAMES = {
    WORLD_TOPIC: 'topic.txt', // Simple text file for topic
    WORLD_DESCRIPTION: 'world.md',
}

export default function WorldBuildingPage() {
  const { activeStoryId, setStoryData, getStoryData } = useStoryContext(); // Keep set/get for chat history for now
  const router = useRouter();

  const [topic, setTopic] = useState<string>('');
  const [worldDescription, setWorldDescription] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true); // Loading state
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
            // If file not found (404), return default. Otherwise, log error.
            if (response.status !== 404) {
                 console.error(`Error loading ${filename}: ${response.statusText}`);
            }
            return defaultValue;
        }
        const data = await response.json();
        return data.content || defaultValue;
    } catch (error) {
        console.error(`Error fetching ${filename}:`, error);
        return defaultValue;
    }
  }, [activeStoryId]);

  // Load initial state from backend files when activeStoryId is available
  useEffect(() => {
    const loadInitialData = async () => {
      if (activeStoryId) {
        setIsLoadingData(true);
        const [loadedTopic, loadedDescription] = await Promise.all([
            loadDataFromFile(FILENAMES.WORLD_TOPIC),
            loadDataFromFile(FILENAMES.WORLD_DESCRIPTION)
        ]);
        setTopic(loadedTopic);
        setWorldDescription(loadedDescription);
        setIsLoadingData(false);
        // Chat history still loaded by ChatInterface via localStorageKey for now
      } else {
          // Clear state if no active story
          setTopic('');
          setWorldDescription('');
          setIsLoadingData(false);
      }
    };
    loadInitialData();
  }, [activeStoryId, loadDataFromFile]);

  // --- We no longer save directly to context/localStorage on change ---
  // --- Saving now happens explicitly via the "Save & Proceed" button ---

  // --- Finalization Logic ---
  const { complete, isLoading: isFinalizationLoading, error: finalizationError } = useCompletion({
    api: '/api/ai-writer/world/finalize',
    onFinish: (_, finalCompletion) => {
      // Update state, but don't automatically save here. User must click Save & Proceed.
      setWorldDescription(finalCompletion);
      setIsFinalizing(false);
    },
    onError: (err) => {
        console.error("Finalization error:", err);
        setIsFinalizing(false);
    }
  });

  const handleFinalize = useCallback(async () => {
    if (!activeStoryId) return;
    // Read chat history from localStorage via context helper (temporary)
    const chatHistoryKey = `shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.WORLD_CHAT_HISTORY}`;
    const historyToFinalize = getStoryData<Message[]>(activeStoryId, chatHistoryKey, []); // Using getStoryData as a proxy for localStorage access

    if (historyToFinalize.length === 0) {
      alert('Chat history is empty. Please chat with the AI first.');
      return;
    }
    if (!topic.trim()) {
        alert('Please enter a topic/genre first.');
        return;
    }

    setIsFinalizing(true);
    await complete('', { body: { messages: historyToFinalize, topic } });
  }, [activeStoryId, topic, complete, getStoryData]); // Added getStoryData dependency

  // Save & Proceed Handler
  const handleSaveAndProceed = async () => {
      if (!activeStoryId) return;
      setIsSaving(true);
      try {
        // Save Topic and Description to files
        const savePromises = [
          fetch('/api/save-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storyId: activeStoryId, filename: FILENAMES.WORLD_TOPIC, content: topic }),
          }),
          fetch('/api/save-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storyId: activeStoryId, filename: FILENAMES.WORLD_DESCRIPTION, content: worldDescription }),
          })
        ];

        const responses = await Promise.all(savePromises);

        for (const response of responses) {
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save one or more files');
            }
        }

        console.log('World topic and description saved to files successfully.');
        // Navigate to next stage
        router.push('/characters');
      } catch (error: any) {
        console.error('Error saving world data files:', error);
        alert(`Error saving files: ${error.message}`);
      } finally {
        setIsSaving(false);
      }
    };

  // Display loading indicator
  if (isLoadingData && activeStoryId) {
      return <StageLayout><div>Loading story data...</div></StageLayout>;
  }

  return (
    <StageLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side: Chat and Controls */}
        <div>
          <div className="mb-4">
            <label htmlFor="topic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Book Topic/Genre:
            </label>
            <input
              type="text"
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., High Fantasy Adventure, Sci-Fi Space Opera"
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={!activeStoryId || isSaving || isFinalizing}
            />
          </div>

          {activeStoryId && (
            <ChatInterface
              apiEndpoint="/api/ai-writer/world/chat"
              title="Brainstorm World Ideas"
              placeholder="Describe your initial world ideas or ask questions..."
              systemPromptContext={{ topic }}
              // Chat history still uses localStorage directly via this key
              localStorageKey={`shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.WORLD_CHAT_HISTORY}`}
              storyId={activeStoryId}
            />
          )}

          <button
            onClick={handleFinalize}
            disabled={!activeStoryId || isFinalizing || isFinalizationLoading || !topic.trim()}
            className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {isFinalizing || isFinalizationLoading ? 'Finalizing...' : 'Finalize World Description'}
          </button>
           {finalizationError && (
             <p className="text-red-500 mt-2">Error finalizing: {finalizationError.message}</p>
           )}
        </div>

        {/* Right Side: Finalized Description */}
        <div>
          <h2 className="text-xl font-semibold mb-2">Final World Description</h2>
          <textarea
            value={isFinalizing || isFinalizationLoading ? 'Generating...' : worldDescription}
            onChange={(e) => setWorldDescription(e.target.value)}
            placeholder="The finalized world description will appear here after generation..."
            rows={25}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white whitespace-pre-wrap"
            readOnly={!activeStoryId || isFinalizing || isFinalizationLoading || isSaving}
          />
           <button
            onClick={handleSaveAndProceed} // Use the new handler
            className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            disabled={!activeStoryId || isSaving || isFinalizing || isFinalizationLoading || !worldDescription}
          >
            {isSaving ? 'Saving...' : 'Save & Proceed to Characters'}
          </button>
        </div>
      </div>
    </StageLayout>
  );
}
