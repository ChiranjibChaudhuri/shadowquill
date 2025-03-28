'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { type Message, useCompletion } from 'ai/react';
import StageLayout from '@/components/StageLayout';
import ChatInterface from '@/components/ChatInterface';

// Reuse keys and add outline-specific keys
const LOCAL_STORAGE_KEYS = {
  WORLD_DESCRIPTION: 'shadowquill_world_description',
  CHARACTER_PROFILES: 'shadowquill_character_profiles',
  OUTLINE: 'shadowquill_outline',
  OUTLINE_CHAT_HISTORY: 'shadowquill_outline_chat_history',
  NUM_CHAPTERS: 'shadowquill_num_chapters',
  PARSED_CHAPTERS: 'shadowquill_parsed_chapters', // New key for parsed structure
};

// Define structure for parsed chapters
interface Chapter {
  chapterNumber: number;
  title: string;
  // Add fields based on the outlineFinalizerSystemPrompt structure
  summary?: string;
  keyEvents?: string[];
  characterDevelopment?: string[];
  setting?: string;
  themes?: string;
  setup?: string;
  endingHook?: string;
  // Store the raw markdown section for context if needed later
  rawContent: string;
}

export default function OutlineCreationPage() {
  const [worldDescription, setWorldDescription] = useState<string>('');
  const [characterProfiles, setCharacterProfiles] = useState<string>('');
  const [outline, setOutline] = useState<string>('');
  const [numChapters, setNumChapters] = useState<number>(10);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [parsedChapters, setParsedChapters] = useState<Chapter[]>([]);
  // Chat history managed by ChatInterface

  // --- Parsing Logic ---
  const parseOutline = useCallback((outlineText: string): Chapter[] => {
    const chapters: Chapter[] = [];
    // Regex to find chapter headings like "## Chapter X: Title"
    const chapterRegex = /^##\s+Chapter\s+(\d+):\s*(.*)$/gm;
    let match;
    let lastIndex = 0;

    while ((match = chapterRegex.exec(outlineText)) !== null) {
      const chapterNumber = parseInt(match[1], 10);
      const title = match[2].trim();
      const startIndex = match.index;

      // Find the content for the current chapter
      // Look for the next chapter heading or end of string
      chapterRegex.lastIndex = startIndex + match[0].length; // Start search after current match
      const nextMatch = chapterRegex.exec(outlineText);
      chapterRegex.lastIndex = match.index + match[0].length; // Reset lastIndex for next iteration

      const endIndex = nextMatch ? nextMatch.index : outlineText.length;
      const rawContent = outlineText.substring(startIndex, endIndex).trim();

      // Basic parsing of content within the chapter block (can be enhanced)
      const summaryMatch = rawContent.match(/\*\s+\*\*Summary:\*\*\s*([\s\S]*?)(?=\n\s*\*\s+\*\*|$)/);
      const eventsMatch = rawContent.match(/\*\s+\*\*Key Events:\*\*\s*([\s\S]*?)(?=\n\s*\*\s+\*\*|$)/);
      // Add similar regex for other sections if needed

      chapters.push({
        chapterNumber,
        title,
        rawContent, // Store the raw block
        summary: summaryMatch ? summaryMatch[1].trim() : undefined,
        keyEvents: eventsMatch ? eventsMatch[1].trim().split('\n').map(e => e.trim().replace(/^\*\s*/, '')).filter(e => e) : undefined,
        // Populate other fields similarly
      });

      lastIndex = endIndex;
    }

    // Sort just in case regex matching order isn't guaranteed
    chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    return chapters;
  }, []);


  // Load initial state from local storage
  useEffect(() => {
    setWorldDescription(localStorage.getItem(LOCAL_STORAGE_KEYS.WORLD_DESCRIPTION) || '');
    setCharacterProfiles(localStorage.getItem(LOCAL_STORAGE_KEYS.CHARACTER_PROFILES) || '');
    const savedOutline = localStorage.getItem(LOCAL_STORAGE_KEYS.OUTLINE) || '';
    setOutline(savedOutline);
    setNumChapters(parseInt(localStorage.getItem(LOCAL_STORAGE_KEYS.NUM_CHAPTERS) || '10', 10));
    // Load and parse chapters
    const savedChapters = localStorage.getItem(LOCAL_STORAGE_KEYS.PARSED_CHAPTERS);
    if (savedChapters) {
        try {
            setParsedChapters(JSON.parse(savedChapters));
        } catch (e) { console.error("Failed to parse saved chapters", e); }
    } else if (savedOutline) {
        // If chapters aren't saved but outline is, parse the outline
        setParsedChapters(parseOutline(savedOutline));
    }
  }, [parseOutline]); // Add parseOutline dependency

  // Save state to local storage whenever it changes
  useEffect(() => {
    if (outline) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.OUTLINE, outline);
        // Re-parse and save chapters whenever the outline text changes
        const chapters = parseOutline(outline);
        setParsedChapters(chapters);
        localStorage.setItem(LOCAL_STORAGE_KEYS.PARSED_CHAPTERS, JSON.stringify(chapters));
    }
  }, [outline, parseOutline]); // Add parseOutline dependency

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.NUM_CHAPTERS, String(numChapters));
  }, [numChapters]);


  // --- Finalization Logic ---
  const { complete, completion, isLoading: isFinalizationLoading, error: finalizationError } = useCompletion({
    api: '/api/ai-writer/outline/generate', // Re-using the generate endpoint for finalization
    onFinish: (_, finalCompletion) => {
      setOutline(finalCompletion);
      setIsFinalizing(false);
      // TODO: Parse outline to generate chapter structure (like in Python app)
      // This would likely involve another API call or client-side parsing
      console.log("Outline finalized. Need to implement chapter structure parsing.");
    },
    onError: (err) => {
        console.error("Outline finalization error:", err);
        setIsFinalizing(false);
    }
  });

  const handleFinalize = useCallback(async () => {
    // Read the latest chat history directly from local storage
    const storedHistory = localStorage.getItem(LOCAL_STORAGE_KEYS.OUTLINE_CHAT_HISTORY);
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
    if (!worldDescription || !characterProfiles) {
        alert('World Description or Character Profiles are missing. Please complete previous stages first.');
        return;
    }

    setIsFinalizing(true);
    // Pass context and history to the API
    await complete('', { body: {
        messages: historyToFinalize,
        worldContext: worldDescription,
        characterContext: characterProfiles,
        numChapters: numChapters
    }});
  }, [worldDescription, characterProfiles, numChapters, complete]);


  return (
    <StageLayout> {/* Removed title prop */}
       {(!worldDescription || !characterProfiles) && (
         <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-md">
           <strong>Warning:</strong> World Description or Character Profiles not found. Please complete Stages 1 & 2 first. Outline generation requires this context.
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
            />
          </div>

          <ChatInterface
            apiEndpoint="/api/ai-writer/outline/chat"
            title="Brainstorm Outline"
            placeholder="Discuss plot points, character arcs, and structure..."
            systemPromptContext={{
                worldContext: worldDescription,
                characterContext: characterProfiles,
                numChapters: numChapters
            }}
            localStorageKey={LOCAL_STORAGE_KEYS.OUTLINE_CHAT_HISTORY}
          />

          <button
            onClick={handleFinalize}
            disabled={isFinalizing || isFinalizationLoading || !worldDescription || !characterProfiles}
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
            readOnly={isFinalizing || isFinalizationLoading}
          />
           <button
            onClick={() => localStorage.setItem(LOCAL_STORAGE_KEYS.OUTLINE, outline)}
            className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm"
          >
            Save Manual Edits
          </button>
          {/* TODO: Add chapter list display and parsing logic */}
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded">
            <h3 className="font-semibold mb-2">Next Steps (TODO):</h3>
            <p className="text-sm">Parse the generated outline above to create a list of chapters for Stage 4.</p>
          </div>
        </div>
      </div>
    </StageLayout>
  );
}
