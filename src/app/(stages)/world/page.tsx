'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { type Message, useCompletion } from 'ai/react';
import StageLayout from '@/components/StageLayout';
import ChatInterface from '@/components/ChatInterface';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useStoryContext } from '@/context/StoryContext';

// Define keys for story-specific data (used for localStorage chat history key)
const STORY_DATA_KEYS = {
  WORLD_CHAT_HISTORY: 'world_chat_history',
};

export default function WorldBuildingPage() {
  const { activeStoryId } = useStoryContext();
  const router = useRouter();

  const [topic, setTopic] = useState<string>('');
  const [worldDescription, setWorldDescription] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Edit mode state for preview/edit toggle
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Redirect if no active story
  useEffect(() => {
    if (!activeStoryId) {
      router.replace('/stories');
    }
  }, [activeStoryId, router]);

  // Load initial state from DB via API
  useEffect(() => {
    const loadInitialData = async () => {
      if (activeStoryId) {
        setIsLoadingData(true);
        try {
          const response = await fetch(`/api/story-data/world?storyId=${encodeURIComponent(activeStoryId)}`);
          if (!response.ok) {
            if (response.status === 404) { // Story exists but no world data yet
              setTopic('');
              setWorldDescription('');
            } else {
              throw new Error(`Failed to fetch world data: ${response.statusText}`);
            }
          } else {
            const data = await response.json();
            setTopic(data.topic ?? '');
            setWorldDescription(data.description ?? '');
          }
        } catch (error) {
            console.error("Error loading world data:", error);
            // Optionally show error to user
        } finally {
            setIsLoadingData(false);
        }
      } else {
          setTopic('');
          setWorldDescription('');
          setIsLoadingData(false);
      }
    };
    loadInitialData();
  }, [activeStoryId]); // Depend only on activeStoryId

  // --- Finalization Logic ---
  const { complete, isLoading: isFinalizationLoading, error: finalizationError } = useCompletion({
    api: '/api/ai-writer/world/finalize',
    onFinish: (_, finalCompletion) => {
      setWorldDescription(finalCompletion); // Update state only
      setIsFinalizing(false);
    },
    onError: (err) => {
        console.error("Finalization error:", err);
        setIsFinalizing(false);
    }
  });

  const handleFinalize = useCallback(async () => {
    if (!activeStoryId) return;
    // Read chat history directly from localStorage
    const chatHistoryKey = `shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.WORLD_CHAT_HISTORY}`;
    let historyToFinalize: Message[] = [];
    const storedHistory = localStorage.getItem(chatHistoryKey);
     if (storedHistory) {
       try { historyToFinalize = JSON.parse(storedHistory); } catch (e) { console.error("Failed to parse chat history", e); }
     }

    if (historyToFinalize.length === 0) { alert('Chat history is empty.'); return; }
    if (!topic.trim()) { alert('Please enter a topic/genre first.'); return; }

    setIsFinalizing(true);
    await complete('', { body: { messages: historyToFinalize, topic } });
  }, [activeStoryId, topic, complete]);

  // Save & Proceed Handler - Now saves to DB via API
  const handleSaveAndProceed = async () => {
      if (!activeStoryId) return;
      setIsSaving(true);
      try {
        const response = await fetch('/api/story-data/world', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storyId: activeStoryId,
                topic: topic,
                description: worldDescription
            }),
        });

        if (!response.ok) {
            throw new Error((await response.json()).error || 'Failed to save world data');
        }

        console.log('World data saved to database successfully.');
        router.push('/characters');
      } catch (error: any) {
        console.error('Error saving world data:', error);
        alert(`Error saving world data: ${error.message}`);
      } finally {
        setIsSaving(false);
      }
    };

  // Download Word-format document of final world description
  const handleDownloadWorld = () => {
    const element = document.getElementById('worldPreview');
    if (!element) return;
    const html = element.innerHTML;
    const header = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>World Description</title></head><body>';
    const footer = '</body></html>';
    const source = header + html + footer;
    const blob = new Blob(['\ufeff', source], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'world_description.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
              disabled={!activeStoryId || isSaving || isFinalizing || isLoadingData}
            />
          </div>

          {activeStoryId && (
            <ChatInterface
              apiEndpoint="/api/ai-writer/world/chat"
              title="Brainstorm World Ideas"
              placeholder="Describe your initial world ideas or ask questions..."
              systemPromptContext={{ topic }}
              localStorageKey={`shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.WORLD_CHAT_HISTORY}`}
              storyId={activeStoryId}
            />
          )}

          <button
            onClick={handleFinalize}
            disabled={!activeStoryId || isFinalizing || isFinalizationLoading || !topic.trim() || isLoadingData}
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
          <div className="flex space-x-2 mb-2">
            <button onClick={() => setIsEditMode(prev => !prev)} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded">
              {isEditMode ? 'Preview' : 'Edit'}
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto mb-4">
            {isEditMode ? (
              <textarea
                value={worldDescription}
                onChange={(e) => setWorldDescription(e.target.value)}
                rows={25}
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white whitespace-pre-wrap"
                disabled={isFinalizing || isFinalizationLoading || isSaving || isLoadingData}
              />
            ) : isFinalizing || isFinalizationLoading ? (
              <div className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">Generating...</div>
            ) : (
              <div id="worldPreview" className="prose dark:prose-dark max-w-none whitespace-pre-wrap">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {worldDescription}
                </ReactMarkdown>
              </div>
            )}
          </div>
          <button
            onClick={handleSaveAndProceed}
            className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            disabled={!activeStoryId || isSaving || isFinalizing || isFinalizationLoading || !worldDescription || isLoadingData}
          >
            {isSaving ? 'Saving...' : 'Save & Proceed to Characters'}
          </button>
          <button
            onClick={handleDownloadWorld}
            className="mt-2 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
            disabled={!worldDescription}
          >
            Download .doc
          </button>
        </div>
      </div>
    </StageLayout>
  );
}
