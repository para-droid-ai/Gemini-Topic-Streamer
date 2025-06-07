// components/StreamView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Stream, StreamUpdate, ChatMessage, StreamContextPreference, StreamDetailLevel, GroundingChunk, PinnedChatMessage } from '../types'; 
import StreamUpdateCard, { formatTimeAgo } from './StreamUpdateCard';
import { 
    RefreshIcon, LoadingSpinner, PaperAirplaneIcon, XMarkIcon, 
    PencilSquareIcon, ClipboardDocumentIcon, DocumentTextIcon, ArrowDownTrayIcon, ChevronDownIcon, TagIcon,
    SparklesIcon, BackwardIcon, ArchiveBoxIcon, ArrowUpIcon, ArrowDownIcon, ArrowSmallUpIcon, DocumentDuplicateIcon,
    MagnifyingGlassIcon, ClipboardDocumentListIcon, PinIcon 
} from './icons';
import { createChatSession, sendMessageInChat } from '../services/geminiService';
import { AVAILABLE_MODELS, DEFAULT_GEMINI_MODEL_ID } from '../constants';
import type { Chat } from '@google/genai';
import MarkdownRenderer from './MarkdownRenderer';
import { convertToCSV, downloadFile } from '../utils/exportUtils';


interface StreamViewProps {
  stream: Stream | null;
  updatesForStream: StreamUpdate[];
  isLoading: boolean;
  error: string | null;
  onRefresh: (stream: Stream) => void;
  apiKeyAvailable: boolean;
  onEditStream: (streamId: string) => void;
  onUpdateContextPreference: (streamId: string, preference: StreamContextPreference) => void; 
  onUpdateDetailLevel: (streamId: string, detailLevel: StreamDetailLevel) => void; 
  onDeleteStreamUpdate: (streamId: string, updateId: string) => void;
  isSidebarCollapsed: boolean; 
  onPinChatMessage: (streamId: string, chatMessage: ChatMessage) => void; 
  onUnpinChatMessage: (streamId: string, pinnedChatMessageId: string) => void; 
}

