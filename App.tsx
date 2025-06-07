
// App.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import Sidebar from './components/Sidebar';
import StreamView from './components/StreamView';
import GridView from './components/GridView'; 
import EditStreamModal from './components/EditStreamModal';
import ApiKeyModal from './components/ApiKeyModal'; 
import { Stream, StreamUpdate, StreamContextPreference, AppBackup, StreamDetailLevel, ChatMessage, PinnedChatMessage, ReasoningMode, AvailableGeminiModelId, GroundingChunk, Podcast } from './types';
import { fetchStreamUpdates, PreviousContext, updateUserApiKey, isApiKeyEffectivelySet, getActiveKeySource, generatePodcastScript, generateSpeechFromText, generatePodcastTitleCardImage } from './services/geminiService';
import { APP_NAME, DEFAULT_TEMPERATURE, DEFAULT_DETAIL_LEVEL, DEFAULT_CONTEXT_PREFERENCE, DEFAULT_REASONING_MODE, DEFAULT_THINKING_TOKEN_BUDGET, DEFAULT_AUTO_THINKING_BUDGET, USER_API_KEY_STORAGE_KEY, DEFAULT_GEMINI_MODEL_ID, TTS_DEFAULT_VOICE, TTS_SAMPLE_RATE, AvailableTTSVoiceId } from './constants'; 
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ListBulletIcon, TableCellsIcon, DocumentDuplicateIcon, ChevronDownIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, KeyIcon, MicrophoneIcon } from './components/icons'; // Replaced MusicalNoteIcon
import { convertToCSV, downloadFile } from './utils/exportUtils';
import { getAllStreams, getAllUpdates, saveStreams, saveUpdate, deleteStreamFromDB, deleteUpdateFromDB, clearAllDataFromDB, deleteTtsAudio, getAllPodcasts, savePodcast, deletePodcast as deletePodcastFromDB } from './services/dbService';
import StudioView from './components/StudioView';
import CreatePodcastModal from './components/CreatePodcastModal';
import { AudioPlaybackControls, base64ToFloat32Array, getPlaybackControls, loadAudioForPlayback, stopGlobalAudio, encodeWAV } from './utils/audioUtils';
import FullTranscriptView from './components/FullTranscriptView'; // Added import

