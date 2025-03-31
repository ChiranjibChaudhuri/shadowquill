'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react'; // Import useMemo

interface Story {
  id: string;
  title: string;
  createdAt: number; // Timestamp
  // Add other metadata later if needed (e.g., lastModified)
}

interface StoryContextType {
  stories: Story[];
  activeStoryId: string | null;
  setActiveStoryId: (id: string | null) => void;
  addStory: (title: string) => string; // Returns the new story ID
  deleteStory: (id: string) => void;
  updateStoryTitle: (id: string, newTitle: string) => void;
  getStoryData: <T>(storyId: string, key: string, defaultValue: T) => T;
  setStoryData: <T>(storyId: string, key: string, value: T) => void;
  deleteStoryData: (storyId: string, key: string) => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

const LOCAL_STORAGE_STORIES_KEY = 'shadowquill_stories_metadata';
const LOCAL_STORAGE_ACTIVE_STORY_KEY = 'shadowquill_active_story_id';
const LOCAL_STORAGE_STORY_DATA_PREFIX = 'shadowquill_story_data_'; // Prefix for story-specific data

export const StoryProvider = ({ children }: { children: ReactNode }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryId, setActiveStoryIdState] = useState<string | null>(null);

  // Load stories metadata and active story ID from localStorage on mount
  useEffect(() => {
    const storedStories = localStorage.getItem(LOCAL_STORAGE_STORIES_KEY);
    if (storedStories) {
      try {
        setStories(JSON.parse(storedStories));
      } catch (e) {
        console.error("Failed to parse stories metadata from localStorage", e);
        localStorage.removeItem(LOCAL_STORAGE_STORIES_KEY);
      }
    }
    const storedActiveId = localStorage.getItem(LOCAL_STORAGE_ACTIVE_STORY_KEY);
    setActiveStoryIdState(storedActiveId);
  }, []);

  // Save stories metadata whenever it changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_STORIES_KEY, JSON.stringify(stories));
  }, [stories]);

  // Save active story ID whenever it changes
  const setActiveStoryId = useCallback((id: string | null) => {
    setActiveStoryIdState(id);
    if (id) {
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_STORY_KEY, id);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_ACTIVE_STORY_KEY);
    }
  }, []);

  const addStory = (title: string): string => {
    const newStory: Story = {
      id: Date.now().toString(), // Simple unique ID
      title: title || `Untitled Story ${stories.length + 1}`,
      createdAt: Date.now(),
    };
    setStories(prev => [...prev, newStory]);
    setActiveStoryId(newStory.id); // Automatically activate the new story
    return newStory.id;
  };

  const deleteStory = (id: string) => {
    // TODO: Add confirmation dialog?
    // Delete associated story data
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`${LOCAL_STORAGE_STORY_DATA_PREFIX}${id}_`)) {
            localStorage.removeItem(key);
        }
    });
    // Delete metadata
    setStories(prev => prev.filter(story => story.id !== id));
    // If the deleted story was active, deactivate
    if (activeStoryId === id) {
      setActiveStoryId(null);
    }
  };

  const updateStoryTitle = (id: string, newTitle: string) => {
     setStories(prev => prev.map(story =>
        story.id === id ? { ...story, title: newTitle } : story
     ));
  };

  // --- Helper functions for story-specific data ---
  const getStoryDataKey = useCallback((storyId: string, key: string) => `${LOCAL_STORAGE_STORY_DATA_PREFIX}${storyId}_${key}`, []);

  // Define the generic function signature correctly within useCallback
  const getStoryData = useCallback(function <T>(storyId: string, key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue; // Guard against SSR localStorage access
    const dataKey = getStoryDataKey(storyId, key);
    const storedData = localStorage.getItem(dataKey);
    if (storedData !== null) { // Check for null explicitly
      try {
        return JSON.parse(storedData) as T;
      } catch (e) {
        console.error(`Failed to parse story data for key ${dataKey}`, e);
        localStorage.removeItem(dataKey); // Clear corrupted data
        return defaultValue;
      }
    }
    return defaultValue;
  }, [getStoryDataKey]);

  // Define the generic function signature correctly within useCallback
  const setStoryData = useCallback(function <T>(storyId: string, key: string, value: T) {
    if (typeof window === 'undefined') return; // Guard against SSR localStorage access
    const dataKey = getStoryDataKey(storyId, key);
    try {
        localStorage.setItem(dataKey, JSON.stringify(value));
    } catch (e) {
        console.error(`Failed to save story data for key ${dataKey}`, e);
        // Handle potential storage quota errors?
    }
  }, [getStoryDataKey]);

   const deleteStoryData = useCallback((storyId: string, key: string) => {
     if (typeof window === 'undefined') return; // Guard against SSR localStorage access
     const dataKey = getStoryDataKey(storyId, key);
     localStorage.removeItem(dataKey);
   }, [getStoryDataKey]);

  // Memoize the context value
  const contextValue = useMemo(() => ({
    stories,
    activeStoryId,
    setActiveStoryId,
    addStory,
    deleteStory,
    updateStoryTitle,
    getStoryData, // Pass the function reference
    setStoryData, // Pass the function reference
    deleteStoryData
  }), [stories, activeStoryId, setActiveStoryId, addStory, deleteStory, updateStoryTitle, getStoryData, setStoryData, deleteStoryData]); // Include all dependencies

  return (
    <StoryContext.Provider value={contextValue}>
      {children}
    </StoryContext.Provider>
  );
};

export const useStoryContext = (): StoryContextType => {
  const context = useContext(StoryContext);
  if (context === undefined) {
    throw new Error('useStoryContext must be used within a StoryProvider');
  }
  return context;
};
