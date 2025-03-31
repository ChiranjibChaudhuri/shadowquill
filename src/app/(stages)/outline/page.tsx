'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { type Message, useCompletion } from 'ai/react';
// import { readStreamableValue } from 'ai/rsc'; // Not needed for streamText response handling
import StageLayout from '@/components/StageLayout';
import ChatInterface from '@/components/ChatInterface';
import { useStoryContext } from '@/context/StoryContext';
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnConnect,
  type FitViewOptions,
} from 'reactflow';

import 'reactflow/dist/style.css';

// Define keys for story-specific data
const STORY_DATA_KEYS = {
  OUTLINE_CHAT_HISTORY: 'outline_chat_history',
};

// Define structure for parsed chapters
interface Chapter {
  chapterNumber: number;
  title: string;
  summary?: string;
  keyEvents?: string[];
  characterDevelopment?: string[];
  setting?: string;
  themes?: string;
  setup?: string;
  endingHook?: string;
  rawContent: string;
}

// Define constant options outside the component
const fitViewOptions: FitViewOptions = { padding: 0.2 };

// Props for the MindMapComponent
interface MindMapComponentProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void; // Adjust type as needed
  onEdgesChange: (changes: any) => void; // Adjust type as needed
  onConnect: OnConnect;
  setRfInstance: (instance: any) => void;
  addNode: () => void;
  handleSaveMindMap: () => Promise<void>;
  activeStoryId: string | null;
  isLoadingData: boolean;
  isSavingMindMap: boolean;
  isGeneratingMindMap: boolean;
  // Add missing props needed inside the component
  handleGenerateMindMap: () => Promise<void>;
  worldDescription: string;
  characterProfiles: string;
  outline: string;
}

// Define the inner component first
const MindMapInnerComponent: React.FC<MindMapComponentProps> = ({
  nodes, edges, onNodesChange, onEdgesChange, onConnect, setRfInstance,
  addNode, handleSaveMindMap, handleGenerateMindMap,
  activeStoryId, isLoadingData, isSavingMindMap, isGeneratingMindMap,
  worldDescription, characterProfiles, outline
}) => {
  return (
    <div style={{ height: '600px' }} className="border rounded-md relative bg-gray-50 dark:bg-gray-800">
      <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
        onInit={setRfInstance}
        fitView
        fitViewOptions={fitViewOptions} // Use the constant object
        className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-800 dark:via-gray-900 dark:to-black"
      >
      <Controls />
      <MiniMap nodeStrokeWidth={3} zoomable pannable />
      <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
    </ReactFlow>
    {/* Add Node Button */}
    <button
      onClick={addNode}
      className="absolute bottom-4 left-4 z-10 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-3 rounded text-sm shadow"
      disabled={!activeStoryId || isLoadingData || isSavingMindMap || isGeneratingMindMap}
    >
      + Add Node
    </button>
    {/* Generate Initial Map Button - Uses destructured props now */}
    <button
      onClick={handleGenerateMindMap}
      className="absolute top-4 left-4 z-10 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-1 px-3 rounded text-sm shadow disabled:opacity-50"
      disabled={!activeStoryId || isLoadingData || isSavingMindMap || isGeneratingMindMap || !worldDescription || !characterProfiles || !outline}
      title={(!worldDescription || !characterProfiles || !outline) ? "Requires World, Characters, and Outline Text" : "Generate initial map from context"}
    >
      {isGeneratingMindMap ? 'Generating...' : 'Generate Initial Map'}
    </button>
    {/* Save Mind Map Button */}
    <button
      onClick={handleSaveMindMap}
      className="absolute bottom-4 right-4 z-10 bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-3 rounded text-sm shadow disabled:opacity-50"
      disabled={!activeStoryId || isLoadingData || isSavingMindMap || isGeneratingMindMap}
    >
      {isSavingMindMap ? 'Saving...' : 'Save Mind Map'}
    </button>
    </div>
  );
};

// Memoize the inner component
const MindMapComponent = React.memo(MindMapInnerComponent);

// Add display name for better debugging
MindMapComponent.displayName = 'MindMapComponent';