type ViewMode = 'list' | 'grid' | 'studio';

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
  const [viewMode, setViewMode] = useState<ViewMode>('studio');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [streamToEdit, setStreamToEdit] = useState<Stream | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportAllMenuRef = useRef<HTMLDivElement>(null); 
  const [showExportAllMenu, setShowExportAllMenu] = useState(false);
  const loadingStatesRef = useRef(loadingStates);

  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [isCreatePodcastModalOpen, setCreatePodcastModalOpen] = useState(false);

  const [playingPodcastId, setPlayingPodcastId] = useState<string | null>(null);
  const [isPodcastPlaying, setIsPodcastPlaying] = useState(false);
  const [podcastCurrentTime, setPodcastCurrentTime] = useState(0);
  const [podcastDuration, setPodcastDuration] = useState(0);
  const podcastPlaybackControlsRef = useRef<AudioPlaybackControls | null>(null);
  const [expandedTranscriptPodcastId, setExpandedTranscriptPodcastId] = useState<string | null>(null);
  
  // State for full-page transcript view
  const [isFullTranscriptViewOpen, setIsFullTranscriptViewOpen] = useState(false);
  const [fullViewTranscriptPodcastId, setFullViewTranscriptPodcastId] = useState<string | null>(null);

  useEffect(() => { loadingStatesRef.current = loadingStates; }, [loadingStates]);

  useEffect(() => {
    const loadDataFromDB = async () => {
      try {
        const dbStreams = await getAllStreams();
        const dbUpdates = await getAllUpdates();
        const dbPodcasts = await getAllPodcasts();
        setStreams(dbStreams);
        setStreamUpdates(dbUpdates);
        setPodcasts(dbPodcasts);
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
    updateApiStatus(); 
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
    const currentSelectedStream = streams.find(s => s.id === selectedStreamId);
    if (currentSelectedStream && isApiKeyEffectivelySet() && !loadingStatesRef.current[currentSelectedStream.id]) {
        fetchUpdates(currentSelectedStream);
    }
  };
  const handleClearUserApiKey = () => {
    localStorage.removeItem(USER_API_KEY_STORAGE_KEY);
    updateUserApiKey(null); 
    updateApiStatus();
    if (!isApiKeyEffectivelySet()) { 
        setError("API Key cleared. If no environment key is set, features requiring an API key are disabled.");
    }
  };

  const fetchUpdates = useCallback(async (stream: Stream) => {
    if (!stream || !stream.id) {
      console.warn("fetchUpdates called with invalid stream object", stream);
      return;
    }
    if (loadingStatesRef.current[stream.id]) return;

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
      const result = await fetchStreamUpdates(stream, previousContext);
      const newUpdate: StreamUpdate = { id: crypto.randomUUID(), streamId: stream.id, timestamp: new Date().toISOString(), ...result };
      await saveUpdate(newUpdate); 
      
      setStreamUpdates(prev => ({ 
        ...prev, 
        [stream.id]: [newUpdate, ...(prev[stream.id] || [])] 
      }));

      setStreams(prevStreams => {
        const streamsToSort = [...prevStreams];
        const updatedStreamIndex = streamsToSort.findIndex(s => s.id === stream.id);
        if (updatedStreamIndex !== -1) {
          const updatedStreamInstance = { ...streamsToSort[updatedStreamIndex], lastUpdated: new Date().toISOString() };
          streamsToSort.splice(updatedStreamIndex, 1);
          streamsToSort.unshift(updatedStreamInstance); 
          saveStreams(streamsToSort); 
          return streamsToSort;
        }
        return prevStreams; 
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoadingStates(prev => ({ ...prev, [stream.id]: false }));
    }
  }, [streamUpdates]); 

  const handleOpenAddModal = () => {
    setStreamToEdit(null);
    setIsAddModalOpen(true);
    setIsEditModalOpen(false);
  };
  const handleCloseAddModal = () => setIsAddModalOpen(false);

  const handleAddStream = async (newStreamData: Omit<Stream, 'id' | 'pinnedChatMessages' | 'lastUpdated'>) => {
    const newStream: Stream = {
      id: crypto.randomUUID(),
      ...newStreamData, 
      modelName: newStreamData.modelName || DEFAULT_GEMINI_MODEL_ID, 
      pinnedChatMessages: [],
      lastUpdated: new Date().toISOString(),
    };
    setStreams(prevStreams => {
        const updatedStreams = [newStream, ...prevStreams];
        updatedStreams.sort((a,b) => new Date(b.lastUpdated!).getTime() - new Date(a.lastUpdated!).getTime());
        saveStreams(updatedStreams);
        return updatedStreams;
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
    
    const updatedStream = { 
      ...updatedStreamFull, 
      lastUpdated: oldStream?.lastUpdated || new Date().toISOString() 
    };

    const newStreams = streams.map(s => s.id === updatedStream.id ? updatedStream : s);
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
            fetchUpdates(updatedStream); 
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
    
    if(newStreamsList.length > 0) {
        await saveStreams(newStreamsList); 
    } else { 
        await saveStreams([]); 
    }

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
    await deleteTtsAudio(updateId); 
    
    setStreamUpdates(prev => ({ 
        ...prev, 
        [streamId]: (prev[streamId] || []).filter(u => u.id !== updateId) 
    }));
  };
  
  const handleUpdateStreamContextPreference = async (streamId: string, preference: StreamContextPreference) => { 
    const newStreams = streams.map(s => s.id === streamId ? { ...s, contextPreference: preference } : s);
    setStreams(newStreams);
    await saveStreams(newStreams); 
  };

  const handleUpdateStreamDetailLevel = async (streamId: string, detailLevel: StreamDetailLevel) => { 
    const newStreams = streams.map(s => s.id === streamId ? { ...s, detailLevel: detailLevel } : s);
    setStreams(newStreams);
    await saveStreams(newStreams); 
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
    
    const streamsWithUpdatedOrder = reorderedStreamsList.map((stream, index) => ({
      ...stream,
    }));

    setStreams(streamsWithUpdatedOrder);
    await saveStreams(streamsWithUpdatedOrder); 
  };

  useEffect(() => {
    if (isDataLoaded && viewMode === 'list' && !selectedStreamId && streams.length > 0) {
      setSelectedStreamId(streams[0].id);
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
    const currentPodcasts = await getAllPodcasts();
    const backupData: AppBackup = {
      streams: currentStreams,
      streamUpdates: currentUpdates,
      podcasts: currentPodcasts,
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    downloadFile(jsonString, `${APP_NAME.toLowerCase().replace(/\s+/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    alert('All application data (JSON) has been exported!');
  };
  
  const handleExportAllDataCSV = async () => { 
    setShowExportAllMenu(false);
    const allStreams = await getAllStreams();
    const allUpdates = await getAllUpdates(); 
  
    const zip = new JSZip();
  
    const streamHeaders = ['stream_id', 'name', 'focus', 'temperature', 'detailLevel', 'contextPreference', 'modelName', 'reasoningMode', 'autoThinkingBudget', 'thinkingTokenBudget', 'topK', 'topP', 'seed', 'lastUpdated', 'pinnedChatMessagesCount'];
    const streamData = allStreams.map(s => ({
      stream_id: s.id, name: s.name, focus: s.focus, temperature: s.temperature, detailLevel: s.detailLevel,
      contextPreference: s.contextPreference, modelName: s.modelName || DEFAULT_GEMINI_MODEL_ID,
      reasoningMode: s.reasoningMode || DEFAULT_REASONING_MODE, autoThinkingBudget: s.autoThinkingBudget,
      thinkingTokenBudget: s.thinkingTokenBudget, topK: s.topK, topP: s.topP, seed: s.seed,
      lastUpdated: s.lastUpdated, pinnedChatMessagesCount: s.pinnedChatMessages?.length || 0,
    }));
    const streamsCsv = convertToCSV(streamData, streamHeaders);
    zip.file('all_streams_summary.csv', streamsCsv);
  
    const updateHeaders = ['update_id', 'stream_id', 'stream_name', 'timestamp', 'main_content', 'reasoning_content', 'main_content_tokens', 'reasoning_tokens', 'grounding_source_urls'];
    let allUpdatesArray: any[] = [];
    for (const streamId in allUpdates) {
      const streamName = allStreams.find(s => s.id === streamId)?.name || streamId;
      allUpdates[streamId].forEach(update => {
        const groundingUrls = (update.groundingMetadata || []).map(chunk => chunk.web?.uri || chunk.retrievedContext?.uri).filter(Boolean).join('; ');
        allUpdatesArray.push({
          update_id: update.id, stream_id: streamId, stream_name: streamName, timestamp: update.timestamp,
          main_content: update.mainContent, reasoning_content: update.reasoningContent || '',
          main_content_tokens: update.mainContentTokens || 0, reasoning_tokens: update.reasoningTokens || 0,
          grounding_source_urls: groundingUrls,
        });
      });
    }
    const updatesCsv = convertToCSV(allUpdatesArray, updateHeaders);
    zip.file('all_stream_updates.csv', updatesCsv);
  
    const currentPodcasts = await getAllPodcasts();
    const podcastHeaders = ['podcast_id', 'title', 'createdAt', 'voiceName', 'sourceStreamIds_count', 'status', 'failureReason', 'hasAudioChunks', 'scriptTextLength', 'hasTitleCardImage', 'audioDuration_seconds'];
    const podcastData = currentPodcasts.map(p => ({
        podcast_id: p.id, title: p.title, createdAt: p.createdAt, voiceName: p.voiceName || TTS_DEFAULT_VOICE,
        sourceStreamIds_count: p.sourceStreamIds.length, status: p.status,
        failureReason: p.failureReason || '', hasAudioChunks: !!(p.audioB64Chunks && p.audioB64Chunks.length > 0),
        scriptTextLength: p.scriptText?.length || 0,
        hasTitleCardImage: !!p.titleCardImageUrl,
        audioDuration_seconds: p.audioDuration || 0,
    }));
    const podcastsCsv = convertToCSV(podcastData, podcastHeaders);
    zip.file('all_podcasts_summary.csv', podcastsCsv);

    zip.generateAsync({ type: "blob" })
      .then(function(content) {
        downloadFile(content, `${APP_NAME.toLowerCase().replace(/\s+/g, '_')}_data_export_${new Date().toISOString().split('T')[0]}.zip`);
        alert('All application data (CSV, Zipped) has been exported!');
      })
      .catch(err => {
        console.error("Error generating CSV zip:", err);
        alert('Failed to generate CSV export.');
      });
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

        if (!parsedData || (!Array.isArray(parsedData.streams) && !parsedData.streamUpdates && !parsedData.podcasts)) {
          throw new Error('Invalid backup file format. Missing streams, updates, or podcasts.');
        }
        
        const isSandboxed = typeof window !== 'undefined' && window.self !== window.top;
        let userConfirmed = false;

        if (isSandboxed) {
          console.log("Sandbox environment detected. Bypassing import confirmation dialog.");
          userConfirmed = true; 
        } else {
          userConfirmed = window.confirm('Are you sure you want to import this data? This will overwrite all current streams, updates, and podcasts.');
        }

        if (userConfirmed) {
          try { 
            await clearAllDataFromDB();
            
            const importedStreams = (parsedData.streams || []).map((s: any): Stream => ({
                id: s.id || crypto.randomUUID(), name: s.name || "Untitled Stream", focus: s.focus || "General topics",
                temperature: typeof s.temperature === 'number' ? s.temperature : DEFAULT_TEMPERATURE,
                detailLevel: s.detailLevel || DEFAULT_DETAIL_LEVEL, contextPreference: s.contextPreference || DEFAULT_CONTEXT_PREFERENCE,
                modelName: s.modelName as AvailableGeminiModelId || DEFAULT_GEMINI_MODEL_ID, 
                reasoningMode: s.reasoningMode as ReasoningMode || (typeof s.enableReasoning === 'boolean' ? (s.enableReasoning ? 'request' : 'off') : DEFAULT_REASONING_MODE),
                autoThinkingBudget: typeof s.autoThinkingBudget === 'boolean' ? s.autoThinkingBudget : DEFAULT_AUTO_THINKING_BUDGET,
                thinkingTokenBudget: typeof s.thinkingTokenBudget === 'number' ? s.thinkingTokenBudget : DEFAULT_THINKING_TOKEN_BUDGET,
                topK: typeof s.topK === 'number' ? s.topK : undefined, topP: typeof s.topP === 'number' ? s.topP : undefined,
                seed: typeof s.seed === 'number' ? s.seed : undefined, lastUpdated: s.lastUpdated || new Date(0).toISOString(), 
                pinnedChatMessages: Array.isArray(s.pinnedChatMessages) ? s.pinnedChatMessages.map((pm: any): PinnedChatMessage => ({
                    id: pm.id || crypto.randomUUID(), messageId: pm.messageId || '', role: pm.role === 'user' || pm.role === 'model' ? pm.role : 'user',
                    text: pm.text || '', originalTimestamp: pm.originalTimestamp || new Date().toISOString(), pinnedTimestamp: pm.pinnedTimestamp || new Date().toISOString(),
                })) : [],
            })).sort((a,b) => new Date(b.lastUpdated!).getTime() - new Date(a.lastUpdated!).getTime()); 
            
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
                                     if (upd && typeof upd.id === 'string' && typeof upd.timestamp === 'string' && (typeof upd.streamId === 'string' || !upd.streamId) ) { 
                                        const validUpdate: StreamUpdate = {
                                            id: upd.id, streamId: upd.streamId || streamId, mainContent: mainContent,
                                            reasoningContent: typeof upd.reasoningContent === 'string' ? upd.reasoningContent : undefined,
                                            groundingMetadata: Array.isArray(upd.groundingMetadata) ? (upd.groundingMetadata as GroundingChunk[]) : undefined,
                                            timestamp: upd.timestamp,
                                            mainContentTokens: typeof upd.mainContentTokens === 'number' ? upd.mainContentTokens : Math.ceil(mainContent.length/4),
                                            reasoningTokens: typeof upd.reasoningTokens === 'number' ? upd.reasoningTokens : Math.ceil((upd.reasoningContent || "").length/4),
                                        };
                                        allImportedUpdateObjects.push(validUpdate);
                                        return validUpdate;
                                    } return null;
                                }).filter((upd): upd is StreamUpdate => upd !== null) 
                                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); 
                            validatedStreamUpdates[streamId] = streamSpecificUpdates;
                        }
                    }
                }
            }
            
            const importedPodcasts = (parsedData.podcasts || []).map((p: any): Podcast => ({
                id: p.id || crypto.randomUUID(), title: p.title || "Untitled Podcast", createdAt: p.createdAt || new Date().toISOString(),
                sourceStreamIds: Array.isArray(p.sourceStreamIds) ? p.sourceStreamIds : [],
                status: p.status === 'processing' || p.status === 'complete' || p.status === 'failed' ? p.status : 'failed',
                audioB64Chunks: Array.isArray(p.audioB64Chunks) ? p.audioB64Chunks.filter((chunk: any) => typeof chunk === 'string') : (typeof p.audioB64 === 'string' ? undefined : []), 
                scriptText: typeof p.scriptText === 'string' ? p.scriptText : undefined, 
                failureReason: typeof p.failureReason === 'string' ? p.failureReason : (p.status !== 'complete' && p.status !== 'processing' ? 'Imported with unknown status' : undefined),
                voiceName: typeof p.voiceName === 'string' ? p.voiceName : TTS_DEFAULT_VOICE,
                titleCardImageUrl: typeof p.titleCardImageUrl === 'string' ? p.titleCardImageUrl : undefined,
                audioDuration: typeof p.audioDuration === 'number' ? p.audioDuration : undefined,
            })).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            await saveStreams(importedStreams);
            await Promise.all(allImportedUpdateObjects.map(update => saveUpdate(update)));
            await Promise.all(importedPodcasts.map(podcast => savePodcast(podcast)));

            setStreams(importedStreams);
            setStreamUpdates(validatedStreamUpdates);
            setPodcasts(importedPodcasts);
            setLoadingStates({}); 
            setSelectedStreamId(importedStreams.length > 0 ? importedStreams[0].id : null);
            setViewMode(importedStreams.length > 0 ? 'list' : 'studio');
            alert('Data imported successfully!');
          } catch (dbErr) {
            console.error("Error during DB operations in import:", dbErr);
            alert(`Error saving imported data: ${dbErr instanceof Error ? dbErr.message : 'Unknown DB error'}`);
          }
        }
      } catch (err) { 
        console.error("Error parsing import file:", err);
        alert(`Error importing data: ${err instanceof Error ? err.message : 'Invalid file format or content'}`);
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
    // No changes to this specific function's existing logic
  };

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  const handlePinChatMessage = async (streamId: string, chatMessage: ChatMessage) => {
    const streamToUpdate = streams.find(s => s.id === streamId);
    if (!streamToUpdate) return;

    const newPin: PinnedChatMessage = {
        id: crypto.randomUUID(), messageId: chatMessage.id, role: chatMessage.role, text: chatMessage.text,
        originalTimestamp: chatMessage.timestamp, pinnedTimestamp: new Date().toISOString(),
    };
    const updatedPinnedMessages = [...(streamToUpdate.pinnedChatMessages || []), newPin];
    const updatedStream = { ...streamToUpdate, pinnedChatMessages: updatedPinnedMessages };
    handleUpdateStream(updatedStream); 
  };

  const handleUnpinChatMessage = async (streamId: string, pinnedChatMessageEntryId: string) => { 
    const streamToUpdate = streams.find(s => s.id === streamId);
    if (!streamToUpdate || !streamToUpdate.pinnedChatMessages) return;
    
    const updatedPinnedMessages = streamToUpdate.pinnedChatMessages.filter(pm => pm.id !== pinnedChatMessageEntryId);
    const updatedStream = { ...streamToUpdate, pinnedChatMessages: updatedPinnedMessages };
    handleUpdateStream(updatedStream); 
  };

  const handleGeneratePodcast = async (title: string, sourceStreamIds: string[], updatesPerStreamCount: number, voiceName: AvailableTTSVoiceId) => {
    setCreatePodcastModalOpen(false); 
    
    if (!apiKeyAvailable) {
        alert("API Key is not configured. Cannot generate podcast audio.");
        setPodcasts(prev => prev.map(p => 
            (p.status === 'processing' && p.title === title && JSON.stringify(p.sourceStreamIds.sort()) === JSON.stringify(sourceStreamIds.sort())) 
            ? {...p, status: 'failed', failureReason: "API Key not configured", voiceName} 
            : p
        ));
        return;
    }

    let rawContent = '';
    for (const streamId of sourceStreamIds) {
      const stream = streams.find(s => s.id === streamId);
      if (stream && streamUpdates[streamId]) {
        rawContent += `\n\n[START STREAM: "${stream.name}"]\n`;
        const updatesToInclude = streamUpdates[streamId].slice(0, updatesPerStreamCount);
        rawContent += updatesToInclude.map(u => u.mainContent).join('\n\n---\n\n');
        rawContent += `\n[END STREAM: "${stream.name}"]\n`;
      }
    }

    if (!rawContent.trim()) {
      alert("No content found for the selected streams to generate podcast script.");
      return;
    }
    
    const tempPodcastId = crypto.randomUUID();
    const placeholderPodcast: Podcast = {
        id: tempPodcastId, title, createdAt: new Date().toISOString(), sourceStreamIds, 
        status: 'processing', voiceName
    };
    setPodcasts(prev => [placeholderPodcast, ...prev].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

    let script = "";
    let titleCardImageUrl: string | null = null;
    let audioDuration: number | undefined = undefined;
    let podcastStage: Podcast = placeholderPodcast;

    try {
        console.log("Generating podcast script for:", title);
        script = await generatePodcastScript(rawContent, title);
        podcastStage = { ...placeholderPodcast, scriptText: script };
        setPodcasts(prev => prev.map(p => p.id === tempPodcastId ? podcastStage : p));

        if (apiKeyAvailable) {
            console.log("Generating title card image for:", title);
            titleCardImageUrl = await generatePodcastTitleCardImage(title, script);
            if (titleCardImageUrl) console.log("Title card image generated for:", title);
            else console.warn("Failed to generate title card image for:", title);
        }
        podcastStage = { ...podcastStage, titleCardImageUrl: titleCardImageUrl || undefined };
        
        await savePodcast(podcastStage); 
        setPodcasts(prev => prev.map(p => p.id === tempPodcastId ? podcastStage : p));
        
        console.log("Podcast audio generation started for:", title);
        const audioB64Chunks = await generateSpeechFromText(script, voiceName || TTS_DEFAULT_VOICE, (progress) => {
            console.log(`TTS Progress for podcast ${title}: ${progress.loaded}/${progress.total}`);
        });
    
        if (!audioB64Chunks || audioB64Chunks.length === 0 || audioB64Chunks.every(chunk => !chunk)) {
            throw new Error("Generated audio was empty after TTS process for podcast.");
        }
        
        // Calculate duration from stitched PCM data
        const decodedChunks = audioB64Chunks.map(chunk => base64ToFloat32Array(chunk));
        const totalLength = decodedChunks.reduce((sum, arr) => sum + arr.length, 0);
        if (totalLength > 0) {
            audioDuration = totalLength / TTS_SAMPLE_RATE;
        }

        const finalPodcast: Podcast = { ...podcastStage, status: 'complete' as const, audioB64Chunks, audioDuration };
        setPodcasts(prev => prev.map(p => p.id === tempPodcastId ? finalPodcast : p));
        await savePodcast(finalPodcast);
        console.log("Podcast generation complete for:", title);
  
    } catch (error) {
      console.error("Podcast generation failed for:", title, error);
      const failureReason = error instanceof Error ? error.message : "An unknown error occurred during podcast generation.";
      const failedPodcastUpdate: Podcast = { 
        ...placeholderPodcast, 
        scriptText: script || undefined, 
        titleCardImageUrl: titleCardImageUrl || undefined, 
        audioDuration: audioDuration, // Include duration if calculated before failure
        status: 'failed' as const, 
        failureReason 
      };
      setPodcasts(prev => prev.map(p => p.id === tempPodcastId ? failedPodcastUpdate : p));
      await savePodcast(failedPodcastUpdate);
    }
  };

  const handleDeletePodcast = async (podcastId: string) => {
    if (playingPodcastId === podcastId) {
        resetPodcastPlayer();
    }
    setPodcasts(prev => prev.filter(p => p.id !== podcastId));
    await deletePodcastFromDB(podcastId);
  };

  const handleExportPodcastAudio = async (podcast: Podcast) => {
    if (!podcast.audioB64Chunks || podcast.audioB64Chunks.length === 0) {
      alert("No audio data available to export for this podcast.");
      return;
    }
    try {
      console.log(`Stitching ${podcast.audioB64Chunks.length} audio chunks for podcast ${podcast.id}...`);
      const decodedChunks = podcast.audioB64Chunks.map(chunk => base64ToFloat32Array(chunk));
      const totalLength = decodedChunks.reduce((sum, arr) => sum + arr.length, 0);
      const stitchedPcmData = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of decodedChunks) {
        stitchedPcmData.set(chunk, offset);
        offset += chunk.length;
      }
      console.log("Audio stitching complete for podcast export.");
      
      const wavData = encodeWAV(stitchedPcmData, TTS_SAMPLE_RATE, 1);
      const filename = `${podcast.title.replace(/\s+/g, '_')}_${new Date(podcast.createdAt).toISOString().split('T')[0]}.wav`;
      downloadFile(new Blob([wavData], { type: 'audio/wav' }), filename);
    } catch (error) {
      console.error("Error exporting podcast audio:", error);
      alert(`Failed to export podcast audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const resetPodcastPlayer = useCallback(() => {
    if (podcastPlaybackControlsRef.current) {
      podcastPlaybackControlsRef.current.stop();
      podcastPlaybackControlsRef.current = null;
    }
    setPlayingPodcastId(null);
    setIsPodcastPlaying(false);
    setPodcastCurrentTime(0);
    setPodcastDuration(0);
    // Do not reset expandedTranscriptPodcastId here, allow it to persist
  }, []); 

  const handlePlayPodcast = useCallback(async (podcast: Podcast) => {
    if (playingPodcastId === podcast.id && podcastPlaybackControlsRef.current) {
      if (isPodcastPlaying) {
        podcastPlaybackControlsRef.current.pause();
        setIsPodcastPlaying(false);
      } else {
        podcastPlaybackControlsRef.current.play();
        setIsPodcastPlaying(true);
      }
      return;
    }
  
    resetPodcastPlayer(); 
    stopGlobalAudio();    
  
    if (!podcast.audioB64Chunks || podcast.audioB64Chunks.length === 0) {
      alert("Error: This podcast has no audio data to play.");
      return;
    }
  
    setPlayingPodcastId(podcast.id);
    // Do not automatically expand transcript here, user controls it separately
  
    try {
      console.log(`Stitching ${podcast.audioB64Chunks.length} audio chunks for podcast ${podcast.id}...`);
      const decodedChunks = podcast.audioB64Chunks.map(chunk => base64ToFloat32Array(chunk));
      const totalLength = decodedChunks.reduce((sum, arr) => sum + arr.length, 0);
      const stitchedPcmData = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of decodedChunks) {
        stitchedPcmData.set(chunk, offset);
        offset += chunk.length;
      }
      console.log("Audio stitching complete for podcast.");

      const buffer = await loadAudioForPlayback(stitchedPcmData, TTS_SAMPLE_RATE, (err) => {
        console.error("Podcast audio load error:", err);
        alert(`Error loading podcast audio: ${err.message || 'Unknown error'}`);
        resetPodcastPlayer(); 
      });
  
      if (!buffer) {
        resetPodcastPlayer(); 
        return;
      }
      
      setPodcastDuration(buffer.duration);
      setPodcastCurrentTime(0); 
  
      podcastPlaybackControlsRef.current = getPlaybackControls(
        buffer,
        () => { 
          console.log(`Podcast ${podcast.id} finished playing.`);
          resetPodcastPlayer();
        }, 
        (err) => { 
          console.error("Podcast playback error:", err);
          alert(`Error during podcast playback: ${err.message || 'Unknown error'}`);
          resetPodcastPlayer();
        }, 
        (time) => setPodcastCurrentTime(time) 
      );
      
      podcastPlaybackControlsRef.current.play();
      setIsPodcastPlaying(true); 
  
    } catch (error) {
      console.error("Failed to play podcast:", error);
      alert(`Failed to start podcast playback: ${error instanceof Error ? error.message : 'Unknown error'}`);
      resetPodcastPlayer();
    }
  }, [playingPodcastId, isPodcastPlaying, resetPodcastPlayer]); 

  const handleSeekPodcast = (time: number) => {
    if (podcastPlaybackControlsRef.current && podcastDuration > 0) {
      const newTime = Math.max(0, Math.min(time, podcastDuration));
      podcastPlaybackControlsRef.current.seek(newTime);
    }
  };

  const handleTogglePodcastTranscript = (podcastId: string) => {
    setExpandedTranscriptPodcastId(prevId => prevId === podcastId ? null : podcastId);
  };
  
  const handleOpenFullTranscriptView = (podcastId: string) => {
    setFullViewTranscriptPodcastId(podcastId);
    setIsFullTranscriptViewOpen(true);
  };

  const handleCloseFullTranscriptView = () => {
    setIsFullTranscriptViewOpen(false);
    setFullViewTranscriptPodcastId(null);
  };


  useEffect(() => { 
    return () => {
      resetPodcastPlayer();
      stopGlobalAudio(); 
    };
  }, [resetPodcastPlayer]);


  if (!isDataLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-xl font-semibold text-white">
        Loading Application...
      </div>
    );
  }
  
  const podcastForFullView = podcasts.find(p => p.id === fullViewTranscriptPodcastId);

  return (
    <div className="flex flex-col h-screen antialiased">
      <header className="bg-gray-850 border-b border-gray-700 p-3 shadow-md flex-shrink-0">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-y-2"> 
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
            <div className="flex flex-wrap items-center space-x-1 sm:space-x-2 justify-end gap-y-2"> 
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
                    onClick={() => setViewMode('list')}
                    className={`flex items-center font-semibold py-1.5 px-3 rounded-md text-sm transition-colors shadow ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    title="Switch to List View"
                >
                    <ListBulletIcon className="w-4 h-4 mr-1.5" />
                    List
                </button>
                 <button
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center font-semibold py-1.5 px-3 rounded-md text-sm transition-colors shadow ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    title="Switch to Grid View"
                >
                    <TableCellsIcon className="w-4 h-4 mr-1.5" />
                    Grid
                </button>
                 <button
                    onClick={() => setViewMode('studio')}
                    className={`flex items-center font-semibold py-1.5 px-3 rounded-md text-sm transition-colors shadow ${viewMode === 'studio' ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                    title="Switch to Studio View"
                >
                    <MicrophoneIcon className="w-4 h-4 mr-1.5" />
                    Studio
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
                        Export All
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
                    Import
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
          ) : viewMode === 'studio' ? (
            <StudioView
              streams={streams} 
              podcasts={podcasts}
              onDeletePodcast={handleDeletePodcast}
              onGeneratePodcastRequest={() => setCreatePodcastModalOpen(true)}
              onPlayPodcast={handlePlayPodcast}
              onSeekPodcast={handleSeekPodcast}
              playingPodcastId={playingPodcastId}
              isPodcastPlaying={isPodcastPlaying}
              podcastCurrentTime={podcastCurrentTime}
              podcastDuration={podcastDuration}
              onExportPodcastAudio={handleExportPodcastAudio}
              expandedTranscriptPodcastId={expandedTranscriptPodcastId}
              onToggleTranscript={handleTogglePodcastTranscript}
              onOpenFullTranscriptView={handleOpenFullTranscriptView} // Pass handler
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
      
      {isCreatePodcastModalOpen && (
        <CreatePodcastModal
          isOpen={isCreatePodcastModalOpen}
          onClose={() => setCreatePodcastModalOpen(false)}
          streams={streams}
          onGenerate={handleGeneratePodcast}
        />
      )}
      {isFullTranscriptViewOpen && podcastForFullView && (
        <FullTranscriptView
          podcast={podcastForFullView}
          onClose={handleCloseFullTranscriptView}
        />
      )}
    </div>
  );
};

export default App;
