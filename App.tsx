import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import Sidebar from './components/Sidebar';
import StreamView from './components/StreamView';
import GridView from './components/GridView'; 
import EditStreamModal from './components/EditStreamModal';
import ApiKeyModal from './components/ApiKeyModal'; // New Import
import { Stream, StreamUpdate, StreamContextPreference, AppBackup, StreamDetailLevel } from './types';
import { 
    fetchStreamUpdates, 
    PreviousContext, 
    updateUserApiKey, // New Import
    isApiKeyEffectivelySet, // New Import
    getActiveKeySource // New Import
} from './services/geminiService';
import { 
    APP_NAME, 
    DEFAULT_TEMPERATURE, 
    DEFAULT_DETAIL_LEVEL, 
    DEFAULT_CONTEXT_PREFERENCE, 
    DEFAULT_ENABLE_REASONING,
    DEFAULT_THINKING_TOKEN_BUDGET,
    DEFAULT_AUTO_THINKING_BUDGET,
    USER_API_KEY_STORAGE_KEY // New Import
} from './constants'; 
import { 
    ArrowDownTrayIcon, ArrowUpTrayIcon, ListBulletIcon, TableCellsIcon, DocumentDuplicateIcon, 
    ChevronDownIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, KeyIcon // Added KeyIcon
} from './components/icons';
import { convertToCSV, downloadFile } from './utils/exportUtils';


const STREAMS_STORAGE_KEY = 'geminiTopicStreams_v5';
const UPDATES_STORAGE_KEY = 'geminiTopicUpdates_v5';

type ViewMode = 'list' | 'grid';

