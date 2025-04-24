'use client'; // Required for hooks like useState, useEffect

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat, type Message } from 'ai/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface ChatInterfaceProps {
  apiEndpoint: string;
  initialMessages?: Message[];
  systemPromptContext?: Record<string, any>;
  placeholder?: string;
  title: string;
  localStorageKey: string; // Key to save/load chat history
  storyId: string | null; // Add storyId prop
  onStreamComplete?: (finalAssistantMessage: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  apiEndpoint,
  initialMessages = [], // Note: initialMessages from useChat might override loaded history if not careful
  systemPromptContext = {},
  placeholder = 'Ask questions or give instructions...',
  title,
  localStorageKey, // Receive the key
  storyId, // Receive storyId
  onStreamComplete
}) => {
  // Load initial messages from local storage if available and storyId is present
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
  }, [localStorageKey, storyId]); // Also depend on storyId


  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } = useChat({
    api: apiEndpoint,
    initialMessages: loadedInitialMessages, // Use messages loaded from storage
    body: systemPromptContext, // Send additional context here
    onFinish: (message: Message) => { // Add Message type
      // Callback with the final assistant message content when stream ends
      if (onStreamComplete && message.role === 'assistant') {
        onStreamComplete(message.content);
      }
    },
    onError: (err) => {
      // Log error directly from the onError callback
      console.error("Error received in useChat onError callback:", err);
      console.error("Full error object from onError callback:", JSON.stringify(err, null, 2));
    }
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Log the error object from useChat when it changes
  useEffect(() => {
    if (error) {
      // Log the full error object structure for detailed inspection (JSON.stringify)
      console.error("Full error object from useChat hook:", JSON.stringify(error, null, 2));
      // Keep the original basic log too
      console.error("Error details from useChat hook (raw):", error);
    }
  }, [error]);

  // Scroll to bottom and save history when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    // Save messages to local storage whenever they change
    // Avoid saving if no storyId or if messages are empty and nothing was loaded
    if (storyId && (messages.length > 0 || localStorage.getItem(localStorageKey))) {
       localStorage.setItem(localStorageKey, JSON.stringify(messages));
    }
  }, [messages, localStorageKey, storyId]); // Add storyId dependency

  // Function to clear chat history and local storage
  const clearChat = useCallback(() => {
    if (storyId) { // Only clear if there's an active story
        setMessages([]);
        localStorage.removeItem(localStorageKey);
    }
  }, [setMessages, localStorageKey, storyId]); // Add storyId dependency

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
        {messages.map((m: Message) => ( // Add Message type
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] p-3 rounded-lg whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
              }`}
            >
              <span className="font-bold capitalize">{m.role === 'assistant' ? 'AI' : 'You'}: </span>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {m.content}
              </ReactMarkdown>
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
        {error && (() => {
          let displayMessage = error.message;
          try {
            // Attempt to parse the error message as JSON (backend might send structured error)
            const parsedError = JSON.parse(error.message);
            if (parsedError && parsedError.details) {
              displayMessage = parsedError.details;
            } else if (parsedError && parsedError.error) {
              displayMessage = parsedError.error; // Fallback to error type if details missing
            }
          } catch (e) {
            // If parsing fails, just use the raw error message
          }
          return (
            <div className="flex justify-start">
              <div className="bg-red-100 text-red-700 p-3 rounded-lg">
                <span className="font-bold">Error:</span> {displayMessage}
              </div>
            </div>
          );
        })()}
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
