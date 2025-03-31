'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';

// Keep Story interface
interface Story {
  id: string;
  title: string;
  createdAt: number; // Keep timestamp from DB (or Date object)
  // Add other fields from Prisma schema if needed later
}

interface StoryContextType {
  stories: Story[];
  activeStoryId: string | null;
  setActiveStoryId: (id: string | null) => void;
  addStory: (title: string) => Promise<Story>; // Returns the new story from DB
  deleteStory: (id: string) => Promise<void>;
  updateStoryTitle: (id: string, newTitle: string) => Promise<void>;
  refreshStories: () => Promise<void>; // Function to manually refresh list
  isLoadingStories: boolean;
  // Remove localStorage data helpers
  // getStoryData: <T>(storyId: string, key: string, defaultValue: T) => T;
  // setStoryData: <T>(storyId: string, key: string, value: T) => void;
  // deleteStoryData: (storyId: string, key: string) => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

// Keep key for active story ID
const LOCAL_STORAGE_ACTIVE_STORY_KEY = 'shadowquill_active_story_id';
// Remove other localStorage keys

export const StoryProvider = ({ children }: { children: ReactNode }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryId, setActiveStoryIdState] = useState<string | null>(null);
  const [isLoadingStories, setIsLoadingStories] = useState<boolean>(true); // Loading state

  // Function to fetch stories from API
  const fetchStories = useCallback(async () => {
    setIsLoadingStories(true);
    try {
      const response = await fetch('/api/stories/list');
      if (!response.ok) {
        throw new Error('Failed to fetch stories');
      }
      const data = await response.json();
      // Convert createdAt string from DB to number if needed, or adjust Story interface
      setStories(data.map((story: any) => ({ ...story, createdAt: new Date(story.createdAt).getTime() })));
    } catch (error) {
      console.error("Error fetching stories:", error);
      setStories([]); // Clear stories on error
    } finally {
      setIsLoadingStories(false);
    }
  }, []);

  // Load stories on mount and active story ID from localStorage
  useEffect(() => {
    fetchStories();
    const storedActiveId = localStorage.getItem(LOCAL_STORAGE_ACTIVE_STORY_KEY);
    setActiveStoryIdState(storedActiveId);
  }, [fetchStories]); // fetchStories is memoized

  // Save active story ID whenever it changes
  const setActiveStoryId = useCallback((id: string | null) => {
    setActiveStoryIdState(id);
    if (id) {
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_STORY_KEY, id);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_ACTIVE_STORY_KEY);
    }
  }, []);

  // --- API-based CRUD operations ---

  const addStory = useCallback(async (title: string): Promise<Story> => {
    try {
      const response = await fetch('/api/stories/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        throw new Error((await response.json()).error || 'Failed to create story');
      }
      const newStoryData = await response.json();
      const newStory = { ...newStoryData, createdAt: new Date(newStoryData.createdAt).getTime() };

      // Pre-create directory (fire and forget, errors handled in API)
      fetch('/api/create-story-directory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyId: newStory.id }),
      }).catch(err => console.error("Error pre-creating directory:", err));

      setStories(prev => [newStory, ...prev]); // Add to start of list
      setActiveStoryId(newStory.id); // Activate new story
      return newStory;
    } catch (error) {
      console.error("Error adding story:", error);
      throw error; // Re-throw for the caller to handle
    }
  }, [setActiveStoryId]);

  const deleteStory = useCallback(async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/stories/delete?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error((await response.json()).error || 'Failed to delete story');
      }
      setStories(prev => prev.filter(story => story.id !== id));
      if (activeStoryId === id) {
        setActiveStoryId(null);
      }
    } catch (error) {
      console.error("Error deleting story:", error);
      throw error;
    }
  }, [activeStoryId, setActiveStoryId]);

  const updateStoryTitle = useCallback(async (id: string, newTitle: string): Promise<void> => {
     try {
        const response = await fetch('/api/stories/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, title: newTitle }),
        });
        if (!response.ok) {
            throw new Error((await response.json()).error || 'Failed to update story title');
        }
        const updatedStoryData = await response.json();
        const updatedStory = { ...updatedStoryData, createdAt: new Date(updatedStoryData.createdAt).getTime() };
        setStories(prev => prev.map(story =>
            story.id === id ? updatedStory : story
        ));
     } catch (error) {
        console.error("Error updating story title:", error);
        throw error;
     }
  }, []);

  // Expose fetchStories as refreshStories
  const refreshStories = fetchStories;

  // Memoize the context value
  const contextValue = useMemo(() => ({
    stories,
    activeStoryId,
    setActiveStoryId,
    addStory,
    deleteStory,
    updateStoryTitle,
    refreshStories,
    isLoadingStories,
    // Remove localStorage helpers
    // getStoryData,
    // setStoryData,
    // deleteStoryData
  }), [
      stories, activeStoryId, setActiveStoryId, addStory, deleteStory,
      updateStoryTitle, refreshStories, isLoadingStories
      // Remove localStorage helpers from dependencies
      // getStoryData, setStoryData, deleteStoryData
  ]);

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
  // We need to cast because the removed functions are still in the type
  // A better approach would be to define a separate internal type
  return context as StoryContextType;
};