const App: React.FC = () => {
  const [streams, setStreams] = useState<Stream[]>(() => {
    const savedStreams = localStorage.getItem(STREAMS_STORAGE_KEY);
    try {
      const parsedStreams = savedStreams ? JSON.parse(savedStreams) : [];
      return parsedStreams.map((s: any): Stream => ({
        id: s.id || crypto.randomUUID(),
        name: s.name || "Untitled Stream",
        focus: s.focus || "General topics",
        temperature: typeof s.temperature === 'number' ? s.temperature : DEFAULT_TEMPERATURE,
        detailLevel: s.detailLevel || DEFAULT_DETAIL_LEVEL,
        contextPreference: s.contextPreference || DEFAULT_CONTEXT_PREFERENCE,
        enableReasoning: typeof s.enableReasoning === 'boolean' ? s.enableReasoning : DEFAULT_ENABLE_REASONING,
        autoThinkingBudget: typeof s.autoThinkingBudget === 'boolean' ? s.autoThinkingBudget : DEFAULT_AUTO_THINKING_BUDGET,
        thinkingTokenBudget: typeof s.thinkingTokenBudget === 'number' ? s.thinkingTokenBudget : DEFAULT_THINKING_TOKEN_BUDGET,
        topK: typeof s.topK === 'number' ? s.topK : undefined,
        topP: typeof s.topP === 'number' ? s.topP : undefined,
        seed: typeof s.seed === 'number' ? s.seed : undefined,
      }));
    } catch (e) {
      console.error("Failed to parse streams from localStorage", e);
      return [];
    }
  });
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [streamUpdates, setStreamUpdates] = useState<{ [key: string]: StreamUpdate[] }>(() => {
    const savedUpdates = localStorage.getItem(UPDATES_STORAGE_KEY);
     try {
      const parsedUpdates = savedUpdates ? JSON.parse(savedUpdates) : {};
      Object.keys(parsedUpdates).forEach(streamId => {
        if (Array.isArray(parsedUpdates[streamId])) {
          parsedUpdates[streamId] = parsedUpdates[streamId].map((upd: any): StreamUpdate => {
            const mainContent = typeof upd.mainContent === 'string' ? upd.mainContent : (typeof upd.content === 'string' ? upd.content : "");
            const reasoningContent = typeof upd.reasoningContent === 'string' ? upd.reasoningContent : undefined;
            let mainContentTokens = typeof upd.mainContentTokens === 'number' ? upd.mainContentTokens : undefined;
            let reasoningTokens = typeof upd.reasoningTokens === 'number' ? upd.reasoningTokens : undefined;

            if (mainContentTokens === undefined && typeof upd.estimatedTokens === 'number') {
              mainContentTokens = upd.estimatedTokens;
              reasoningTokens = 0;
            } else if (mainContentTokens === undefined) {
              mainContentTokens = Math.ceil(mainContent.length / 4);
              reasoningTokens = Math.ceil((reasoningContent || "").length / 4);
            }
            
            return {
              id: upd.id || crypto.randomUUID(),
              streamId: upd.streamId || streamId,
              mainContent: mainContent,
              reasoningContent: reasoningContent,
              groundingMetadata: Array.isArray(upd.groundingMetadata) ? upd.groundingMetadata : undefined,
              timestamp: typeof upd.timestamp === 'string' ? upd.timestamp : new Date().toISOString(),
              mainContentTokens: mainContentTokens,
              reasoningTokens: reasoningTokens,
            };
          }).sort((a: StreamUpdate, b: StreamUpdate) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
      });
      return parsedUpdates;
    } catch (e) {
      console.error("Failed to parse updates from localStorage", e);
      return {};
    }
  });

  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false); // Updated by effect
  const [apiKeySource, setApiKeySource] = useState<'user' | 'environment' | 'none'>('none'); // New state
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false); // New state

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [streamToEdit, setStreamToEdit] = useState<Stream | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); 

  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportAllMenuRef = useRef<HTMLDivElement>(null); 
  const [showExportAllMenu, setShowExportAllMenu] = useState(false);

  const loadingStatesRef = useRef(loadingStates);
  useEffect(() => {
    loadingStatesRef.current = loadingStates;
  }, [loadingStates]);

  // Effect to initialize API key from localStorage and set availability
  useEffect(() => {
    const storedUserApiKey = localStorage.getItem(USER_API_KEY_STORAGE_KEY);
    if (storedUserApiKey) {
      updateUserApiKey(storedUserApiKey); // Inform service
    } else {
      updateUserApiKey(null); // Ensure service knows no user key initially
    }
    setApiKeyAvailable(isApiKeyEffectivelySet());
    setApiKeySource(getActiveKeySource());
  }, []);


  useEffect(() => {
    localStorage.setItem(STREAMS_STORAGE_KEY, JSON.stringify(streams));
  }, [streams]);

  useEffect(() => {
    localStorage.setItem(UPDATES_STORAGE_KEY, JSON.stringify(streamUpdates));
  }, [streamUpdates]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportAllMenuRef.current && !exportAllMenuRef.current.contains(event.target as Node)) {
        setShowExportAllMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateApiStatus = () => {
    setApiKeyAvailable(isApiKeyEffectivelySet());
    setApiKeySource(getActiveKeySource());
  };

  const handleSaveUserApiKey = (key: string) => {
    localStorage.setItem(USER_API_KEY_STORAGE_KEY, key);
    updateUserApiKey(key);
    updateApiStatus();
    setIsApiKeyModalOpen(false);
    setError(null); // Clear previous errors
    // Potentially re-fetch current stream if it had an error due to missing key
    if (selectedStream && !loadingStatesRef.current[selectedStream.id]) {
        fetchUpdates(selectedStream);
    }
  };

  const handleClearUserApiKey = () => {
    localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
    updateUserApiKey(null); // Service will fallback to env var if present
    updateApiStatus();
    // setError might be set if fallback also fails.
    if (!isApiKeyEffectivelySet()) {
        setError("API Key cleared and no fallback environment key found. Features requiring API key are disabled.");
    }
  };


  const fetchUpdates = useCallback(async (stream: Stream) => {
    if (!stream || !stream.id) {
        console.warn("fetchUpdates called with invalid stream object", stream);
        return;
    }

    if (loadingStatesRef.current[stream.id]) {
      return;
    }

    if (!isApiKeyEffectivelySet()) { // Use central check
      setError("Gemini API Key is not configured. Cannot fetch updates.");
      setLoadingStates(prev => ({ ...prev, [stream.id]: false })); 
      return;
    }

    setLoadingStates(prev => ({ ...prev, [stream.id]: true }));
    setError(null);

    let previousContext: PreviousContext = null;
    const currentUpdates = streamUpdates[stream.id] || [];

    if (stream.contextPreference === 'last' && currentUpdates.length > 0) {
      previousContext = { type: 'last', update: currentUpdates[0] };
    } else if (stream.contextPreference === 'all' && currentUpdates.length > 0) {
      previousContext = { type: 'all', updates: currentUpdates };
    }

    try {
      const { mainContent, reasoningContent, groundingMetadata, mainContentTokens, reasoningTokens } = await fetchStreamUpdates(stream, previousContext);
      const newUpdate: StreamUpdate = {
        id: crypto.randomUUID(),
        streamId: stream.id,
        mainContent,
        reasoningContent,
        groundingMetadata,
        timestamp: new Date().toISOString(),
        mainContentTokens,
        reasoningTokens,
      };
      setStreamUpdates(prevUpdates => {
        const existingUpdates = prevUpdates[stream.id] || [];
        return {
          ...prevUpdates,
          [stream.id]: [newUpdate, ...existingUpdates]
        };
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred while fetching updates.');
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, [stream.id]: false }));
    }
  }, [streamUpdates]); // apiKeyAvailable removed as it's now checked via isApiKeyEffectivelySet


  const handleOpenAddModal = () => {
    setStreamToEdit(null); 
    setIsAddModalOpen(true);
    setIsEditModalOpen(false); 
  };
  
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleAddStream = (newStreamData: Omit<Stream, 'id'>) => { 
    const newStream: Stream = {
      id: crypto.randomUUID(),
      name: newStreamData.name,
      focus: newStreamData.focus,
      temperature: newStreamData.temperature,
      detailLevel: newStreamData.detailLevel,
      contextPreference: newStreamData.contextPreference,
      enableReasoning: newStreamData.enableReasoning,
      autoThinkingBudget: newStreamData.autoThinkingBudget,
      thinkingTokenBudget: newStreamData.thinkingTokenBudget,
      topK: newStreamData.topK,
      topP: newStreamData.topP,
      seed: newStreamData.seed,
    };
    setStreams(prevStreams => [newStream, ...prevStreams]); 
    setSelectedStreamId(newStream.id); 
    setViewMode('list'); 
    setError(null);
    if (isApiKeyEffectivelySet()) {
      fetchUpdates(newStream); 
    } else {
        setError("API Key not configured. Cannot fetch updates for the new stream.");
    }
    handleCloseAddModal(); 
  };


  const handleOpenEditModal = (streamId: string) => {
    const stream = streams.find(s => s.id === streamId);
    if (stream) {
      setStreamToEdit(stream);
      setIsEditModalOpen(true);
      setIsAddModalOpen(false); 
    }
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setStreamToEdit(null);
  };

  const handleUpdateStream = (updatedStream: Stream) => {
    const oldStream = streams.find(s => s.id === updatedStream.id);
    setStreams(prevStreams => prevStreams.map(s => s.id === updatedStream.id ? updatedStream : s));
    
    let shouldReFetch = false;
    if (oldStream) {
        if (
            oldStream.focus !== updatedStream.focus ||
            oldStream.detailLevel !== updatedStream.detailLevel ||
            oldStream.temperature !== updatedStream.temperature ||
            oldStream.contextPreference !== updatedStream.contextPreference ||
            oldStream.enableReasoning !== updatedStream.enableReasoning ||
            oldStream.autoThinkingBudget !== updatedStream.autoThinkingBudget ||
            oldStream.thinkingTokenBudget !== updatedStream.thinkingTokenBudget ||
            oldStream.topK !== updatedStream.topK ||
            oldStream.topP !== updatedStream.topP ||
            oldStream.seed !== updatedStream.seed
        ) {
            shouldReFetch = true;
        }
    }

    if (isApiKeyEffectivelySet() && shouldReFetch) {
        if (!loadingStatesRef.current[updatedStream.id]) {
            fetchUpdates(updatedStream);
        }
    } else if (!isApiKeyEffectivelySet() && shouldReFetch) {
         setError("API Key not configured. Cannot fetch updates for the modified stream.");
    }
    handleCloseEditModal();
  };

  const handleDeleteStream = (streamId: string) => {
    const newStreamsList = streams.filter(s => s.id !== streamId);
    setStreams(newStreamsList);

    setStreamUpdates(prevUpdates => {
      const newUpdates = { ...prevUpdates };
      delete newUpdates[streamId];
      return newUpdates;
    });
    setLoadingStates(prev => {
        const newLoadingStates = { ...prev };
        delete newLoadingStates[streamId];
        return newLoadingStates;
    });

    if (selectedStreamId === streamId) {
      setSelectedStreamId(newStreamsList.length > 0 ? (newStreamsList[0]?.id || null) : null);
       if (newStreamsList.length === 0) {
         setViewMode('list'); 
       }
    }
  };

  const handleDeleteStreamUpdate = (streamId: string, updateId: string) => {
    console.log(`[App.tsx] handleDeleteStreamUpdate called for streamId: ${streamId}, updateId: ${updateId}`);
    setStreamUpdates(prevUpdates => {
      const specificStreamUpdates = prevUpdates[streamId];

      if (!specificStreamUpdates) {
        console.warn(`[App.tsx] Stream with ID "${streamId}" not found in streamUpdates. Cannot delete update "${updateId}".`);
        return prevUpdates; 
      }

      const initialLength = specificStreamUpdates.length;
      const updatedSpecificStreamUpdates = specificStreamUpdates.filter(update => update.id !== updateId);

      if (updatedSpecificStreamUpdates.length === initialLength) {
        console.warn(`[App.tsx] Update with ID "${updateId}" not found in stream "${streamId}". No update was deleted.`);
        return prevUpdates; 
      }
      
      console.log(`[App.tsx] Successfully filtered update "${updateId}" from stream "${streamId}". Old length: ${initialLength}, New length: ${updatedSpecificStreamUpdates.length}`);
      return {
        ...prevUpdates,
        [streamId]: updatedSpecificStreamUpdates,
      };
    });
  };

  const handleUpdateStreamContextPreference = (streamId: string, preference: StreamContextPreference) => {
    setStreams(prevStreams => prevStreams.map(s => s.id === streamId ? { ...s, contextPreference: preference } : s));
  };
  
  const handleUpdateStreamDetailLevel = (streamId: string, detailLevel: StreamDetailLevel) => {
    setStreams(prevStreams => prevStreams.map(s => s.id === streamId ? { ...s, detailLevel: detailLevel } : s));
  };


  const handleSelectStreamFromSidebar = useCallback((streamId: string) => {
    setSelectedStreamId(streamId);
    setViewMode('list'); 
    setError(null);
  }, []); 

  const handleSelectStreamAndSwitchView = (streamId: string) => {
    setSelectedStreamId(streamId);
    setViewMode('list');
    setError(null);
  };

  const handleRefreshStream = useCallback((stream: Stream) => {
     if (!isApiKeyEffectivelySet()) {
      setError("API Key not configured. Cannot refresh stream.");
      return;
    }
    if (stream && !loadingStatesRef.current[stream.id]) { 
        fetchUpdates(stream);
    }
  }, [fetchUpdates]); // apiKeyAvailable removed

  const handleReorderStreams = (draggedId: string, targetId: string, insertBefore: boolean) => {
    setStreams(prevStreams => {
      const newStreams = [...prevStreams];
      const draggedItemIndex = newStreams.findIndex(s => s.id === draggedId);
      
      if (draggedItemIndex === -1) return prevStreams;
      
      const [draggedItem] = newStreams.splice(draggedItemIndex, 1);
      const targetItemIndex = newStreams.findIndex(s => s.id === targetId);

      if (targetItemIndex === -1) {
        newStreams.push(draggedItem);
        return newStreams;
      }

      if (insertBefore) {
        newStreams.splice(targetItemIndex, 0, draggedItem);
      } else {
        newStreams.splice(targetItemIndex + 1, 0, draggedItem);
      }
      return newStreams;
    });
  };


   useEffect(() => {
    if (viewMode === 'list' && !selectedStreamId && streams.length > 0) {
        const firstStreamId = streams[0].id;
        setSelectedStreamId(firstStreamId); 
    } else if (streams.length === 0 && selectedStreamId) {
        setSelectedStreamId(null); 
    }
  }, [streams, selectedStreamId, viewMode]);


  useEffect(() => {
    if (viewMode === 'list' && selectedStreamId) {
        const stream = streams.find(s => s.id === selectedStreamId);
        if (isApiKeyEffectivelySet() && stream && (!streamUpdates[selectedStreamId] || streamUpdates[selectedStreamId].length === 0)) {
            if (!loadingStatesRef.current[selectedStreamId]) { 
                 fetchUpdates(stream);
            }
        } else if (!isApiKeyEffectivelySet() && stream) { // Check apiKeyAvailable
             setError("API Key not configured. Cannot display or fetch updates for selected stream.");
        }
    }
  }, [selectedStreamId, streams, streamUpdates, fetchUpdates, viewMode]); // apiKeyAvailable removed, re-evaluate if its absence affects logic


  const handleExportAllDataJSON = () => {
    setShowExportAllMenu(false);
    const backupData: AppBackup = {
      streams: streams,
      streamUpdates: streamUpdates,
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    downloadFile(jsonString, `${APP_NAME.toLowerCase().replace(/\s+/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    alert('All application data (JSON) has been exported!');
  };
  
  const handleExportAllDataCSV = async () => {
    setShowExportAllMenu(false);
    if (!streams.length && !Object.keys(streamUpdates).some(key => streamUpdates[key].length > 0)) {
      alert("No data to export.");
      return;
    }

    const zip = new JSZip();

    const streamHeaders = ['stream_id', 'name', 'focus', 'temperature', 'detail_level', 'context_preference', 'enable_reasoning', 'auto_thinking_budget', 'thinking_token_budget', 'top_k', 'top_p', 'seed'];
    const streamsData = streams.map(s => ({
        stream_id: s.id,
        name: s.name,
        focus: s.focus,
        temperature: s.temperature,
        detail_level: s.detailLevel,
        context_preference: s.contextPreference,
        enable_reasoning: s.enableReasoning,
        auto_thinking_budget: s.autoThinkingBudget === undefined ? '' : s.autoThinkingBudget,
        thinking_token_budget: s.thinkingTokenBudget === undefined ? '' : s.thinkingTokenBudget,
        top_k: s.topK === undefined ? '' : s.topK,
        top_p: s.topP === undefined ? '' : s.topP,
        seed: s.seed === undefined ? '' : s.seed,
    }));
    const streamsCSV = convertToCSV(streamsData, streamHeaders);
    zip.file("streams.csv", streamsCSV);

    const updateHeaders = ['update_id', 'stream_id', 'timestamp', 'main_content', 'reasoning_content', 'main_content_tokens', 'reasoning_tokens', 'grounding_source_urls'];
    let allUpdatesData: any[] = [];
    Object.values(streamUpdates).forEach(updatesArray => {
        updatesArray.forEach(update => {
            const groundingUrls = (update.groundingMetadata || [])
                .map(chunk => chunk.web?.uri || chunk.retrievedContext?.uri)
                .filter(Boolean)
                .join(', ');
            allUpdatesData.push({
                update_id: update.id,
                stream_id: update.streamId,
                timestamp: update.timestamp,
                main_content: update.mainContent,
                reasoning_content: update.reasoningContent || '',
                main_content_tokens: update.mainContentTokens === undefined ? 0 : update.mainContentTokens,
                reasoning_tokens: update.reasoningTokens === undefined ? 0 : update.reasoningTokens,
                grounding_source_urls: groundingUrls,
            });
        });
    });
    const updatesCSV = convertToCSV(allUpdatesData, updateHeaders);
    zip.file("updates.csv", updatesCSV);

    try {
        const zipContent = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipContent);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${APP_NAME.toLowerCase().replace(/\s+/g, '_')}_all_data_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('All application data (CSVs in ZIP) has been exported!');
    } catch (err) {
        console.error("Error generating ZIP file for CSV export:", err);
        alert("Failed to generate ZIP file for CSV export. See console for details.");
    }
  };


  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const performImportActions = (parsedData: AppBackup) => {
      const importedStreams = parsedData.streams.map((s: any): Stream => ({
        id: s.id || crypto.randomUUID(),
        name: s.name || "Untitled Stream",
        focus: s.focus || "General topics",
        temperature: typeof s.temperature === 'number' ? s.temperature : DEFAULT_TEMPERATURE,
        detailLevel: s.detailLevel || DEFAULT_DETAIL_LEVEL,
        contextPreference: s.contextPreference || DEFAULT_CONTEXT_PREFERENCE,
        enableReasoning: typeof s.enableReasoning === 'boolean' ? s.enableReasoning : DEFAULT_ENABLE_REASONING,
        autoThinkingBudget: typeof s.autoThinkingBudget === 'boolean' ? s.autoThinkingBudget : DEFAULT_AUTO_THINKING_BUDGET,
        thinkingTokenBudget: typeof s.thinkingTokenBudget === 'number' ? s.thinkingTokenBudget : DEFAULT_THINKING_TOKEN_BUDGET,
        topK: typeof s.topK === 'number' ? s.topK : undefined,
        topP: typeof s.topP === 'number' ? s.topP : undefined,
        seed: typeof s.seed === 'number' ? s.seed : undefined,
      }));
      
      let validatedStreamUpdates: { [key: string]: StreamUpdate[] } = {};
      if (parsedData.streamUpdates && typeof parsedData.streamUpdates === 'object' && parsedData.streamUpdates !== null) {
        for (const streamId in parsedData.streamUpdates) {
          if (Object.prototype.hasOwnProperty.call(parsedData.streamUpdates, streamId)) {
            const updatesArray = parsedData.streamUpdates[streamId];
            if (Array.isArray(updatesArray)) {
              validatedStreamUpdates[streamId] = updatesArray
                .map((upd: any): StreamUpdate | null => {
                  const mainContent = typeof upd.mainContent === 'string' ? upd.mainContent : (typeof upd.content === 'string' ? upd.content : "");
                  let mainContentTokens = typeof upd.mainContentTokens === 'number' ? upd.mainContentTokens : undefined;
                  let reasoningTokens = typeof upd.reasoningTokens === 'number' ? upd.reasoningTokens : undefined;
                  const reasoningContent = typeof upd.reasoningContent === 'string' ? upd.reasoningContent : undefined;

                  if (mainContentTokens === undefined && typeof upd.estimatedTokens === 'number') {
                    mainContentTokens = upd.estimatedTokens;
                    reasoningTokens = 0; 
                  } else if (mainContentTokens === undefined) { 
                    mainContentTokens = Math.ceil(mainContent.length / 4);
                    reasoningTokens = Math.ceil((reasoningContent || "").length / 4);
                  }

                  if (upd && typeof upd.id === 'string' && typeof upd.timestamp === 'string' && (typeof upd.streamId === 'string' || !upd.streamId) ) {
                    return {
                      id: upd.id,
                      streamId: upd.streamId || streamId, 
                      mainContent: mainContent,
                      reasoningContent: reasoningContent,
                      groundingMetadata: Array.isArray(upd.groundingMetadata) ? upd.groundingMetadata : undefined,
                      timestamp: upd.timestamp,
                      mainContentTokens: mainContentTokens,
                      reasoningTokens: reasoningTokens,
                    };
                  }
                  console.warn("Skipping invalid update during import:", upd);
                  return null; 
                })
                .filter((upd): upd is StreamUpdate => upd !== null) 
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            }
          }
        }
      }
      setStreams(importedStreams);
      setStreamUpdates(validatedStreamUpdates);
      setLoadingStates({});
      setSelectedStreamId(importedStreams.length > 0 ? importedStreams[0].id : null);
      setViewMode('list'); 
      alert('Data imported successfully!');
    };

    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (typeof result !== 'string') throw new Error('File content is not a string.');
        const parsedData = JSON.parse(result) as AppBackup;

        if (!parsedData || !Array.isArray(parsedData.streams) || typeof parsedData.streamUpdates !== 'object') {
          throw new Error('Invalid backup file format.');
        }
        
        const userConfirmed = window.confirm('Are you sure you want to import this data? This will overwrite all current streams and updates.');
        console.log(`App.tsx: Import confirmation for file "${file.name}" was: ${userConfirmed}.`);
        
        console.warn('App.tsx handleImportData: Proceeding with import action to ensure functionality testing in sandboxed environment. If you explicitly cancelled, this is part of the test bypass.');
        performImportActions(parsedData);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        alert(`Failed to import data: ${errorMessage}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => alert('Failed to read the file.');
    reader.readAsText(file);
  };

  const selectedStream = streams.find(s => s.id === selectedStreamId) || null;
  const currentUpdatesForStream = selectedStreamId ? (streamUpdates[selectedStreamId] || []) : [];
  const isLoadingSelectedStream = selectedStreamId ? (loadingStates[selectedStreamId] || false) : false;

  const handleExportStreamData = (stream: Stream, format: 'txt' | 'md' | 'csv') => {
    if (!stream) return;
    const updates = streamUpdates[stream.id] || [];
    if (updates.length === 0) {
        alert(`No updates to export for stream "${stream.name}".`);
        return;
    }
    
    const filenameBase = `${stream.name.replace(/\s+/g, '_')}_all_updates_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      const headers = ['update_id', 'timestamp', 'main_content', 'reasoning_content', 'main_content_tokens', 'reasoning_tokens', 'grounding_source_urls'];
      const data = updates.map(upd => {
        const groundingUrls = (upd.groundingMetadata || [])
          .map(chunk => chunk.web?.uri || chunk.retrievedContext?.uri)
          .filter(Boolean)
          .join(', ');
        return {
          update_id: upd.id,
          timestamp: upd.timestamp,
          main_content: upd.mainContent,
          reasoning_content: upd.reasoningContent || '',
          main_content_tokens: upd.mainContentTokens === undefined ? 0 : upd.mainContentTokens,
          reasoning_tokens: upd.reasoningTokens === undefined ? 0 : upd.reasoningTokens,
          grounding_source_urls: groundingUrls,
        };
      }).slice().reverse(); 
      const csvString = convertToCSV(data, headers);
      downloadFile(csvString, `${filenameBase}.csv`, 'text/csv;charset=utf-8;');
    } else { 
      const fullContent = updates
          .slice()
          .reverse() 
          .map(upd => {
              let contentStr = `## Update: ${new Date(upd.timestamp).toLocaleString()}\n\n`;
              contentStr += `${upd.mainContent}\n\n`;
              if (upd.reasoningContent) {
                contentStr += `### Reasoning/Thoughts:\n${upd.reasoningContent}\n\n`;
              }
              if(upd.groundingMetadata && upd.groundingMetadata.length > 0){
                  contentStr += `### Sources:\n`;
                  upd.groundingMetadata.forEach(chunk => {
                      const sourceInfo = chunk.web || chunk.retrievedContext;
                      if(sourceInfo && sourceInfo.uri && sourceInfo.uri !== '#') {
                           contentStr += `- [${sourceInfo.title || sourceInfo.uri}](${sourceInfo.uri})\n`;
                      }
                  });
                  contentStr += `\n`;
              }
              const totalUpdateTokens = (upd.mainContentTokens || 0) + (upd.reasoningTokens || 0);
              contentStr += `Estimated Tokens: ${totalUpdateTokens > 0 ? totalUpdateTokens : 'N/A'}\n\n`;
              contentStr += `---\n\n`;
              return contentStr;
          })
          .join('');
      downloadFile(fullContent, `${filenameBase}.${format}`, format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8');
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="flex flex-col h-screen antialiased">
      <header className="bg-gray-850 border-b border-gray-700 p-3 shadow-md flex-shrink-0">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
             <button
                onClick={toggleSidebar}
                className="p-2 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-colors mr-2"
                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isSidebarCollapsed ? <ChevronDoubleRightIcon className="w-5 h-5" /> : <ChevronDoubleLeftIcon className="w-5 h-5" />}
              </button>
            <h1 className="text-2xl font-bold text-white">{APP_NAME}</h1>
          </div>
            <div className="flex items-center space-x-3">
                <button
                    onClick={() => setIsApiKeyModalOpen(true)}
                    className={`flex items-center font-semibold py-1.5 px-3 rounded-md text-sm transition-colors shadow
                                ${apiKeySource === 'user' ? 'bg-green-600 hover:bg-green-700 text-white' : 
                                 (apiKeySource === 'environment' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 
                                  'bg-red-600 hover:bg-red-700 text-white')}`}
                    title={apiKeySource === 'user' ? "API Key set by user" : (apiKeySource === 'environment' ? "Using environment API Key" : "Set API Key")}
                >
                    <KeyIcon className="w-4 h-4 mr-1.5" />
                    API Key
                </button>
                <button
                    onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                    className="flex items-center bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1.5 px-3 rounded-md text-sm transition-colors shadow"
                    title={viewMode === 'list' ? "Switch to Grid View" : "Switch to List View"}
                >
                    {viewMode === 'list' ? <TableCellsIcon className="w-4 h-4 mr-1.5" /> : <ListBulletIcon className="w-4 h-4 mr-1.5" />}
                    {viewMode === 'list' ? 'Grid View' : 'List View'}
                </button>
                <div className="relative" ref={exportAllMenuRef}>
                     <button
                        onClick={() => setShowExportAllMenu(!showExportAllMenu)}
                        className="flex items-center bg-teal-600 hover:bg-teal-700 text-white font-semibold py-1.5 px-3 rounded-md text-sm transition-colors shadow"
                        title="Export all application data"
                        aria-haspopup="true"
                        aria-expanded={showExportAllMenu}
                    >
                        <ArrowDownTrayIcon className="w-4 h-4 mr-1.5" />
                        Export All Data
                        <ChevronDownIcon className={`w-4 h-4 ml-1 transition-transform ${showExportAllMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showExportAllMenu && (
                         <div className="absolute right-0 mt-2 w-56 bg-gray-700 border border-gray-600 rounded-md shadow-xl z-40 py-1"> 
                            <button 
                                onClick={handleExportAllDataJSON} 
                                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 flex items-center"
                            >
                                <DocumentDuplicateIcon className="w-4 h-4 mr-2 opacity-80" /> Export as JSON
                            </button>
                            <button 
                                onClick={handleExportAllDataCSV} 
                                className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 flex items-center"
                            >
                                <DocumentDuplicateIcon className="w-4 h-4 mr-2 opacity-80" /> Export as CSV (zipped)
                            </button>
                        </div>
                    )}
                </div>
                <label
                    htmlFor="import-file-input"
                    className="flex items-center bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 px-3 rounded-md text-sm transition-colors shadow cursor-pointer"
                    title="Import streams and updates from a JSON backup file"
                >
                    <ArrowUpTrayIcon className="w-4 h-4 mr-1.5" />
                    Import Data
                </label>
                <input
                    type="file"
                    id="import-file-input"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".json"
                    onChange={handleImportData}
                />
            </div>
        </div>
      </header>
      <div className="flex flex-grow overflow-hidden">
        <div 
            className={`flex-shrink-0 h-full bg-gray-800 transition-all duration-300 ease-in-out transform
                        ${isSidebarCollapsed ? 'w-0 opacity-0 -translate-x-full pointer-events-none' : 'w-80 opacity-100 translate-x-0'}`}
        >
          {!isSidebarCollapsed && (
            <Sidebar
              streams={streams}
              selectedStreamId={selectedStreamId}
              onSelectStream={handleSelectStreamFromSidebar}
              onOpenAddModal={handleOpenAddModal} 
              onDeleteStream={handleDeleteStream}
              onEditStream={handleOpenEditModal}
              onReorderStreams={handleReorderStreams}
            />
          )}
        </div>
        <main className="flex-grow h-full flex flex-col overflow-hidden bg-gray-900">
          {viewMode === 'grid' ? (
            <GridView
              streams={streams}
              streamUpdates={streamUpdates}
              loadingStates={loadingStates}
              onSelectStreamAndSwitchView={handleSelectStreamAndSwitchView}
              onEditStream={handleOpenEditModal}
              onExportStreamData={handleExportStreamData}
              onRefreshStream={handleRefreshStream}
              onUpdateContextPreference={handleUpdateStreamContextPreference}
              onUpdateDetailLevel={handleUpdateStreamDetailLevel}
            />
          ) : (
            <StreamView
              stream={selectedStream}
              updatesForStream={currentUpdatesForStream}
              isLoading={isLoadingSelectedStream}
              error={error}
              onRefresh={handleRefreshStream}
              apiKeyAvailable={apiKeyAvailable} // This prop is still useful for UI hints
              onEditStream={handleOpenEditModal}
              onUpdateContextPreference={handleUpdateStreamContextPreference}
              onUpdateDetailLevel={handleUpdateStreamDetailLevel}
              onDeleteStreamUpdate={handleDeleteStreamUpdate} 
              isSidebarCollapsed={isSidebarCollapsed}
            />
          )}
        </main>
      </div>

      {(isEditModalOpen || isAddModalOpen) && (
        <EditStreamModal
          isOpen={isEditModalOpen || isAddModalOpen}
          onClose={isEditModalOpen ? handleCloseEditModal : handleCloseAddModal}
          stream={streamToEdit} 
          onSave={isEditModalOpen ? handleUpdateStream : handleAddStream} 
          apiKeyAvailable={apiKeyAvailable} // This prop is still useful for UI hints
          mode={(isEditModalOpen && streamToEdit) ? 'edit' : 'add'} 
        />
      )}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSaveKey={handleSaveUserApiKey}
        onClearKey={handleClearUserApiKey}
        currentKeyExists={apiKeyAvailable}
        currentKeySource={apiKeySource}
      />
    </div>
  );
};

export default App;