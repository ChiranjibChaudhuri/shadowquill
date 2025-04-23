'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react'; // Import useSession

// Keep Story interface
interface Story {
  id: string;
  title: string;
  createdAt: number; // Keep timestamp from DB (or Date object)
  userId?: string; // Add userId back as it's returned from API now
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
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

// Keep key for active story ID
const LOCAL_STORAGE_ACTIVE_STORY_KEY = 'shadowquill_active_story_id';

export const StoryProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, status: authStatus } = useSession(); // Get session status
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryId, setActiveStoryIdState] = useState<string | null>(null);
  const [isLoadingStories, setIsLoadingStories] = useState<boolean>(true); // Loading state initially true

  // Function to fetch stories from API (only if authenticated)
  const fetchStories = useCallback(async () => {
    // Don't fetch if not authenticated
    if (authStatus !== 'authenticated') {
        setStories([]); // Clear stories if not logged in
        setIsLoadingStories(false);
        return;
    }
    setIsLoadingStories(true);
    try {
      // API route now automatically filters by logged-in user
      const response = await fetch('/api/stories/list');
      if (!response.ok) {
        // Handle specific auth error if possible, otherwise generic
        if (response.status === 401) {
            console.error("Unauthorized fetch stories request.");
            // Optionally trigger sign-in or show message
        } else {
            throw new Error(`Failed to fetch stories: ${response.statusText}`);
        }
        setStories([]); // Clear on error
      } else {
        const data = await response.json();
        // Convert createdAt string from DB to number if needed, or adjust Story interface
        // Ensure data is an array before mapping
        if (Array.isArray(data)) {
            setStories(data.map((story: any) => ({
                ...story,
                createdAt: new Date(story.createdAt).getTime()
            })));
        } else {
            console.error("Received non-array data for stories:", data);
            setStories([]);
        }
      }
    } catch (error) {
      console.error("Error fetching stories:", error);
      setStories([]); // Clear stories on error
    } finally {
      setIsLoadingStories(false);
    }
  }, [authStatus]); // Depend on authStatus

  // Load stories when authentication status changes to authenticated
  // Also load active story ID from localStorage on initial mount
  useEffect(() => {
    if (authStatus === 'authenticated') {
        console.log("User authenticated, fetching stories...");
        fetchStories();
    } else if (authStatus === 'unauthenticated') {
        console.log("User unauthenticated, clearing stories.");
        setStories([]); // Clear stories if user logs out
        setActiveStoryIdState(null); // Clear active story
        localStorage.removeItem(LOCAL_STORAGE_ACTIVE_STORY_KEY); // Clear stored active ID
        setIsLoadingStories(false); // Not loading if not authenticated
    } else {
        // Status is 'loading'
        setIsLoadingStories(true);
    }
  }, [authStatus, fetchStories]);

  // Load active story ID only once on initial mount
  useEffect(() => {
    const storedActiveId = localStorage.getItem(LOCAL_STORAGE_ACTIVE_STORY_KEY);
    // Only set if it exists, otherwise keep it null until a story is added/selected
    if (storedActiveId) {
        setActiveStoryIdState(storedActiveId);
    }
  }, []); // Empty dependency array ensures this runs only once


  // Save active story ID whenever it changes
  const setActiveStoryId = useCallback((id: string | null) => {
    setActiveStoryIdState(id);
    if (id) {
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_STORY_KEY, id);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_ACTIVE_STORY_KEY);
    }
  }, []);

  // --- API-based CRUD operations (now assume user is authenticated) ---

  const addStory = useCallback(async (title: string): Promise<Story> => {
    // No need to check authStatus here, API route will handle it
    try {
      const response = await fetch('/api/stories/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }), // No userId needed in body
      });
      if (!response.ok) {
        // Attempt to parse error JSON, fallback to text
        let errorMsg = 'Failed to create story';
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
        } catch {
            errorMsg = await response.text() || errorMsg;
        }
        throw new Error(errorMsg);
      }
      const newStoryData = await response.json();
      // Ensure createdAt is handled correctly
      const newStory: Story = {
          ...newStoryData,
          createdAt: newStoryData.createdAt ? new Date(newStoryData.createdAt).getTime() : Date.now()
      };

      // Pre-create directory (fire and forget, errors handled in API)
      fetch('/api/create-story-directory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyId: newStory.id }),
      }).catch(err => console.error("Error pre-creating directory:", err));

      setStories((prev: Story[]) => [newStory, ...prev]); // Add type for prev
      setActiveStoryId(newStory.id); // Activate new story
      return newStory;
    } catch (error) {
      console.error("Error adding story:", error);
      throw error; // Re-throw for the caller to handle
    }
  }, [setActiveStoryId]);

  const deleteStory = useCallback(async (id: string): Promise<void> => {
    // API route handles auth and ownership check
    try {
      const response = await fetch(`/api/stories/delete?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
         let errorMsg = 'Failed to delete story';
         try {
             const errorData = await response.json();
             errorMsg = errorData.error || errorMsg;
         } catch {
             errorMsg = await response.text() || errorMsg;
         }
         throw new Error(errorMsg);
      }
      setStories((prev: Story[]) => prev.filter(story => story.id !== id)); // Add type for prev
      if (activeStoryId === id) {
        setActiveStoryId(null);
      }
    } catch (error) {
      console.error("Error deleting story:", error);
      throw error;
    }
  }, [activeStoryId, setActiveStoryId]);

  const updateStoryTitle = useCallback(async (id: string, newTitle: string): Promise<void> => {
     // API route handles auth and ownership check
     try {
        const response = await fetch('/api/stories/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, title: newTitle }),
        });
        if (!response.ok) {
            let errorMsg = 'Failed to update story title';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch {
                errorMsg = await response.text() || errorMsg;
            }
            throw new Error(errorMsg);
        }
        const updatedStoryData = await response.json();
        // Ensure createdAt is handled correctly
        const updatedStory: Story = {
            ...updatedStoryData,
            createdAt: updatedStoryData.createdAt ? new Date(updatedStoryData.createdAt).getTime() : Date.now()
        };
        setStories((prev: Story[]) => prev.map(story => // Add type for prev
            story.id === id ? { ...story, ...updatedStory } : story // Merge updates carefully
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
  }), [
      stories, activeStoryId, setActiveStoryId, addStory, deleteStory,
      updateStoryTitle, refreshStories, isLoadingStories
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
  return context;
};