// Main Component needs to be wrapped in ReactFlowProvider
function OutlineCreationPageContent() {
  const { activeStoryId } = useStoryContext();
  const router = useRouter();

  // Existing state
  const [worldDescription, setWorldDescription] = useState<string>('');
  const [characterProfiles, setCharacterProfiles] = useState<string>('');
  const [outline, setOutline] = useState<string>('');
  const [numChapters, setNumChapters] = useState<number>(10);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [parsedChapters, setParsedChapters] = useState<Chapter[]>([]);

  // --- Mind Map State ---
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [viewMode, setViewMode] = useState<'outline' | 'mindmap'>('outline');
  const [isSavingMindMap, setIsSavingMindMap] = useState<boolean>(false);
  const [isGeneratingMindMap, setIsGeneratingMindMap] = useState<boolean>(false); // Added
  const [generationError, setGenerationError] = useState<string | null>(null); // Added
  const [rfInstance, setRfInstance] = useState<any>(null);

  // Redirect if no active story
  useEffect(() => {
    if (!activeStoryId) {
      router.replace('/stories');
    }
  }, [activeStoryId, router]);

  // --- Parsing Logic ---
  const parseOutline = useCallback((outlineText: string): Chapter[] => {
    const chapters: Chapter[] = [];
    const chapterRegex = /^##\s+Chapter\s+(\d+):\s*(.*)$/gm;
    let match;
    while ((match = chapterRegex.exec(outlineText)) !== null) {
      const chapterNumber = parseInt(match[1], 10);
      const title = match[2].trim();
      const startIndex = match.index;
      chapterRegex.lastIndex = startIndex + match[0].length;
      const nextMatch = chapterRegex.exec(outlineText);
      chapterRegex.lastIndex = match.index + match[0].length;
      const endIndex = nextMatch ? nextMatch.index : outlineText.length;
      const rawContent = outlineText.substring(startIndex, endIndex).trim();
      const summaryMatch = rawContent.match(/\*\s+\*\*Summary:\*\*\s*([\s\S]*?)(?=\n\s*\*\s+\*\*|$)/);
      const eventsMatch = rawContent.match(/\*\s+\*\*Key Events:\*\*\s*([\s\S]*?)(?=\n\s*\*\s+\*\*|$)/);
      chapters.push({
        chapterNumber, title, rawContent,
        summary: summaryMatch ? summaryMatch[1].trim() : undefined,
        keyEvents: eventsMatch ? eventsMatch[1].trim().split('\n').map(e => e.trim().replace(/^\*\s*/, '')).filter(e => e) : undefined,
      });
    }
    chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    return chapters;
  }, []);

  // Load initial state from DB via API
  useEffect(() => {
    const loadInitialData = async () => {
      if (!activeStoryId) {
        setIsLoadingData(false);
        setWorldDescription(''); setCharacterProfiles(''); setOutline('');
        setNumChapters(10); setParsedChapters([]); setNodes([]); setEdges([]);
        return false;
      }
      setIsLoadingData(true);
      let initialLoadSuccess = false;
      try {
        const [worldData, charData, outlineData] = await Promise.all([
          fetch(`/api/story-data/world?storyId=${encodeURIComponent(activeStoryId)}`).then(res => res.ok ? res.json() : { description: '' }),
          fetch(`/api/story-data/characters?storyId=${encodeURIComponent(activeStoryId)}`).then(res => res.ok ? res.json() : { profiles: '' }),
          fetch(`/api/story-data/outline?storyId=${encodeURIComponent(activeStoryId)}`).then(res => res.ok ? res.json() : { outline: '', numChapters: 10 })
        ]);
        setWorldDescription(worldData.description ?? '');
        setCharacterProfiles(charData.profiles ?? '');
        setOutline(outlineData.outline ?? '');
        setNumChapters(outlineData.numChapters ?? 10);
        setParsedChapters(parseOutline(outlineData.outline ?? ''));
        initialLoadSuccess = true;
      } catch (error) {
        console.error("Error loading outline page data:", error);
        setWorldDescription(''); setCharacterProfiles(''); setOutline('');
        setNumChapters(10); setParsedChapters([]); setNodes([]); setEdges([]);
      }
      return initialLoadSuccess;
    };

    const loadMindMapData = async () => {
      if (!activeStoryId) return;
      try {
        const response = await fetch(`/api/story-data/mindmap?storyId=${encodeURIComponent(activeStoryId)}`);
        if (response.ok) {
          const data = await response.json();
          const flowData = data.mindMapData || { nodes: [], edges: [] };
          const initialNodes = (flowData.nodes || []).map((node: Node) => ({
            ...node,
            position: node.position || { x: Math.random() * 400, y: Math.random() * 400 },
          }));
          setNodes(initialNodes);
          setEdges(flowData.edges || []);
        } else {
          console.error("Failed to load mind map data:", response.statusText);
          setNodes([]); setEdges([]);
        }
      } catch (error) {
        console.error("Error fetching mind map data:", error);
        setNodes([]); setEdges([]);
      }
    };

    const loadAllData = async () => {
      const initialSuccess = await loadInitialData();
      if (initialSuccess) {
        await loadMindMapData();
      }
      setIsLoadingData(false);
    };

    loadAllData();
  }, [activeStoryId, parseOutline, setNodes, setEdges]);

  // Re-parse outline whenever outline text changes
  useEffect(() => {
    setParsedChapters(parseOutline(outline));
  }, [outline, parseOutline]);

  // --- Finalization Logic (for text outline) ---
  const { complete, isLoading: isFinalizationLoading, error: finalizationError } = useCompletion({
    api: '/api/ai-writer/outline/generate',
    onFinish: (_, finalCompletion) => {
      setOutline(finalCompletion);
      setIsFinalizing(false);
    },
    onError: (err) => {
      console.error("Outline finalization error:", err);
      setIsFinalizing(false);
    }
  });

  const handleFinalize = useCallback(async () => {
    if (!activeStoryId) return;
    const chatHistoryKey = `shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.OUTLINE_CHAT_HISTORY}`;
    let historyToFinalize: Message[] = [];
    const storedHistory = localStorage.getItem(chatHistoryKey);
     if (storedHistory) {
       try { historyToFinalize = JSON.parse(storedHistory); } catch (e) { console.error("Failed to parse chat history", e); }
     }
    if (historyToFinalize.length === 0) { alert('Chat history is empty.'); return; }
    if (!worldDescription || !characterProfiles) { alert('World/Character context missing.'); return; }
    setIsFinalizing(true);
    await complete('', { body: {
        messages: historyToFinalize, worldContext: worldDescription,
        characterContext: characterProfiles, numChapters: numChapters
    }});
  }, [activeStoryId, worldDescription, characterProfiles, numChapters, complete]);

  // Save & Proceed Handler
  const handleSaveAndProceed = async () => {
      if (!activeStoryId) return;
      setIsSaving(true);
      try {
        await handleSaveMindMap(); // Always save mind map
        const outlineResponse = await fetch('/api/story-data/outline', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                storyId: activeStoryId,
                outline: outline,
                numChapters: numChapters
            }),
        });
        if (!outlineResponse.ok) {
            throw new Error((await outlineResponse.json()).error || 'Failed to save outline data');
        }
        console.log('Outline data saved to database successfully.');
        router.push('/write');
      } catch (error: any) {
        console.error('Error saving data and proceeding:', error);
        alert(`Error saving data: ${error.message}`);
      } finally {
        setIsSaving(false);
      }
  };

  // --- Mind Map Specific Functions ---
  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleSaveMindMap = useCallback(async () => {
    if (!activeStoryId) return;
    setIsSavingMindMap(true);
    try {
        const flowData = { nodes, edges };
        const response = await fetch('/api/story-data/mindmap', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storyId: activeStoryId, mindMapData: flowData }),
        });
        if (!response.ok) {
            throw new Error((await response.json()).error || 'Failed to save mind map data');
        }
        console.log('Mind map data saved successfully.');
    } catch (error: any) {
        console.error('Error saving mind map data:', error);
        alert(`Error saving mind map: ${error.message}`);
    } finally {
        setIsSavingMindMap(false);
    }
  }, [activeStoryId, nodes, edges]);

  const addNode = useCallback(() => {
    const newNodeId = `node_${Date.now()}`;
    const newNode: Node = {
      id: newNodeId, type: 'default', data: { label: 'New Node' },
      position: { x: Math.random() * 250, y: Math.random() * 250 },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  // Fit view effect
  useEffect(() => {
    if (rfInstance && nodes.length > 0 && viewMode === 'mindmap') {
      rfInstance.fitView({ padding: 0.2 });
    }
  }, [rfInstance, nodes, viewMode]);

  // --- Mind Map Generation Handler ---
  const handleGenerateMindMap = useCallback(async () => {
    if (!activeStoryId || !worldDescription || !characterProfiles || !outline) {
        alert('World, Character, and Outline context are required to generate a mind map.');
        return;
    }
    setIsGeneratingMindMap(true);
    setGenerationError(null);
    try {
        const response = await fetch('/api/ai-writer/mindmap/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                worldContext: worldDescription,
                characterContext: characterProfiles,
                outlineContext: outline,
            }),
        });

        if (!response.ok) {
            // Try to parse error JSON from the API
            let errorDetails = `Failed to generate mind map: ${response.statusText}`;
            try {
                const errorJson = await response.json();
                if (errorJson && errorJson.error) {
                    errorDetails = errorJson.error;
                }
            } catch (e) { /* Ignore parsing error, use status text */ }
            throw new Error(errorDetails);
        }

        // API now returns JSON directly, not a stream
        let rawResponseText = ''; // Variable to store raw text
        try {
            rawResponseText = await response.text(); // Read raw text first
            const parsedData = JSON.parse(rawResponseText); // Parse the raw text

            if (parsedData && Array.isArray(parsedData.nodes) && Array.isArray(parsedData.edges)) {
                 const initialNodes = parsedData.nodes.map((node: Node) => ({
                    ...node,
                    position: node.position || { x: Math.random() * 400, y: Math.random() * 400 },
                 }));
                setNodes(initialNodes);
                setEdges(parsedData.edges);
                // Optionally save immediately after generation
                // await handleSaveMindMap();
            } else {
                throw new Error('Invalid JSON structure received from AI.');
            }
        } catch (parseError: any) {
            // Log the raw text that failed to parse
            console.error("Failed to parse mind map JSON:", parseError, "Received:", rawResponseText);
            setGenerationError(`Failed to parse AI response: ${parseError.message}`);
        }

    } catch (error: any) {
        console.error('Error generating mind map:', error);
        setGenerationError(`Generation failed: ${error.message}`);
    } finally {
        setIsGeneratingMindMap(false);
    }
  }, [activeStoryId, worldDescription, characterProfiles, outline, setNodes, setEdges]);

  // --- End Mind Map Specific Functions ---

  // Loading state display
  if (isLoadingData && activeStoryId) {
    return <StageLayout><div>Loading story data...</div></StageLayout>;
  }

  // Main component return
  return (
    <StageLayout>
      {(!worldDescription || !characterProfiles) && activeStoryId && !isLoadingData && (
        <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-md">
          <strong>Warning:</strong> World or Character context missing. Please complete previous stages.
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
              type="number" id="numChapters" value={numChapters}
              onChange={(e) => setNumChapters(Math.max(1, parseInt(e.target.value, 10) || 1))}
              min="1" className="w-20 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={!activeStoryId || isSaving || isFinalizing || isLoadingData}
            />
          </div>
          {activeStoryId && (
            <ChatInterface
              apiEndpoint="/api/ai-writer/outline/chat"
              title="Brainstorm Outline"
              placeholder="Discuss plot points, character arcs, and structure..."
              systemPromptContext={{ worldContext: worldDescription, characterContext: characterProfiles, numChapters: numChapters }}
              localStorageKey={`shadowquill_story_data_${activeStoryId}_${STORY_DATA_KEYS.OUTLINE_CHAT_HISTORY}`}
              storyId={activeStoryId}
            />
          )}
          <button
            onClick={handleFinalize}
            disabled={!activeStoryId || isFinalizing || isFinalizationLoading || !worldDescription || !characterProfiles || isLoadingData}
            className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {isFinalizing || isFinalizationLoading ? 'Finalizing...' : `Finalize ${numChapters}-Chapter Outline`}
          </button>
          {finalizationError && (<p className="text-red-500 mt-2">Error finalizing: {finalizationError.message}</p>)}
        </div>

        {/* Right Side: Outline / Mind Map View */}
        <div>
          {/* View Mode Toggle */}
          <div className="flex justify-center mb-4 border-b pb-2">
            <button
              onClick={() => setViewMode('outline')}
              className={`px-4 py-2 rounded-l-md font-medium ${viewMode === 'outline' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              disabled={!activeStoryId || isLoadingData || isGeneratingMindMap}
            >
              Outline Text
            </button>
            <button
              onClick={() => setViewMode('mindmap')}
              className={`px-4 py-2 rounded-r-md font-medium ${viewMode === 'mindmap' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              disabled={!activeStoryId || isLoadingData || isGeneratingMindMap}
            >
              Mind Map
            </button>
          </div>

          {/* Conditional Rendering */}
          {viewMode === 'outline' ? (
            <>
              <h2 className="text-xl font-semibold mb-2">Final Book Outline (Text)</h2>
              <textarea
                value={isFinalizing || isFinalizationLoading ? 'Generating...' : outline}
                onChange={(e) => setOutline(e.target.value)}
                placeholder="The finalized book outline will appear here after generation..."
                rows={25}
                className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white whitespace-pre-wrap"
                readOnly={!activeStoryId || isFinalizing || isFinalizationLoading || isSaving || isLoadingData}
              />
              <button
                onClick={handleSaveAndProceed}
                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                disabled={!activeStoryId || isSaving || isFinalizing || isFinalizationLoading || !outline || parsedChapters.length === 0 || isLoadingData}
              >
                {isSaving ? 'Saving...' : 'Save & Proceed to Write'}
              </button>
              <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded max-h-60 overflow-y-auto">
                <h3 className="font-semibold mb-2">Parsed Chapters ({parsedChapters.length})</h3>
                {parsedChapters.length > 0 ? (
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {parsedChapters.map(ch => <li key={ch.chapterNumber}>Ch {ch.chapterNumber}: {ch.title}</li>)}
                  </ul>
                ) : (<p className="text-sm text-gray-500">{isLoadingData ? 'Loading...' : 'No chapters parsed yet.'}</p>)}
              </div>
            </>
          ) : (
             <>
               <h2 className="text-xl font-semibold mb-2">Story Mind Map</h2>
               {generationError && (<p className="text-red-500 mb-2 text-center">Error generating map: {generationError}</p>)}
               {/* Use the memoized MindMapComponent defined outside */}
               <MindMapComponent
                 nodes={nodes}
                 edges={edges}
                 onNodesChange={onNodesChange}
                 onEdgesChange={onEdgesChange}
                 onConnect={onConnect}
                 setRfInstance={setRfInstance}
                 addNode={addNode}
                 handleSaveMindMap={handleSaveMindMap}
                 handleGenerateMindMap={handleGenerateMindMap} // Pass handler
                 activeStoryId={activeStoryId}
                 isLoadingData={isLoadingData}
                 isSavingMindMap={isSavingMindMap}
                 isGeneratingMindMap={isGeneratingMindMap}
                 // Pass context needed for disabling generate button inside MindMapComponent
                 worldDescription={worldDescription}
                 characterProfiles={characterProfiles}
                 outline={outline}
               />
               <button
                 onClick={handleSaveAndProceed}
                 className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                 disabled={!activeStoryId || isSaving || isFinalizing || isFinalizationLoading || isLoadingData || nodes.length === 0 || isGeneratingMindMap}
                 title={nodes.length === 0 ? "Create/Save mind map nodes first" : "Save current state and proceed"}
               >
                 {isSaving ? 'Saving...' : 'Proceed to Write (Using Mind Map)'}
               </button>
             </>
          )}
        </div>
      </div>
    </StageLayout>
  );
}

// Export the component wrapped in the provider
export default function OutlineCreationPage() {
    return (
        <ReactFlowProvider>
            <OutlineCreationPageContent />
        </ReactFlowProvider>
    );
}
