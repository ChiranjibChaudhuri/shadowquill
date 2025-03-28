'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { type Message, useCompletion } from 'ai/react';
import StageLayout from '@/components/StageLayout';
import ChatInterface from '@/components/ChatInterface';

// Reuse world keys and add character-specific keys
const LOCAL_STORAGE_KEYS = {
  WORLD_DESCRIPTION: 'shadowquill_world_description',
  CHARACTER_PROFILES: 'shadowquill_character_profiles',
  CHARACTER_CHAT_HISTORY: 'shadowquill_character_chat_history',
  NUM_CHARACTERS: 'shadowquill_num_characters',
};

export default function CharacterCreationPage() {
  const [worldDescription, setWorldDescription] = useState<string>('');
  const [characterProfiles, setCharacterProfiles] = useState<string>('');
  const [numCharacters, setNumCharacters] = useState<number>(3);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  // Chat history is managed by ChatInterface via its localStorageKey

  // Load initial state from local storage
  useEffect(() => {
    setWorldDescription(localStorage.getItem(LOCAL_STORAGE_KEYS.WORLD_DESCRIPTION) || '');
    setCharacterProfiles(localStorage.getItem(LOCAL_STORAGE_KEYS.CHARACTER_PROFILES) || '');
    setNumCharacters(parseInt(localStorage.getItem(LOCAL_STORAGE_KEYS.NUM_CHARACTERS) || '3', 10));
  }, []);

  // Save state to local storage whenever it changes
  useEffect(() => {
    // Only save if not empty to avoid overwriting on initial load
    if (characterProfiles) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.CHARACTER_PROFILES, characterProfiles);
    }
  }, [characterProfiles]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.NUM_CHARACTERS, String(numCharacters));
  }, [numCharacters]);


  // --- Finalization Logic ---
  const { complete, completion, isLoading: isFinalizationLoading, error: finalizationError } = useCompletion({
    api: '/api/ai-writer/characters/finalize',
    onFinish: (_, finalCompletion) => {
      setCharacterProfiles(finalCompletion);
      setIsFinalizing(false);
    },
    onError: (err) => {
        console.error("Character finalization error:", err);
        setIsFinalizing(false);
    }
  });

  const handleFinalize = useCallback(async () => {
    // Read the latest chat history directly from local storage
    const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEYS.CHARACTER_CHAT_HISTORY);
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
    if (!worldDescription) {
        alert('World Description is missing. Please complete Stage 1 first.');
        return;
    }

    setIsFinalizing(true);
    // Pass the retrieved chat history, world context, and num chars to the API
    await complete('', { body: {
        messages: historyToFinalize,
        worldContext: worldDescription,
        numCharacters: numCharacters
    }});
  }, [worldDescription, numCharacters, complete]);


  return (
    <StageLayout> {/* Removed title prop */}
       {!worldDescription && (
         <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-md">
           <strong>Warning:</strong> World Description not found. Please complete Stage 1 first or ensure it's saved in local storage. Character generation requires world context.
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
              onChange={(e) => setNumCharacters(Math.max(1, parseInt(e.target.value, 10) || 1))} // Ensure positive integer
              min="1"
              className="w-20 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <ChatInterface
            apiEndpoint="/api/ai-writer/characters/chat"
            title="Brainstorm Characters"
            placeholder="Describe character ideas or ask for suggestions..."
            systemPromptContext={{ worldContext: worldDescription }} // Pass world context
            localStorageKey={LOCAL_STORAGE_KEYS.CHARACTER_CHAT_HISTORY}
          />

          <button
            onClick={handleFinalize}
            disabled={isFinalizing || isFinalizationLoading || !worldDescription}
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
            readOnly={isFinalizing || isFinalizationLoading}
          />
           <button
            onClick={() => localStorage.setItem(LOCAL_STORAGE_KEYS.CHARACTER_PROFILES, characterProfiles)}
            className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm"
          >
            Save Manual Edits
          </button>
        </div>
      </div>
    </StageLayout>
  );
}
