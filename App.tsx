
import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import Sidebar from './components/Sidebar';
import StreamView from './components/StreamView';
import GridView from './components/GridView'; 
import EditStreamModal from './components/EditStreamModal';
import ApiKeyModal from './components/ApiKeyModal'; 
import { Stream, StreamUpdate, StreamContextPreference, AppBackup, StreamDetailLevel, AvailableGeminiModelId, ChatMessage, PinnedChatMessage, GroundingChunk, ReasoningMode } from './types';
import { 
    fetchStreamUpdates, 
    PreviousContext, 
    updateUserApiKey, 
    isApiKeyEffectivelySet, 
    getActiveKeySource 
} from './services/geminiService';
import { 
    APP_NAME, 
    DEFAULT_TEMPERATURE, 
    DEFAULT_DETAIL_LEVEL, 
    DEFAULT_CONTEXT_PREFERENCE, 
    DEFAULT_REASONING_MODE,
    DEFAULT_THINKING_TOKEN_BUDGET,
    DEFAULT_AUTO_THINKING_BUDGET,
    USER_API_KEY_STORAGE_KEY,
    DEFAULT_GEMINI_MODEL_ID 
} from './constants'; 
import { 
    ArrowDownTrayIcon, ArrowUpTrayIcon, ListBulletIcon, TableCellsIcon, DocumentDuplicateIcon, 
    ChevronDownIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, KeyIcon 
} from './components/icons';
import { convertToCSV, downloadFile } from './utils/exportUtils';
import {
  getAllStreams,
  getAllUpdates,
  saveStreams,
  saveUpdate,
  deleteStreamFromDB,
  deleteUpdateFromDB,
  clearAllDataFromDB
} from './services/dbService';


type ViewMode = 'list' | 'grid';