const StreamView: React.FC<StreamViewProps> = ({ 
    stream, updatesForStream, isLoading, error, onRefresh, 
    apiKeyAvailable, onEditStream, onUpdateContextPreference, onUpdateDetailLevel, onDeleteStreamUpdate,
    isSidebarCollapsed, onPinChatMessage, onUnpinChatMessage
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [activeChatSession, setActiveChatSession] = useState<Chat | null>(null);
  const [chatContextContent, setChatContextContent] = useState<string | null>(null); 
  const [chatContextTitle, setChatContextTitle] = useState<string | null>(null);

  const [showStreamExportMenu, setShowStreamExportMenu] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [currentNavIndex, setCurrentNavIndex] = useState(0);
  
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const streamExportMenuRef = useRef<HTMLDivElement>(null);
  const mainContentAreaRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (isChatOpen && stream) {
      if (!activeChatSession) { 
        if (stream.pinnedChatMessages && stream.pinnedChatMessages.length > 0) {
          const pinnedToDisplay: ChatMessage[] = stream.pinnedChatMessages.map(pm => ({
            id: pm.messageId, 
            role: pm.role,
            text: pm.text,
            timestamp: pm.originalTimestamp,
          }));
          setChatMessages(pinnedToDisplay);
          setChatContextTitle(`${stream.name} - Pinned Messages`);
        } else {
          setChatMessages([]); 
          setChatContextTitle(`${stream.name} - Chat`);
        }
        setChatError(null);
        setChatContextContent(null); 
      }
    } else if (!isChatOpen) {
      setActiveChatSession(null);
      setChatMessages([]); 
      setChatContextContent(null);
      setChatContextTitle(null);
      setChatInput('');
      setChatError(null);
    }
  }, [isChatOpen, stream, activeChatSession]);


  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (streamExportMenuRef.current && !streamExportMenuRef.current.contains(event.target as Node)) {
        setShowStreamExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const mainArea = mainContentAreaRef.current;
    const handleScroll = () => {
      if (mainArea) {
        setShowScrollToTop(mainArea.scrollTop > 100);
      }
    };

    if (mainArea && updatesForStream.length > 0) {
      mainArea.addEventListener('scroll', handleScroll);
      handleScroll(); 
    } else {
      setShowScrollToTop(false);
    }
    return () => mainArea?.removeEventListener('scroll', handleScroll);
  }, [updatesForStream.length, mainContentAreaRef]);


  useEffect(() => {
    setCurrentNavIndex(0); 
    mainContentAreaRef.current?.scrollTo({ top: 0, behavior: 'auto' }); 
  }, [stream]); 


  const handleRefresh = () => {
    if (stream) {
      mainContentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      setCurrentNavIndex(0);
      onRefresh(stream); 
    }
  };

  const handleEditStream = () => {
    if (stream) {
      onEditStream(stream.id);
    }
  };

  const handleStartDeepDiveChat = (updateContent: string, updateTimestamp: string) => {
    if (!apiKeyAvailable || !stream) { 
        setChatError("Gemini API Key is not configured or stream is not available. Chat functionality is disabled.");
        setIsChatOpen(true); 
        setActiveChatSession(null);
        setChatMessages([]);
        setChatContextTitle(stream ? `${stream.name} - Chat Error` : "Chat Error");
        return;
    }

    setChatContextContent(updateContent); 
    const newContextTitle = `Deep Dive on: Update from ${new Date(updateTimestamp).toLocaleString()}`;
    setChatContextTitle(newContextTitle);
    
    const session = createChatSession(updateContent);
    if (session) {
      setActiveChatSession(session);
      
      let initialMessages: ChatMessage[] = [];
      if (stream.pinnedChatMessages && stream.pinnedChatMessages.length > 0) {
        const pinnedToDisplay: ChatMessage[] = stream.pinnedChatMessages.map(pm => ({
          id: pm.messageId, 
          role: pm.role,
          text: pm.text,
          timestamp: pm.originalTimestamp,
        }));
        initialMessages = [...pinnedToDisplay];
      }

      initialMessages.push({
        id: crypto.randomUUID(),
        role: 'model',
        text: "Understood. I have reviewed the context of this specific update. I'm ready for your questions about it. Previously pinned messages relevant to this stream are shown above for your reference.",
        timestamp: new Date().toISOString()
      });

      setChatMessages(initialMessages);
      setChatError(null);
    } else {
      setChatError("Failed to initialize chat session. Check API key and console for details.");
      setActiveChatSession(null);
      setChatMessages([]); 
    }
    setIsChatOpen(true);
  };

  const handleCloseChat = () => {
    setIsChatOpen(false);
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !activeChatSession || isChatLoading || !stream) return;

    const newUserMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: chatInput.trim(), timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput('');
    setIsChatLoading(true);
    setChatError(null);

    try {
      const { text: modelResponseText, groundingMetadata } = await sendMessageInChat(activeChatSession, newUserMessage.text);
      const newModelMessage: ChatMessage = { 
          id: crypto.randomUUID(), 
          role: 'model', 
          text: modelResponseText, 
          timestamp: new Date().toISOString(),
          groundingMetadata 
      };
      setChatMessages(prev => [...prev, newModelMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred in chat.";
      setChatError(errorMessage);
      setChatMessages(prev => [...prev, {id: crypto.randomUUID(), role: 'model', text: `Error: ${errorMessage}`, timestamp: new Date().toISOString()}]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleTogglePinMessage = (chatMsg: ChatMessage) => {
    if (!stream) return;
    const existingPin = stream.pinnedChatMessages?.find(pm => pm.messageId === chatMsg.id);
    if (existingPin) {
      onUnpinChatMessage(stream.id, existingPin.id);
    } else {
      onPinChatMessage(stream.id, chatMsg);
    }
  };
  
  const copyEntireStreamToClipboard = () => {
    if (!stream || updatesForStream.length === 0) return;
    const fullContent = updatesForStream
        .slice() 
        .reverse() 
        .map(update => {
          const totalUpdateTokens = (update.mainContentTokens || 0) + (update.reasoningTokens || 0);
          return `## Update: ${new Date(update.timestamp).toLocaleString()}\n\n${update.mainContent}\n\nEstimated Tokens: ${totalUpdateTokens > 0 ? totalUpdateTokens : 'N/A'}\n\n---\n\n`;
        })
        .join('');
    navigator.clipboard.writeText(fullContent)
      .then(() => alert(`${stream.name} - All updates copied to clipboard!`))
      .catch(err => alert('Failed to copy stream: ' + err));
    setShowStreamExportMenu(false);
  };

  const exportEntireStreamToFile = (format: 'txt' | 'md' | 'csv') => {
    if (!stream || updatesForStream.length === 0) return;
    
    const filenameBase = `${stream.name.replace(/\s+/g, '_')}_all_updates_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      const headers = ['update_id', 'timestamp', 'main_content', 'reasoning_content', 'main_content_tokens', 'reasoning_tokens', 'grounding_source_urls'];
      const data = updatesForStream.map(update => {
        const groundingUrls = (update.groundingMetadata || [])
          .map(chunk => chunk.web?.uri || chunk.retrievedContext?.uri)
          .filter(Boolean)
          .join(', ');
        return {
          update_id: update.id,
          timestamp: update.timestamp,
          main_content: update.mainContent,
          reasoning_content: update.reasoningContent || '',
          main_content_tokens: update.mainContentTokens || 0,
          reasoning_tokens: update.reasoningTokens || 0,
          grounding_source_urls: groundingUrls,
        };
      });
      const csvString = convertToCSV(data.slice().reverse(), headers); 
      downloadFile(csvString, `${filenameBase}.csv`, 'text/csv;charset=utf-8;');
    } else {
      const fullContent = updatesForStream
          .slice()
          .reverse() 
          .map(update => {
              let content = `## Update: ${new Date(update.timestamp).toLocaleString()}\n\n`;
              content += `${update.mainContent}\n\n`;
              if (update.reasoningContent) {
                content += `### Reasoning/Thoughts:\n${update.reasoningContent}\n\n`;
              }
              if(update.groundingMetadata && update.groundingMetadata.length > 0){
                  content += `### Sources:\n`;
                  update.groundingMetadata.forEach(chunk => {
                      const sourceInfo = chunk.web || chunk.retrievedContext;
                      if(sourceInfo && sourceInfo.uri && sourceInfo.uri !== '#') {
                           content += `- [${sourceInfo.title || sourceInfo.uri}](${sourceInfo.uri})\n`;
                      }
                  });
                  content += `\n`;
              }
              const totalUpdateTokens = (update.mainContentTokens || 0) + (update.reasoningTokens || 0);
              content += `Estimated Tokens: ${totalUpdateTokens > 0 ? totalUpdateTokens : 'N/A'}\n\n`;
              content += `---\n\n`;
              return content;
          })
          .join('');
      downloadFile(fullContent, `${filenameBase}.${format}`, format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8');
    }
    setShowStreamExportMenu(false);
  };

  const totalStreamTokens = React.useMemo(() => {
    return updatesForStream.reduce((sum, update) => sum + (update.mainContentTokens || 0) + (update.reasoningTokens || 0), 0);
  }, [updatesForStream]);

  const scrollToSummaryByIndex = (index: number) => {
    if (index >= 0 && index < updatesForStream.length) {
      const updateId = updatesForStream[index].id;
      const targetElement = mainContentAreaRef.current?.querySelector(`#summary-card-${updateId}`);
      
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentNavIndex(index); 
      } else {
        console.error(`Scroll navigation error: Target element 'summary-card-${updateId}' for index ${index} not found.`);
      }
    }
  };

  const handleScrollToOlderSummary = () => { 
    if (currentNavIndex < updatesForStream.length - 1) {
      scrollToSummaryByIndex(currentNavIndex + 1);
    }
  };

  const handleScrollToNewerSummary = () => { 
    if (currentNavIndex > 0) {
      scrollToSummaryByIndex(currentNavIndex - 1);
    }
  };

  const getThinkingBudgetText = () => {
    if (!stream) return null;
    const modelConfig = AVAILABLE_MODELS.find(m => m.id === (stream.modelName || DEFAULT_GEMINI_MODEL_ID));
    
    if (stream.reasoningMode !== 'request' || !modelConfig?.supportsThinkingConfig) {
        return null;
    }
    
    if (stream.autoThinkingBudget === true || stream.autoThinkingBudget === undefined) { 
      return "Think Budget: Auto";
    }
    if (stream.thinkingTokenBudget === 0) {
      return "Think Budget: Off";
    }
    if (stream.thinkingTokenBudget && stream.thinkingTokenBudget > 0) {
      return `Think Budget: ${stream.thinkingTokenBudget.toLocaleString()}`;
    }
    return null; 
  };
  const thinkingBudgetText = getThinkingBudgetText();

  if (!apiKeyAvailable && !stream) {
    return (
      <div className="flex-grow p-6 flex flex-col items-center justify-center text-center bg-gray-850">
        <h2 className="text-2xl font-semibold text-yellow-400 mb-4">API Key Not Configured</h2>
        <p className="text-gray-300 max-w-md">The Gemini API key is missing. Please ensure the <code>API_KEY</code> environment variable is set up correctly. Features are disabled.</p>
      </div>
    );
  }
  
  if (!stream) {
    return (
      <div className="flex-grow p-6 flex items-center justify-center text-gray-500 bg-gray-850">
        <p className="text-xl">Select a stream or add a new one.</p>
      </div>
    );
  }
  
  const contextPreferenceButtonClass = (preference: StreamContextPreference) => 
    `p-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-850 ${
      stream.contextPreference === preference 
        ? 'bg-green-600 text-white hover:bg-green-500 focus:ring-green-500' 
        : 'bg-gray-600 text-gray-200 hover:bg-gray-500 focus:ring-indigo-500'
    }`;

  const detailLevelButtonClass = (level: StreamDetailLevel) =>
    `p-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-850 ${
      stream.detailLevel === level
        ? 'bg-purple-600 text-white hover:bg-purple-500 focus:ring-purple-500'
        : 'bg-gray-600 text-gray-200 hover:bg-gray-500 focus:ring-indigo-500'
    }`;

  const lastUpdateTime = updatesForStream.length > 0 ? updatesForStream[0].timestamp : null;

  const chatPopupWidthClass = isSidebarCollapsed 
    ? 'md:w-[calc(100vw-4rem)] lg:w-[calc(100vw-5rem)]' 
    : 'md:w-[calc(100vw-320px-4rem)] lg:w-[calc(100vw-320px-5rem)]';

  const currentModelConfig = AVAILABLE_MODELS.find(m => m.id === (stream.modelName || DEFAULT_GEMINI_MODEL_ID)) || 
                             AVAILABLE_MODELS.find(m => m.id === DEFAULT_GEMINI_MODEL_ID);
  const displayModelName = currentModelConfig?.name || (stream.modelName || DEFAULT_GEMINI_MODEL_ID);

  const pinnedMessagesCount = stream.pinnedChatMessages?.length || 0;

  const renderChatGroundingMetadata = (metadata?: GroundingChunk[]) => {
    if (!metadata || metadata.length === 0) return null;
    const validSources = metadata.filter(chunk =>
        (chunk.web && chunk.web.uri && chunk.web.uri !== '#') ||
        (chunk.retrievedContext && chunk.retrievedContext.uri)
    );
    if (validSources.length === 0) return null;

    return (
      <div className="mt-1.5 pt-1 border-t border-gray-600">
        <h6 className="text-xs font-semibold text-gray-400 mb-0.5">Sources:</h6>
        <ul className="list-disc list-inside space-y-0.5">
          {validSources.map((chunk, index) => {
             const sourceInfo = chunk.web || chunk.retrievedContext;
             if (!sourceInfo || !sourceInfo.uri || sourceInfo.uri === '#') return null;
             return (
                <li key={`chat-grounding-${index}`} className="text-xs">
                  <a
                    href={sourceInfo.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-200 hover:underline truncate block"
                    title={sourceInfo.title || sourceInfo.uri}
                  >
                    {sourceInfo.title || sourceInfo.uri}
                  </a>
                </li>
             );
          })}
        </ul>
      </div>
    );
  };


  return (
    <div className="flex-grow p-4 md:p-6 bg-gray-850 overflow-y-hidden h-full flex flex-col">
      <div className="mb-3 flex-shrink-0">
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center">
                 <h1 className="text-2xl font-bold text-white mr-2 truncate" title={stream.name}>{stream.name}</h1>
                 <button onClick={handleEditStream} className="text-gray-400 hover:text-white p-1" aria-label="Edit stream settings">
                    <PencilSquareIcon className="w-5 h-5" />
                </button>
                {pinnedMessagesCount > 0 && (
                  <span className="ml-2 bg-yellow-500 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center" title={`${pinnedMessagesCount} pinned chat messages included in new update context (if context is enabled)`}>
                    <PinIcon className="w-3 h-3 mr-1" isPinned={true} /> {pinnedMessagesCount}
                  </span>
                )}
            </div>
            <div className="flex items-center space-x-2">
                {showScrollToTop && updatesForStream.length > 0 && (
                    <button
                        onClick={() => mainContentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="p-1.5 rounded-md text-white bg-sky-600 hover:bg-sky-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-850 focus:ring-sky-500"
                        aria-label="Scroll to top of summaries"
                        title="Scroll to Top"
                    >
                        <ArrowSmallUpIcon className="w-4 h-4" />
                    </button>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="flex items-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white font-semibold p-2 rounded-md text-sm transition-colors shadow"
                  aria-label="Refresh stream for new updates"
                  title={isLoading ? "Refreshing..." : "Refresh stream"}
                >
                  {isLoading ? <LoadingSpinner className="w-4 h-4" /> : <RefreshIcon className="w-4 h-4" />}
                </button>
                <div className="relative" ref={streamExportMenuRef}>
                    <button 
                        onClick={() => setShowStreamExportMenu(!showStreamExportMenu)}
                        disabled={updatesForStream.length === 0}
                        className="flex items-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-500 text-white font-semibold p-2 rounded-md text-sm transition-colors shadow"
                        aria-haspopup="true"
                        aria-expanded={showStreamExportMenu}
                        aria-label="Export entire stream history"
                        title="Export entire stream history"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        <ChevronDownIcon className={`w-4 h-4 ml-0.5 transition-transform ${showStreamExportMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showStreamExportMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-gray-700 border border-gray-600 rounded-md shadow-xl z-20 py-1">
                            <button onClick={copyEntireStreamToClipboard} className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 flex items-center"><ClipboardDocumentIcon className="w-4 h-4 mr-2" /> Copy All to Clipboard</button>
                            <button onClick={() => exportEntireStreamToFile('txt')} className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 flex items-center"><DocumentTextIcon className="w-4 h-4 mr-2" /> Export All to .txt</button>
                            <button onClick={() => exportEntireStreamToFile('md')} className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 flex items-center"><DocumentTextIcon className="w-4 h-4 mr-2" /> Export All to .md</button>
                            <button onClick={() => exportEntireStreamToFile('csv')} className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 flex items-center"><DocumentDuplicateIcon className="w-4 h-4 mr-2" /> Export All to .csv</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <p className="text-xs text-gray-400 italic mb-1.5 truncate" title={stream.focus}>Focus: {stream.focus}</p>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-2 sm:space-y-0 mb-2.5">
            <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400 font-medium">Context:</span>
                <button 
                    onClick={() => onUpdateContextPreference(stream.id, 'none')}
                    className={contextPreferenceButtonClass('none')}
                    aria-pressed={stream.contextPreference === 'none'}
                    title="Fresh Update (No Context)"
                >
                    <SparklesIcon className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => onUpdateContextPreference(stream.id, 'last')}
                    className={contextPreferenceButtonClass('last')}
                    disabled={updatesForStream.length === 0}
                    aria-pressed={stream.contextPreference === 'last'}
                    title="Use Last Summary"
                >
                    <BackwardIcon className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => onUpdateContextPreference(stream.id, 'all')}
                    className={contextPreferenceButtonClass('all')}
                    disabled={updatesForStream.length === 0}
                    aria-pressed={stream.contextPreference === 'all'}
                    title="Use All Summaries"
                >
                    <ArchiveBoxIcon className="w-4 h-4" />
                </button>
            </div>
             <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400 font-medium">Detail:</span>
                <button 
                    onClick={() => onUpdateDetailLevel(stream.id, 'brief')}
                    className={detailLevelButtonClass('brief')}
                    aria-pressed={stream.detailLevel === 'brief'}
                    title="Brief (~1000 words)"
                >
                    <ClipboardDocumentListIcon className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => onUpdateDetailLevel(stream.id, 'comprehensive')}
                    className={detailLevelButtonClass('comprehensive')}
                    aria-pressed={stream.detailLevel === 'comprehensive'}
                    title="Comprehensive (~5000 words)"
                >
                    <DocumentTextIcon className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => onUpdateDetailLevel(stream.id, 'research')}
                    className={detailLevelButtonClass('research')}
                    aria-pressed={stream.detailLevel === 'research'}
                    title="Research (~10000 words)"
                >
                    <MagnifyingGlassIcon className="w-4 h-4" />
                </button>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
            <span className="bg-sky-700 text-sky-100 px-2 py-0.5 rounded-full">Temp: {stream.temperature.toFixed(1)}</span>
            <span className="bg-pink-700 text-pink-100 px-2 py-0.5 rounded-full flex items-center" title={`Using model: ${displayModelName}`}>
                Model: {displayModelName}
                {(stream.reasoningMode === 'request' && currentModelConfig?.supportsThinkingConfig) ? <span role="img" aria-label="brain" title="Reasoning: Requested & Supported" className="ml-1.5 text-sm">🧠</span> : <span title={`Reasoning: ${stream.reasoningMode === 'request' ? 'Requested (Experimental)' : 'Off'}`} className="ml-1.5 text-sm opacity-60">🧠</span>}
            </span>
            {thinkingBudgetText && (
                 <span className="bg-purple-700 text-purple-100 px-2 py-0.5 rounded-full" title={thinkingBudgetText}>
                    {thinkingBudgetText}
                </span>
            )}
            {lastUpdateTime && (
                 <span className="bg-sky-600 text-sky-100 px-2 py-0.5 rounded-full">
                    {formatTimeAgo(lastUpdateTime, 'short')}
                </span>
            )}
            {totalStreamTokens > 0 && (
              <span className="bg-gray-600 text-gray-200 px-2 py-0.5 rounded-full flex items-center" title="Estimated total tokens for all updates in this stream">
                <TagIcon className="w-3 h-3 mr-1 opacity-80" />
                Stream Tokens: {totalStreamTokens.toLocaleString()}
              </span>
            )}
        </div>
      </div>

      <div ref={mainContentAreaRef} className="flex-grow overflow-y-auto space-y-4 pr-1 relative">
        {isLoading && updatesForStream.length === 0 && ( 
          <div className="flex flex-col items-center justify-center py-10">
            <LoadingSpinner className="w-10 h-10 mb-3" />
            <p className="text-gray-400">Fetching initial updates for "{stream.name}"...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md relative mb-4 mx-1" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}
        
        {!isLoading && updatesForStream.length === 0 && !error && (
          <div className="text-center text-gray-500 py-10">
            <p>No updates for this stream yet. Click the refresh icon to fetch.</p>
          </div>
        )}
        
        {updatesForStream.map((update, index) => (
          <StreamUpdateCard 
            id={`summary-card-${update.id}`}
            key={update.id} 
            update={update} 
            streamName={stream.name}
            apiKeyAvailable={apiKeyAvailable}
            onStartDeepDive={handleStartDeepDiveChat}
            onDeleteUpdate={(updateId) => {
              if (stream) {
                onDeleteStreamUpdate(stream.id, updateId);
              }
            }}
            isNewest={index === 0 && isLoading} 
          />
        ))}

        {updatesForStream.length > 1 && !isChatOpen && (
          <div className="fixed bottom-4 right-4 z-20 flex flex-col space-y-2">
             <button
                onClick={handleScrollToNewerSummary}
                disabled={currentNavIndex <= 0}
                className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Scroll to newer summary (page scrolls up)"
                title="Newer Summary (Page Up)"
            >
                <ArrowUpIcon className="w-5 h-5" />
            </button>
            <button
                onClick={handleScrollToOlderSummary}
                disabled={currentNavIndex >= updatesForStream.length - 1}
                className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Scroll to older summary (page scrolls down)"
                title="Older Summary (Page Down)"
            >
                <ArrowDownIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {isChatOpen && (
        <div 
            className={`fixed bottom-0 right-0 mb-4 mr-4 md:mr-6 lg:mr-8 z-30 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 flex flex-col
                       max-h-[70vh] h-3/5 w-11/12 sm:w-4/5 ${chatPopupWidthClass} 
                       min-h-[250px] max-w-3xl
                      `}
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="chat-popup-title"
        >
          <div className="flex justify-between items-center p-3 border-b border-gray-700 flex-shrink-0">
            <h3 id="chat-popup-title" className="text-base font-semibold text-white truncate" title={chatContextTitle || "Chat"}>
                {chatContextTitle || "Chat"}
            </h3>
            <button onClick={handleCloseChat} className="p-1 text-gray-400 hover:text-white" aria-label="Close chat">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-grow p-3 overflow-y-auto space-y-3 bg-gray-850">
            {chatError && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-3 py-2 rounded-md text-xs" role="alert">
                <strong>Error:</strong> {chatError}
              </div>
            )}
            {(chatMessages.length === 0 && !chatError && !activeChatSession && (!stream?.pinnedChatMessages || stream.pinnedChatMessages.length === 0)) && (
                 <div className="text-center text-gray-400 text-sm p-4">
                    {apiKeyAvailable ? "Select an update to start a deep dive chat, or pin messages to see them here." : "API Key not configured. Chat functionality is disabled."}
                </div>
            )}

            {chatMessages.map((msg) => {
              const isPinned = stream?.pinnedChatMessages?.some(pm => pm.messageId === msg.id) || false;
              const pinButtonBaseClasses = "absolute -top-2 -right-2 p-1 rounded-full transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-gray-800";
              const pinButtonDynamicClasses = isPinned
                  ? "bg-yellow-500 text-black hover:bg-yellow-600 ring-yellow-400"
                  : "bg-gray-600 text-gray-200 hover:bg-gray-500 ring-gray-400";
              
              return (
                <div key={msg.id} className={`flex group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`relative max-w-xs md:max-w-md lg:max-w-lg px-3 py-2 rounded-lg shadow ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'} ${isPinned ? 'bg-yellow-200 dark:bg-yellow-800/50 ring-2 ring-yellow-500' : ''}`}>
                    <button 
                      onClick={() => handleTogglePinMessage(msg)}
                      className={`${pinButtonBaseClasses} ${pinButtonDynamicClasses}`}
                      title={isPinned ? "Unpin message from stream context" : "Pin message to stream context"}
                      aria-pressed={isPinned}
                    >
                      <PinIcon className="w-3.5 h-3.5" isPinned={isPinned} />
                    </button>
                    {msg.role === 'model' ? <MarkdownRenderer markdownContent={msg.text} /> : <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                    {msg.role === 'model' && msg.groundingMetadata && renderChatGroundingMetadata(msg.groundingMetadata)}
                    <p className="text-xs opacity-60 mt-1 text-right">{formatTimeAgo(msg.timestamp, 'short')}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatMessagesEndRef} />
          </div>
          {apiKeyAvailable && stream && (
            <div className="p-3 border-t border-gray-700 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChatMessage(); }}}
                  placeholder={activeChatSession ? "Ask about this update (uses web search)..." : "Pin messages to create context for the stream."}
                  className="flex-grow bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-100 resize-none"
                  rows={2}
                  disabled={isChatLoading || (!activeChatSession && !stream)} 
                  aria-label="Chat input message"
                />
                <button 
                    onClick={handleSendChatMessage} 
                    disabled={isChatLoading || !chatInput.trim() || (!activeChatSession && !stream)} 
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed" 
                    aria-label="Send chat message"
                >
                  {isChatLoading ? <LoadingSpinner className="w-5 h-5" /> : <PaperAirplaneIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StreamView;
