'use client'; // Required for hooks like useState, useEffect

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat, type Message } from 'ai/react';

interface ChatInterfaceProps {
  apiEndpoint: string;
  initialMessages?: Message[];
  systemPromptContext?: Record<string, any>;
  placeholder?: string;
  title: string;
  localStorageKey: string; // Key to save/load chat history
  onStreamComplete?: (finalAssistantMessage: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  apiEndpoint,
  initialMessages = [], // Note: initialMessages from useChat might override loaded history if not careful
  systemPromptContext = {},
  placeholder = 'Ask questions or give instructions...',
  title,
  localStorageKey, // Receive the key
  onStreamComplete
}) => {
  // Load initial messages from local storage if available
  const [loadedInitialMessages, setLoadedInitialMessages] = useState<Message[]>(initialMessages);

  useEffect(() => {
    const storedHistory = localStorage.getItem(localStorageKey);
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory);
        // Only set if it's different from default initialMessages to avoid loops
        if (JSON.stringify(parsedHistory) !== JSON.stringify(initialMessages)) {
          setLoadedInitialMessages(parsedHistory);
        }
      } catch (e) {
        console.error("Failed to parse chat history from local storage", e);
        localStorage.removeItem(localStorageKey); // Clear corrupted data
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStorageKey]); // Run only when key changes (effectively once on mount)


  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } = useChat({
    api: apiEndpoint,
    initialMessages: loadedInitialMessages, // Use messages loaded from storage
    body: systemPromptContext, // Send additional context here
    onFinish: (message) => {
      // Callback with the final assistant message content when stream ends
      if (onStreamComplete && message.role === 'assistant') {
        onStreamComplete(message.content);
      }
    }
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom and save history when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    // Save messages to local storage whenever they change
    // Avoid saving the initial default empty array if nothing was loaded
    if (messages.length > 0 || localStorage.getItem(localStorageKey)) {
       localStorage.setItem(localStorageKey, JSON.stringify(messages));
    }
  }, [messages, localStorageKey]);

  // Function to clear chat history and local storage
  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(localStorageKey);
  }, [setMessages, localStorageKey]);

  return (
    <div className="border rounded-lg p-4 shadow-sm flex flex-col h-[600px] bg-white dark:bg-gray-800">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button
            onClick={clearChat}
            className="text-sm text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            title="Clear chat history"
        >
            Clear Chat
        </button>
      </div>
      <div ref={chatContainerRef} className="flex-grow overflow-y-auto mb-4 space-y-4 pr-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] p-3 rounded-lg whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
              }`}
            >
              <span className="font-bold capitalize">{m.role === 'assistant' ? 'AI' : 'You'}: </span>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100 p-3 rounded-lg animate-pulse">
              AI is thinking...
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-start">
            <div className="bg-red-100 text-red-700 p-3 rounded-lg">
              <span className="font-bold">Error:</span> {error.message}
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex items-center border-t pt-4">
        <input
          className="flex-grow p-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          value={input}
          placeholder={placeholder}
          onChange={handleInputChange}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded-r-md hover:bg-blue-600 disabled:opacity-50"
          disabled={isLoading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;
