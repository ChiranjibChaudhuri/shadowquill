'use client';

import React, { useState } from 'react';
import { useStoryContext } from '@/context/StoryContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function StoriesPage() {
  const { stories, addStory, deleteStory, setActiveStoryId, updateStoryTitle } = useStoryContext();
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false); // Add loading state

  const handleAddStory = async () => {
    setIsCreating(true);
    let newId: string | null = null;
    try {
      // 1. Add story to context (gets the new ID)
      newId = addStory(newStoryTitle.trim()); // Trim title before adding
      setNewStoryTitle(''); // Clear input

      // 2. Call API to create directory
      const response = await fetch('/api/create-story-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: newId }),
      });

      if (!response.ok) {
        // Log error but proceed, directory might be created later on first save
        const errorData = await response.json();
        console.error('Failed to pre-create story directory:', errorData.error || 'Unknown error');
        // Optionally alert the user?
        // alert(`Warning: Could not pre-create directory for story: ${errorData.error}`);
      } else {
        console.log(`Directory pre-created for story ${newId}`);
      }

      // 3. Optionally navigate
      // router.push('/world');

    } catch (error) {
        console.error("Error adding story or creating directory:", error);
        alert("An error occurred while creating the story.");
        // Consider rolling back the context add if API call fails critically?
        // if (newId) deleteStory(newId); // Example rollback
    } finally {
        setIsCreating(false);
    }
  };

  const handleSelectStory = (id: string) => {
    setActiveStoryId(id);
    // Navigate to the first stage (or last known stage for this story?)
    router.push('/world');
  };

  const handleStartEdit = (story: { id: string; title: string }) => {
    setEditingStoryId(story.id);
    setEditTitle(story.title);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      updateStoryTitle(id, editTitle);
    }
    setEditingStoryId(null);
    setEditTitle('');
  };

  const handleDeleteStory = (id: string) => {
      if (confirm('Are you sure you want to delete this story and all its data? This cannot be undone.')) {
          deleteStory(id);
      }
  }

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
            placeholder="Enter story title..."
            className="flex-grow p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <button
            onClick={handleAddStory}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
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
            {stories.sort((a, b) => b.createdAt - a.createdAt).map((story) => ( // Sort newest first
              <li key={story.id} className="p-4 border rounded-lg bg-white dark:bg-gray-800 shadow flex justify-between items-center">
                {editingStoryId === story.id ? (
                  <div className="flex-grow flex gap-2 items-center">
                     <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-grow p-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-lg"
                        autoFocus
                      />
                      <button onClick={() => handleSaveEdit(story.id)} className="bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-1 px-2 rounded">Save</button>
                      <button onClick={() => setEditingStoryId(null)} className="text-gray-500 hover:text-gray-700 text-xs font-semibold py-1 px-2 rounded">Cancel</button>
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
                     <button onClick={() => handleStartEdit(story)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit Title</button>
                   )}
                   <button
                    onClick={() => handleDeleteStory(story.id)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => handleSelectStory(story.id)}
                    className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-bold py-1 px-3 rounded"
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
