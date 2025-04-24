'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Import useMemo
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
  // Needed for state/handlers
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Viewport,
  type ReactFlowInstance,
} from 'reactflow';

import 'reactflow/dist/style.css';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

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
  onNodesChange: (changes: NodeChange[]) => void; // Use specific type
  onEdgesChange: (changes: EdgeChange[]) => void; // Use specific type
  onConnect: (connection: Connection) => void; // Use specific type
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onNodeDoubleClick: (event: React.MouseEvent, node: Node) => void; // Add double click handler prop
  setRfInstance: (instance: ReactFlowInstance | null) => void; // Use specific type
  addNode: () => void;
  handleSaveMindMap: () => Promise<void>;
  activeStoryId: string | null;
  isLoadingData: boolean;
  isSavingMindMap: boolean;
  isGeneratingMindMap: boolean;
  isAddingEdge: boolean;
  toggleAddEdgeMode: () => void;
  sourceNodeForEdge: string | null;
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
  isAddingEdge, toggleAddEdgeMode, sourceNodeForEdge,
  worldDescription, characterProfiles, outline,
  onNodeClick, onNodeDoubleClick // Destructure double click handler
}) => {

  // Highlight source node when adding edge
  const highlightedNodes = useMemo(() => {
    if (!isAddingEdge || !sourceNodeForEdge) return nodes;
    return nodes.map(node => {
      if (node.id === sourceNodeForEdge) {
        // Apply highlighting style
        return { ...node, style: { ...node.style, border: '2px solid red', boxShadow: '0 0 5px red' } };
      }
      // Ensure non-highlighted nodes don't retain the style if source changes
      return { ...node, style: { ...node.style, border: undefined, boxShadow: undefined } };
    });
  }, [nodes, isAddingEdge, sourceNodeForEdge]);


  return (
    <div style={{ height: '600px' }} className="border rounded-md relative bg-gray-50 dark:bg-gray-800">
      <ReactFlow
        nodes={highlightedNodes} // Use highlighted nodes
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick} // Add double click handler
        onInit={setRfInstance}
        fitView
        fitViewOptions={fitViewOptions} // Use the constant object
        className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-800 dark:via-gray-900 dark:to-black"
      >
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
      {/* Buttons Container */}
      <div className="absolute bottom-4 left-4 z-10 flex space-x-2">
        {/* Add Node Button */}
        <button
          onClick={addNode}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-3 rounded text-sm shadow"
          disabled={!activeStoryId || isLoadingData || isSavingMindMap || isGeneratingMindMap || isAddingEdge}
          title={isAddingEdge ? "Finish adding edge first" : "Add a new node"}
        >
          + Add Node
        </button>
        {/* Add Edge Button */}
        <button
          onClick={toggleAddEdgeMode}
          className={`font-semibold py-1 px-3 rounded text-sm shadow ${isAddingEdge ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-purple-500 hover:bg-purple-600 text-white'}`}
          disabled={!activeStoryId || isLoadingData || isSavingMindMap || isGeneratingMindMap}
        >
          {isAddingEdge ? (sourceNodeForEdge ? 'Select Target Node' : 'Select Source Node (Click Cancel to exit)') : '+ Add Edge'}
        </button>
         {isAddingEdge && (
            <button
                onClick={toggleAddEdgeMode} // Re-use toggle to cancel
                className="bg-gray-400 hover:bg-gray-500 text-white font-semibold py-1 px-3 rounded text-sm shadow"
                title="Cancel adding edge"
            >
                Cancel
            </button>
         )}
      </div>
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
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // --- Mind Map State ---
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [viewMode, setViewMode] = useState<'outline' | 'mindmap'>('outline');
  const [isSavingMindMap, setIsSavingMindMap] = useState<boolean>(false);
  const [isGeneratingMindMap, setIsGeneratingMindMap] = useState<boolean>(false); // Added
  const [generationError, setGenerationError] = useState<string | null>(null); // Added
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null); // Use specific type
  const [isAddingEdge, setIsAddingEdge] = useState<boolean>(false); // State for edge adding mode
  const [sourceNodeForEdge, setSourceNodeForEdge] = useState<string | null>(null); // State for source node ID

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
      console.log("handleSaveAndProceed called"); // Log start
      setIsSaving(true);
      let mindMapSaved = false;
      let outlineSaved = false;
      try {
        console.log("Attempting to save mind map...");
        await handleSaveMindMap(); // Always save mind map
        mindMapSaved = true; // Assume success if no error thrown
        console.log("Mind map save completed successfully.");

        console.log("Attempting to save outline text...");
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
            const errorBody = await outlineResponse.text(); // Get raw error body
            console.error("Outline save failed. Status:", outlineResponse.status, "Body:", errorBody);
            throw new Error(`Failed to save outline data: ${outlineResponse.statusText}`);
        }

        const outlineResult = await outlineResponse.json(); // Parse JSON only if response is ok
        outlineSaved = true; // Mark as saved successfully
        console.log('Outline data saved to database successfully:', outlineResult);

        // Only navigate if both saves were successful
        if (mindMapSaved && outlineSaved) {
            console.log("Both saves successful. Attempting navigation to /write...");
            router.push('/write');
            console.log("Navigation to /write requested."); // Log after push request
        } else {
             console.log("One or both save operations failed. Navigation skipped.");
        }

      } catch (error: any) {
        // This catch block will now catch errors from handleSaveMindMap OR the outline fetch
        console.error('Error saving data and proceeding:', error);
        alert(`Error saving data: ${error.message}`); // Show specific error
      } finally {
        console.log("handleSaveAndProceed finished."); // Log end
        setIsSaving(false);
      }
  };

  // Download Word-format document of final outline
  const handleDownloadOutline = () => {
    const element = document.getElementById('outlinePreview'); if (!element) return;
    const html = element.innerHTML;
    const header = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Book Outline</title></head><body>';
    const footer = '</body></html>';
    const source = header + html + footer;
    const blob = new Blob(['\ufeff', source], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'book_outline.doc'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  // --- Mind Map Specific Functions ---
  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleSaveMindMap = useCallback(async () => {
    if (!activeStoryId) return;
    setIsSavingMindMap(true);
    console.log("Saving mind map data..."); // Log start of save
    try {
        // Get current viewport from instance to save it
        const viewport = rfInstance?.getViewport();
        const flowData = { nodes, edges, viewport }; // Include viewport
        const response = await fetch('/api/story-data/mindmap', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storyId: activeStoryId, mindMapData: flowData }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Mind map save failed. Status:", response.status, "Body:", errorBody);
            throw new Error(`Failed to save mind map data: ${response.statusText}`); // Re-throw to be caught by caller
        }
        const result = await response.json();
        console.log('Mind map data saved successfully:', result);
    } catch (error: any) {
        console.error('Error saving mind map data:', error);
        alert(`Error saving mind map: ${error.message}`); // Show alert specifically for mind map save error
        throw error; // Re-throw error so handleSaveAndProceed knows it failed
    } finally {
        setIsSavingMindMap(false);
        console.log("Mind map save finished."); // Log end of save
     }
   }, [activeStoryId, nodes, edges, rfInstance]); // Add rfInstance dependency

  // Toggle edge adding mode
  const toggleAddEdgeMode = useCallback(() => {
    setIsAddingEdge(prev => !prev);
    setSourceNodeForEdge(null); // Reset source node when toggling mode
  }, []);

  // Handle node clicks for edge creation
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (!isAddingEdge) return; // Do nothing if not in edge adding mode

    if (!sourceNodeForEdge) {
      // First click: set source node
      setSourceNodeForEdge(node.id);
    } else if (sourceNodeForEdge !== node.id) { // Prevent self-connection
      // Second click: create edge and exit mode
      const edgeId = `edge_${sourceNodeForEdge}-${node.id}_${Date.now()}`;
      const newEdge: Edge = { id: edgeId, source: sourceNodeForEdge, target: node.id, type: 'default' /* or custom */ };
      setEdges((eds) => addEdge(newEdge, eds));
      setSourceNodeForEdge(null);
      setIsAddingEdge(false);
    }
    // If clicking the same node again, do nothing (or could cancel source selection)
  }, [isAddingEdge, sourceNodeForEdge, setEdges]);

  // Handle node double-click for editing label
  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    const currentLabel = node.data.label || '';
    const newLabel = window.prompt('Enter new node label:', currentLabel);

    if (newLabel !== null && newLabel !== currentLabel) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            // it's important to create a new object here, to inform React Flow about the change
            n.data = { ...n.data, label: newLabel };
          }
          return n;
        })
      );
    }
  }, [setNodes]);


  const addNode = useCallback(() => {
    if (isAddingEdge) return; // Don't add node while adding edge
    // Get viewport center (or use default if instance not ready)
    const viewport: Viewport = rfInstance?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
    // Project viewport center to flow coordinates
    const position = rfInstance?.project({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
    }) ?? { x: 100, y: 100 }; // Fallback position

    const newNodeId = `node_${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: 'default', // Or use a custom node type if defined
      data: { label: 'New Node' },
      position: position, // Use projected position
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes, rfInstance, isAddingEdge]); // Add rfInstance and isAddingEdge dependency

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
                    // Ensure position exists, provide default if missing from AI
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
              <div className="flex space-x-2 mb-2">
                <button onClick={() => setIsEditMode(prev => !prev)} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded">
                  {isEditMode ? 'Preview' : 'Edit'}
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto mb-4">
              {isEditMode ? (
                <textarea
                  value={outline}
                  onChange={(e) => setOutline(e.target.value)}
                  rows={25}
                  className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white whitespace-pre-wrap"
                  disabled={isFinalizing || isFinalizationLoading || isSaving || isLoadingData}
                />
              ) : isFinalizing || isFinalizationLoading ? (
                <div className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">Generating...</div>
              ) : (
                <div id="outlinePreview" className="prose dark:prose-dark max-w-none whitespace-pre-wrap">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{outline}</ReactMarkdown>
                </div>
              )}
              </div>
              <button
                onClick={handleSaveAndProceed}
                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                disabled={!activeStoryId || isSaving || isFinalizing || isFinalizationLoading || !outline || parsedChapters.length === 0 || isLoadingData}
              >
                {isSaving ? 'Saving...' : 'Save & Proceed to Write'}
              </button>
              <button
                onClick={handleDownloadOutline}
                className="mt-2 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
                disabled={!outline}
              >
                Download .doc
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
                 isAddingEdge={isAddingEdge} // Pass state
                 toggleAddEdgeMode={toggleAddEdgeMode} // Pass handler
                 sourceNodeForEdge={sourceNodeForEdge} // Pass state
                 onNodeClick={onNodeClick} // Pass handler
                 onNodeDoubleClick={onNodeDoubleClick} // Pass handler
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