const App: React.FC = () => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [streamUpdates, setStreamUpdates] = useState<{ [key: string]: StreamUpdate[] }>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false); 

  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false); 
  const [apiKeySource, setApiKeySource] = useState<'user' | 'environment' | 'none'>('none'); 
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false); 

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

  useEffect(() => {
    const loadDataFromDB = async () => {
      try {
        const dbStreams = await getAllStreams();
        const dbUpdates = await getAllUpdates();
        setStreams(dbStreams);
        setStreamUpdates(dbUpdates);
      } catch (error) {
        console.error("Failed to load data from IndexedDB", error);
        setError("Could not load application data from local database. Please check browser permissions.");
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadDataFromDB();
  }, []);

  useEffect(() => {
    const storedUserApiKey = localStorage.getItem(USER_API_KEY_STORAGE_KEY);
    if (storedUserApiKey) {
      updateUserApiKey(storedUserApiKey); 
    } else {
      updateUserApiKey(null); 
    }
    setApiKeyAvailable(isApiKeyEffectivelySet());
    setApiKeySource(getActiveKeySource());
  }, []);

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
    setError(null); 
    if (selectedStream && !loadingStatesRef.current[selectedStream.id]) {
        fetchUpdates(selectedStream);
    }
  };

  const handleClearUserApiKey = () => {
    localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
    updateUserApiKey(null); 
    updateApiStatus();
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

    if (!isApiKeyEffectivelySet()) { 
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
      await saveUpdate(newUpdate); 
      setStreamUpdates(prevUpdates => {
        const existingUpdates = prevUpdates[stream.id] || [];
        return {
          ...prevUpdates,
          [stream.id]: [newUpdate, ...existingUpdates]
        };
      });

      setStreams(prevStreams => {
        const streamsToSort = [...prevStreams];
        const updatedStreamIndex = streamsToSort.findIndex(s => s.id === stream.id);

        if (updatedStreamIndex !== -1) {
          const updatedStreamInstance = { ...streamsToSort[updatedStreamIndex], lastUpdated: new Date().toISOString() };
          streamsToSort.splice(updatedStreamIndex, 1); // Remove from old position
          streamsToSort.unshift(updatedStreamInstance); // Add to the beginning

          // Further sort the rest of the streams (excluding the one just moved to top)
          // This part is simplified: the main updated stream is already at the top.
          // The `saveStreams` will save this new order directly.
          // If more complex sorting beyond "updated to top" is needed for the rest, it would go here.
          // For now, placing the updated stream at the top is the primary goal.
          // To ensure consistent sorting based on lastUpdated for all streams:
          streamsToSort.sort((a, b) => {
            if (a.id === updatedStreamInstance.id) return -1;
            if (b.id === updatedStreamInstance.id) return 1;
            
            const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            return dateB - dateA; // Sort by newest first
          });
          
          saveStreams(streamsToSort);
          return streamsToSort;
        }
        return prevStreams;
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
  }, [streamUpdates]); 


  const handleOpenAddModal = () => {
    setStreamToEdit(null); 
    setIsAddModalOpen(true);
    setIsEditModalOpen(false); 
  };
  
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleAddStream = async (newStreamData: Omit<Stream, 'id' | 'pinnedChatMessages' | 'lastUpdated'>) => { 
    const newStream: Stream = {
      id: crypto.randomUUID(),
      name: newStreamData.name,
      focus: newStreamData.focus,
      temperature: newStreamData.temperature,
      detailLevel: newStreamData.detailLevel,
      contextPreference: newStreamData.contextPreference,
      modelName: newStreamData.modelName || DEFAULT_GEMINI_MODEL_ID,
      reasoningMode: newStreamData.reasoningMode,
      autoThinkingBudget: newStreamData.autoThinkingBudget,
      thinkingTokenBudget: newStreamData.thinkingTokenBudget,
      topK: newStreamData.topK,
      topP: newStreamData.topP,
      seed: newStreamData.seed,
      pinnedChatMessages: [],
      lastUpdated: new Date().toISOString(), // New stream is the "most recently updated"
    };
    
    // Add new stream to the beginning and then sort all streams
    // The sort ensures it respects other lastUpdated timestamps if any exist,
    // but a brand new stream with current timestamp will naturally be at/near the top.
    setStreams(prevStreams => {
        const streamsWithNew = [newStream, ...prevStreams];
        streamsWithNew.sort((a,b) => {
            const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            return dateB - dateA;
        });
        saveStreams(streamsWithNew);
        return streamsWithNew;
    });

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

  const handleUpdateStream = async (updatedStreamFull: Stream) => {
    const oldStream = streams.find(s => s.id === updatedStreamFull.id);
    
    // Ensure lastUpdated is preserved or updated if relevant changes occurred
    const updatedStream = { ...updatedStreamFull, lastUpdated: oldStream?.lastUpdated || new Date().toISOString() };


    const newStreams = streams.map(s => s.id === updatedStream.id ? updatedStream : s);
    // No sort here, as editing doesn't automatically mean it's "fresher" than others unless content affecting parameters change
    setStreams(newStreams); 
    await saveStreams(newStreams); 
    
    let shouldReFetch = false;
    if (oldStream) {
        if (
            oldStream.focus !== updatedStream.focus ||
            oldStream.detailLevel !== updatedStream.detailLevel ||
            oldStream.temperature !== updatedStream.temperature ||
            oldStream.contextPreference !== updatedStream.contextPreference ||
            oldStream.modelName !== updatedStream.modelName || 
            oldStream.reasoningMode !== updatedStream.reasoningMode ||
            oldStream.autoThinkingBudget !== updatedStream.autoThinkingBudget ||
            oldStream.thinkingTokenBudget !== updatedStream.thinkingTokenBudget ||
            oldStream.topK !== updatedStream.topK ||
            oldStream.topP !== updatedStream.topP ||
            oldStream.seed !== updatedStream.seed ||
            JSON.stringify(oldStream.pinnedChatMessages || []) !== JSON.stringify(updatedStream.pinnedChatMessages || [])
        ) {
            shouldReFetch = true;
        }
    }

    if (isApiKeyEffectivelySet() && shouldReFetch) {
        if (!loadingStatesRef.current[updatedStream.id]) {
            fetchUpdates(updatedStream); // This will handle re-sorting if an update is fetched
        }
    } else if (!isApiKeyEffectivelySet() && shouldReFetch) {
         setError("API Key not configured. Cannot fetch updates for the modified stream.");
    }
    handleCloseEditModal();
  };

  const handleDeleteStream = async (streamId: string) => {
    await deleteStreamFromDB(streamId);

    const newStreamsList = streams.filter(s => s.id !== streamId);
    setStreams(newStreamsList);
    // `saveStreams` is implicitly called if newStreamsList is different,
    // or it will be called by other operations that modify streams.
    // If newStreamsList is empty, no save is needed here.
    // If not empty, the order is preserved from the filtered list.

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

  const handleDeleteStreamUpdate = async (streamId: string, updateId: string) => {
    await deleteUpdateFromDB(updateId);
    
    setStreamUpdates(prevUpdates => {
      const specificStreamUpdates = prevUpdates[streamId];

      if (!specificStreamUpdates) {
        return prevUpdates; 
      }
      const updatedSpecificStreamUpdates = specificStreamUpdates.filter(update => update.id !== updateId);
      
      return {
        ...prevUpdates,
        [streamId]: updatedSpecificStreamUpdates,
      };
    });
  };

  const handleUpdateStreamContextPreference = async (streamId: string, preference: StreamContextPreference) => {
    const newStreams = streams.map(s => s.id === streamId ? { ...s, contextPreference: preference } : s);
    setStreams(newStreams);
    await saveStreams(newStreams); // Order remains, only preference changes
  };
  
  const handleUpdateStreamDetailLevel = async (streamId: string, detailLevel: StreamDetailLevel) => {
    const newStreams = streams.map(s => s.id === streamId ? { ...s, detailLevel: detailLevel } : s);
    setStreams(newStreams);
    await saveStreams(newStreams); // Order remains, only detail level changes
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
  }, [fetchUpdates]); 

  const handleReorderStreams = async (draggedId: string, targetId: string, insertBefore: boolean) => {
    let reorderedStreamsList = [...streams];
    const draggedItemIndex = reorderedStreamsList.findIndex(s => s.id === draggedId);
    
    if (draggedItemIndex === -1) return;
    
    const [draggedItem] = reorderedStreamsList.splice(draggedItemIndex, 1);
    const targetItemIndex = reorderedStreamsList.findIndex(s => s.id === targetId);

    if (targetItemIndex === -1) {
      reorderedStreamsList.push(draggedItem);
    } else {
      if (insertBefore) {
        reorderedStreamsList.splice(targetItemIndex, 0, draggedItem);
      } else {
        reorderedStreamsList.splice(targetItemIndex + 1, 0, draggedItem);
      }
    }
    
    // Update lastUpdated timestamps to reflect manual order
    const now = new Date();
    const streamsWithUpdatedOrder = reorderedStreamsList.map((stream, index) => {
      // Subtract seconds to ensure descending order for sort stability if needed,
      // though the array order itself is now the source of truth for `saveStreams`.
      const newTimestamp = new Date(now.getTime() - index * 1000).toISOString();
      return { ...stream, lastUpdated: newTimestamp };
    });

    setStreams(streamsWithUpdatedOrder);
    await saveStreams(streamsWithUpdatedOrder); // This saves the new manual order
  };


   useEffect(() => {
    if (isDataLoaded && viewMode === 'list' && !selectedStreamId && streams.length > 0) {
        // Streams are now loaded sorted by `order` from DB, which reflects `lastUpdated`
        const firstStreamId = streams[0].id;
        setSelectedStreamId(firstStreamId); 
    } else if (isDataLoaded && streams.length === 0 && selectedStreamId) {
        setSelectedStreamId(null); 
    }
  }, [streams, selectedStreamId, viewMode, isDataLoaded]);


  useEffect(() => {
    if (isDataLoaded && viewMode === 'list' && selectedStreamId) {
        const stream = streams.find(s => s.id === selectedStreamId);
        if (isApiKeyEffectivelySet() && stream && (!streamUpdates[selectedStreamId] || streamUpdates[selectedStreamId].length === 0)) {
            if (!loadingStatesRef.current[selectedStreamId]) { 
                 fetchUpdates(stream);
            }
        } else if (!isApiKeyEffectivelySet() && stream) { 
             setError("API Key not configured. Cannot display or fetch updates for selected stream.");
        }
    }
  }, [selectedStreamId, streams, streamUpdates, fetchUpdates, viewMode, isDataLoaded]); 


  const handleExportAllDataJSON = async () => {
    setShowExportAllMenu(false);
    const currentStreams = await getAllStreams();
    const currentUpdates = await getAllUpdates();
    const backupData: AppBackup = {
      streams: currentStreams,
      streamUpdates: currentUpdates,
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    downloadFile(jsonString, `${APP_NAME.toLowerCase().replace(/\s+/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    alert('All application data (JSON) has been exported!');
  };
  
  const handleExportAllDataCSV = async () => {
    setShowExportAllMenu(false);
    const currentStreams = await getAllStreams();
    const currentUpdatesMap = await getAllUpdates();

    if (!currentStreams.length && !Object.keys(currentUpdatesMap).some(key => currentUpdatesMap[key].length > 0)) {
      alert("No data to export.");
      return;
    }

    const zip = new JSZip();

    const streamHeaders = ['stream_id', 'name', 'focus', 'temperature', 'detail_level', 'context_preference', 'model_name', 'reasoning_mode', 'auto_thinking_budget', 'thinking_token_budget', 'top_k', 'top_p', 'seed', 'last_updated', 'pinned_chat_messages_json'];
    const streamsData = currentStreams.map(s => ({
        stream_id: s.id,
        name: s.name,
        focus: s.focus,
        temperature: s.temperature,
        detail_level: s.detailLevel,
        context_preference: s.contextPreference,
        model_name: s.modelName || DEFAULT_GEMINI_MODEL_ID,
        reasoning_mode: s.reasoningMode,
        auto_thinking_budget: s.autoThinkingBudget === undefined ? '' : s.autoThinkingBudget,
        thinking_token_budget: s.thinkingTokenBudget === undefined ? '' : s.thinkingTokenBudget,
        top_k: s.topK === undefined ? '' : s.topK,
        top_p: s.topP === undefined ? '' : s.topP,
        seed: s.seed === undefined ? '' : s.seed,
        last_updated: s.lastUpdated || '',
        pinned_chat_messages_json: JSON.stringify(s.pinnedChatMessages || [])
    }));
    const streamsCSV = convertToCSV(streamsData, streamHeaders);
    zip.file("streams.csv", streamsCSV);

    const updateHeaders = ['update_id', 'stream_id', 'timestamp', 'main_content', 'reasoning_content', 'main_content_tokens', 'reasoning_tokens', 'grounding_source_urls'];
    let allUpdatesData: any[] = [];
    Object.values(currentUpdatesMap).forEach(updatesArray => {
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
    reader.onload = async (e) => {
      try { 
        const result = e.target?.result;
        if (typeof result !== 'string') throw new Error('File content is not a string.');
        const parsedData = JSON.parse(result) as AppBackup;

        if (!parsedData || !Array.isArray(parsedData.streams) || typeof parsedData.streamUpdates !== 'object') {
          throw new Error('Invalid backup file format.');
        }
        
        const isSandboxed = window.self !== window.top;
        let userConfirmed = false;

        if (isSandboxed) {
          console.log("Sandbox environment detected. Bypassing import confirmation dialog.");
          userConfirmed = true; 
        } else {
          userConfirmed = window.confirm('Are you sure you want to import this data? This will overwrite all current streams and updates.');
        }

        if (userConfirmed) {
          try { 
            await clearAllDataFromDB();
            
            const importedStreams = parsedData.streams.map((s: any): Stream => ({
                id: s.id || crypto.randomUUID(),
                name: s.name || "Untitled Stream",
                focus: s.focus || "General topics",
                temperature: typeof s.temperature === 'number' ? s.temperature : DEFAULT_TEMPERATURE,
                detailLevel: s.detailLevel || DEFAULT_DETAIL_LEVEL,
                contextPreference: s.contextPreference || DEFAULT_CONTEXT_PREFERENCE,
                modelName: s.modelName || DEFAULT_GEMINI_MODEL_ID, 
                reasoningMode: s.reasoningMode || (typeof s.enableReasoning === 'boolean' ? (s.enableReasoning ? 'request' : 'off') : DEFAULT_REASONING_MODE),
                autoThinkingBudget: typeof s.autoThinkingBudget === 'boolean' ? s.autoThinkingBudget : DEFAULT_AUTO_THINKING_BUDGET,
                thinkingTokenBudget: typeof s.thinkingTokenBudget === 'number' ? s.thinkingTokenBudget : DEFAULT_THINKING_TOKEN_BUDGET,
                topK: typeof s.topK === 'number' ? s.topK : undefined,
                topP: typeof s.topP === 'number' ? s.topP : undefined,
                seed: typeof s.seed === 'number' ? s.seed : undefined,
                lastUpdated: s.lastUpdated || new Date(0).toISOString(), 
                pinnedChatMessages: Array.isArray(s.pinnedChatMessages) ? s.pinnedChatMessages.map((pm: any): PinnedChatMessage => ({
                    id: pm.id || crypto.randomUUID(),
                    messageId: pm.messageId || '',
                    role: pm.role || 'user',
                    text: pm.text || '',
                    originalTimestamp: pm.originalTimestamp || new Date().toISOString(),
                    pinnedTimestamp: pm.pinnedTimestamp || new Date().toISOString(),
                })) : [],
            })).sort((a,b) => { 
                const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
                const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
                return dateB - dateA;
            });
            
            let validatedStreamUpdates: { [key: string]: StreamUpdate[] } = {};
            const allImportedUpdateObjects: StreamUpdate[] = [];

            if (parsedData.streamUpdates && typeof parsedData.streamUpdates === 'object' && parsedData.streamUpdates !== null) {
                for (const streamId in parsedData.streamUpdates) {
                    if (Object.prototype.hasOwnProperty.call(parsedData.streamUpdates, streamId)) {
                        const updatesArray = parsedData.streamUpdates[streamId];
                        if (Array.isArray(updatesArray)) {
                            const streamSpecificUpdates = updatesArray
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
                                        const validUpdate: StreamUpdate = {
                                            id: upd.id,
                                            streamId: upd.streamId || streamId, 
                                            mainContent: mainContent,
                                            reasoningContent: reasoningContent,
                                            groundingMetadata: Array.isArray(upd.groundingMetadata) ? upd.groundingMetadata : undefined,
                                            timestamp: upd.timestamp,
                                            mainContentTokens: mainContentTokens,
                                            reasoningTokens: reasoningTokens,
                                        };
                                        allImportedUpdateObjects.push(validUpdate);
                                        return validUpdate;
                                    }
                                    console.warn("Skipping invalid update during import:", upd);
                                    return null; 
                                })
                                .filter((upd): upd is StreamUpdate => upd !== null) 
                                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                            validatedStreamUpdates[streamId] = streamSpecificUpdates;
                        }
                    }
                }
            }

            await saveStreams(importedStreams);
            await Promise.all(allImportedUpdateObjects.map(update => saveUpdate(update)));

            setStreams(importedStreams);
            setStreamUpdates(validatedStreamUpdates);
            setLoadingStates({});
            setSelectedStreamId(importedStreams.length > 0 ? importedStreams[0].id : null);
            setViewMode('list'); 
            alert('Data imported successfully!');
          } catch (dbErr) {
            const errorMessage = dbErr instanceof Error ? dbErr.message : 'An unknown error occurred while processing imported data.';
            alert(`Failed to process imported data: ${errorMessage}`);
          }
        } else {
            console.log("User cancelled the import operation.");
        }
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

  const handleExportStreamData = async (stream: Stream, format: 'txt' | 'md' | 'csv') => {
    if (!stream) return;
    const allDbUpdates = await getAllUpdates();
    const updates = allDbUpdates[stream.id] || [];

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

  const handlePinChatMessage = async (streamId: string, chatMessage: ChatMessage) => {
    const newStreams = streams.map(s => {
      if (s.id === streamId) {
        const newPinnedMessage: PinnedChatMessage = {
          id: crypto.randomUUID(),
          messageId: chatMessage.id,
          role: chatMessage.role,
          text: chatMessage.text,
          originalTimestamp: chatMessage.timestamp,
          pinnedTimestamp: new Date().toISOString(),
        };
        const updatedPinnedMessages = [...(s.pinnedChatMessages || []), newPinnedMessage];
        return { ...s, pinnedChatMessages: updatedPinnedMessages };
      }
      return s;
    });
    setStreams(newStreams);
    await saveStreams(newStreams);
  };

  const handleUnpinChatMessage = async (streamId: string, pinnedChatMessageId: string) => {
    const newStreams = streams.map(s => {
      if (s.id === streamId) {
        const updatedPinnedMessages = (s.pinnedChatMessages || []).filter(pm => pm.id !== pinnedChatMessageId);
        return { ...s, pinnedChatMessages: updatedPinnedMessages };
      }
      return s;
    });
    setStreams(newStreams);
    await saveStreams(newStreams);
  };

  if (!isDataLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-xl font-semibold text-white">
        Loading Application...
      </div>
    );
  }

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
              apiKeyAvailable={apiKeyAvailable} 
              onEditStream={handleOpenEditModal}
              onUpdateContextPreference={handleUpdateStreamContextPreference}
              onUpdateDetailLevel={handleUpdateStreamDetailLevel}
              onDeleteStreamUpdate={handleDeleteStreamUpdate} 
              isSidebarCollapsed={isSidebarCollapsed}
              onPinChatMessage={handlePinChatMessage}
              onUnpinChatMessage={handleUnpinChatMessage}
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
          apiKeyAvailable={apiKeyAvailable} 
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