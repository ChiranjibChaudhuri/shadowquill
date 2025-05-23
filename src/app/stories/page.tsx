'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useStoryContext } from '@/context/StoryContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react'; // Import useSession and signIn

// Keep Story interface from context or redefine if context is removed later
interface Story {
  id: string;
  title: string;
  createdAt: number; // Using number timestamp
}

export default function StoriesPage() {
  const { data: session, status: authStatus } = useSession(); // Get auth status
  // Get state management functions from context
  const { activeStoryId, setActiveStoryId } = useStoryContext();
  const [stories, setStories] = useState<Story[]>([]); // Local state for stories list
  const [isLoading, setIsLoading] = useState(true); // Combined loading state
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Store ID being deleted
  const router = useRouter();

  // Fetch stories from API on mount or when auth status changes to authenticated
  const fetchStories = useCallback(async () => {
    // Only fetch if authenticated
    if (authStatus !== 'authenticated') {
        setStories([]);
        setIsLoading(false); // Not loading if not authenticated
        return;
    }
    setIsLoading(true); // Set loading true when fetching starts
    try {
      const response = await fetch('/api/stories/list'); // API handles user filtering
      if (!response.ok) {
          if (response.status === 401) {
              // Handle unauthorized - maybe prompt sign in?
              console.error("Unauthorized to fetch stories.");
          } else {
              throw new Error('Failed to fetch stories');
          }
          setStories([]); // Clear stories on error
      } else {
          const data = await response.json();
          // Add type annotation for story in map
          setStories(data.map((story: Story) => ({ ...story, createdAt: new Date(story.createdAt).getTime() })));
      }
    } catch (error) {
      console.error("Error fetching stories:", error);
      alert(`Error fetching stories: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStories([]);
    } finally {
      setIsLoading(false);
    }
  }, [authStatus]); // Depend on authStatus

  useEffect(() => {
    fetchStories();
  }, [fetchStories]); // fetchStories is memoized with authStatus dependency

  // --- API Call Handlers ---

  const handleAddStory = async () => {
    if (authStatus !== 'authenticated') {
        signIn(); // Prompt sign in if not authenticated
        return;
    }
    setIsCreating(true);
    try {
      const response = await fetch('/api/stories/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newStoryTitle.trim() || `Untitled Story ${new Date().toISOString()}` }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to create story');
      const newStoryData = await response.json();
      const newStory = { ...newStoryData, createdAt: new Date(newStoryData.createdAt).getTime() };

      // Pre-create directory (fire and forget)
      fetch('/api/create-story-directory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyId: newStory.id }),
      }).catch(err => console.error("Error pre-creating directory:", err));

      // Add type annotation for prev and sort parameters
      setStories((prev: Story[]) => [newStory, ...prev].sort((a: Story, b: Story) => b.createdAt - a.createdAt));
      setActiveStoryId(newStory.id); // Activate new story
      setNewStoryTitle('');
      router.push('/world'); // Navigate after creation

    } catch (error) {
        console.error("Error adding story:", error);
        alert(`Error creating story: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsCreating(false);
    }
  };

  const handleSelectStory = (id: string) => {
    if (authStatus !== 'authenticated') return; // Should not be possible if list isn't shown
    setActiveStoryId(id);
    router.push('/world');
  };

  const handleStartEdit = (story: Story) => {
    if (authStatus !== 'authenticated') return;
    setEditingStoryId(story.id);
    setEditTitle(story.title);
  };

  const handleSaveEdit = async (id: string) => {
    if (authStatus !== 'authenticated') return;
    if (!editTitle.trim()) return; // Don't save empty title
    setIsUpdating(true);
    try {
        const response = await fetch('/api/stories/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, title: editTitle.trim() }),
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to update title');
        const updatedStoryData = await response.json();
        const updatedStory = { ...updatedStoryData, createdAt: new Date(updatedStoryData.createdAt).getTime() };
        // Add type annotation for prev and story
        setStories((prev: Story[]) => prev.map((story: Story) => story.id === id ? updatedStory : story));
    } catch (error) {
        console.error("Error updating title:", error);
        alert(`Error updating title: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setEditingStoryId(null);
        setEditTitle('');
        setIsUpdating(false);
    }
  };

  const handleDeleteStory = async (id: string) => {
      if (authStatus !== 'authenticated') return;
      if (confirm('Are you sure you want to delete this story and all its data? This cannot be undone.')) {
          setIsDeleting(id); // Set deleting state for specific story
          try {
              const response = await fetch(`/api/stories/delete?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
              if (!response.ok) throw new Error((await response.json()).error || 'Failed to delete story');
              // Add type annotation for prev and story
              setStories((prev: Story[]) => prev.filter((story: Story) => story.id !== id));
              if (activeStoryId === id) setActiveStoryId(null);
          } catch (error) {
              console.error("Error deleting story:", error);
              alert(`Error deleting story: ${error instanceof Error ? error.message : 'Unknown error'}`);
          } finally {
              setIsDeleting(null);
          }
      }
  }

  // Handle loading and unauthenticated states
  if (authStatus === 'loading' || isLoading) {
      return (
          <div className="container mx-auto px-4 py-8 text-center">
              <p>Loading...</p>
          </div>
      );
  }

  if (authStatus === 'unauthenticated') {
       return (
          <div className="container mx-auto px-4 py-8 text-center">
              <h1 className="text-3xl font-bold mb-6">My Stories</h1>
              <p className="mb-4">Please sign in to view and manage your stories.</p>
              <button
                onClick={() => signIn()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Sign In
              </button>
          </div>
      );
  }

  // Render page content only if authenticated
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Stories</h1>

      {/* Add New Story */}
      <div className="mb-8 p-4 border rounded-lg bg-white dark:bg-gray-800 shadow">
        <h2 className="text-xl font-semibold mb-3">Create New Story</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newStoryTitle}
            onChange={(e) => setNewStoryTitle(e.target.value)}
            placeholder="Enter story title (optional)"
            className="flex-grow p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={isCreating}
          />
          <button
            onClick={handleAddStory}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Story'}
          </button>
        </div>
      </div>

      {/* List Stories */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Existing Stories</h2>
        {stories.length === 0 ? (
          <p className="text-gray-500">You haven't created any stories yet.</p>
        ) : (
          <ul className="space-y-4">
            {stories.map((story: Story) => ( // Add type annotation here
              <li key={story.id} className={`p-4 border rounded-lg bg-white dark:bg-gray-800 shadow flex justify-between items-center ${isDeleting === story.id ? 'opacity-50' : ''}`}>
                {editingStoryId === story.id ? (
                  <div className="flex-grow flex gap-2 items-center">
                     <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-grow p-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-lg"
                        autoFocus
                        disabled={isUpdating}
                      />
                      <button onClick={() => handleSaveEdit(story.id)} className="bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-1 px-2 rounded disabled:opacity-50" disabled={isUpdating || !editTitle.trim()}>
                        {isUpdating ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setEditingStoryId(null)} className="text-gray-500 hover:text-gray-700 text-xs font-semibold py-1 px-2 rounded" disabled={isUpdating}>Cancel</button>
                  </div>
                ) : (
                  <div className="flex-grow">
                    <h3 className="text-lg font-semibold cursor-pointer hover:text-blue-600 dark:hover:text-blue-400" onClick={() => handleSelectStory(story.id)}>
                      {story.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Created: {new Date(story.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div className="flex gap-2 items-center ml-4">
                   {editingStoryId !== story.id && (
                     <button onClick={() => handleStartEdit(story)} className="text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50" disabled={isDeleting === story.id}>Edit Title</button>
                   )}
                   <button
                    onClick={() => handleDeleteStory(story.id)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium disabled:opacity-50"
                    disabled={isDeleting === story.id || editingStoryId === story.id}
                  >
                    {isDeleting === story.id ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    onClick={() => handleSelectStory(story.id)}
                    className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-bold py-1 px-3 rounded disabled:opacity-50"
                    disabled={isDeleting === story.id || editingStoryId === story.id}
                  >
                    Open
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
