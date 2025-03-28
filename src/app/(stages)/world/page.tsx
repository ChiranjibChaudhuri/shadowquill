'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { type Message, useCompletion } from 'ai/react';
import StageLayout from '@/components/StageLayout';
import ChatInterface from '@/components/ChatInterface';

const LOCAL_STORAGE_KEYS = {
  WORLD_TOPIC: 'shadowquill_world_topic',
  WORLD_DESCRIPTION: 'shadowquill_world_description',
  WORLD_CHAT_HISTORY: 'shadowquill_world_chat_history',
};

export default function WorldBuildingPage() {
  const [topic, setTopic] = useState<string>('');
  const [worldDescription, setWorldDescription] = useState<string>('');
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  // Removed chatHistory state, ChatInterface manages its own history via localStorageKey

  // Load initial state from local storage (excluding chat history)
  useEffect(() => {
    setTopic(localStorage.getItem(LOCAL_STORAGE_KEYS.WORLD_TOPIC) || '');
    setWorldDescription(localStorage.getItem(LOCAL_STORAGE_KEYS.WORLD_DESCRIPTION) || '');
    // Chat history is loaded internally by ChatInterface
  }, []);

  // Save topic and description state to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.WORLD_TOPIC, topic);
  }, [topic]);

  useEffect(() => {
    // Only save description if it's not empty, prevents overwriting loaded data on mount
    if (worldDescription) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.WORLD_DESCRIPTION, worldDescription);
    }
  }, [worldDescription]);

  // --- Finalization Logic ---
  const { complete, completion, isLoading: isFinalizationLoading, error: finalizationError } = useCompletion({
    api: '/api/ai-writer/world/finalize',
    onFinish: (_, finalCompletion) => {
      setWorldDescription(finalCompletion);
      setIsFinalizing(false);
      // Optionally clear chat history after finalization?
      // setChatHistory([]);
      // localStorage.removeItem(LOCAL_STORAGE_KEYS.WORLD_CHAT_HISTORY);
    },
    onError: (err) => {
        console.error("Finalization error:", err);
        setIsFinalizing(false);
        // Display error to user?
    }
  });

  const handleFinalize = useCallback(async () => {
    // Read the latest chat history directly from local storage
    const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEYS.WORLD_CHAT_HISTORY);
    let historyToFinalize: Message[] = [];
    if (storedHistory) {
      try {
        historyToFinalize = JSON.parse(storedHistory);
      } catch (e) {
        console.error("Failed to parse chat history for finalization", e);
        alert("Error reading chat history. Cannot finalize.");
        return;
      }
    }

    if (historyToFinalize.length === 0) {
      alert('Chat history is empty. Please chat with the AI first.');
      return;
    }

    setIsFinalizing(true);
    // Pass the retrieved chat history and topic to the finalization API
    await complete('', { body: { messages: historyToFinalize, topic } });
  }, [topic, complete]);

  // ChatInterface now handles its own state persistence via localStorageKey

  return (
    <StageLayout> {/* Removed title prop */}
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
          />
        </div>

        <ChatInterface
          apiEndpoint="/api/ai-writer/world/chat"
          title="Brainstorm World Ideas"
          placeholder="Describe your initial world ideas or ask questions..."
          systemPromptContext={{ topic }}
          localStorageKey={LOCAL_STORAGE_KEYS.WORLD_CHAT_HISTORY} // Pass the key
          // initialMessages prop removed - component loads internally
        />

        <button
          onClick={handleFinalize} // Reads history from local storage now
          disabled={isFinalizing || isFinalizationLoading || !topic} // Also disable if no topic
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
            readOnly={isFinalizing || isFinalizationLoading}
          />
          {/* Save button for manual edits - relies on local storage */}
           <button
            onClick={() => localStorage.setItem(LOCAL_STORAGE_KEYS.WORLD_DESCRIPTION, worldDescription)}
            className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm"
          >
            Save Manual Edits
          </button>
        </div>
      </div>
    </StageLayout>
  );
}
