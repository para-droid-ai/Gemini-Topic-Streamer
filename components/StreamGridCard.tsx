
import React, { useState, useRef, useEffect, useMemo } from 'react'; 
import { Stream, StreamUpdate, StreamContextPreference, GroundingChunk, StreamDetailLevel } from '../types';
import { formatTimeAgo } from './StreamUpdateCard';
import { 
    TagIcon, ArrowDownTrayIcon, ChevronDownIcon, DocumentTextIcon, PencilSquareIcon, 
    DocumentDuplicateIcon, SparklesIcon, BackwardIcon, ArchiveBoxIcon, RefreshIcon, LoadingSpinner,
    ArrowsPointingOutIcon, ArrowsPointingInIcon, ChevronUpIcon,
    MagnifyingGlassIcon, ClipboardDocumentListIcon 
} from './icons';
import MarkdownRenderer from './MarkdownRenderer';
import { AVAILABLE_MODELS, DEFAULT_GEMINI_MODEL_ID } from '../constants';


interface StreamGridCardProps {
  stream: Stream;
  streamUpdates: StreamUpdate[]; 
  isLoading: boolean;
  onSelectStream: () => void;
  onEditStream: () => void;
  onExportStream: (format: 'txt' | 'md' | 'csv') => void;
  onRefreshStream: () => void;
  onUpdateContextPreference: (preference: StreamContextPreference) => void;
  onUpdateDetailLevel: (detailLevel: StreamDetailLevel) => void; 
  isMaximized: boolean;
  onToggleMaximize: () => void;
  areAllSummariesExpanded: boolean;
  onToggleAllSummariesExpansion: () => void;
}

const StreamGridCard: React.FC<StreamGridCardProps> = ({ 
  stream, 
  streamUpdates, 
  isLoading,
  onSelectStream,
  onEditStream,
  onExportStream,
  onRefreshStream,
  onUpdateContextPreference,
  onUpdateDetailLevel, 
  isMaximized,
  onToggleMaximize,
  areAllSummariesExpanded,
  onToggleAllSummariesExpansion
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [showReasoning, setShowReasoning] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const totalTokens = useMemo(() => {
    return streamUpdates.reduce((sum, update) => sum + (update.mainContentTokens || 0) + (update.reasoningTokens || 0), 0);
  }, [streamUpdates]);

  const currentModelConfig = AVAILABLE_MODELS.find(m => m.id === (stream.modelName || DEFAULT_GEMINI_MODEL_ID)) || 
                             AVAILABLE_MODELS.find(m => m.id === DEFAULT_GEMINI_MODEL_ID);
  const displayModelName = currentModelConfig?.name || (stream.modelName || DEFAULT_GEMINI_MODEL_ID);


  const contextPreferenceButtonClass = (preference: StreamContextPreference) => 
    `p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 ${
      stream.contextPreference === preference 
        ? 'bg-green-600 text-white hover:bg-green-500 focus:ring-green-500' 
        : 'bg-gray-600 text-gray-300 hover:bg-gray-500 focus:ring-indigo-500'
    }`;

  const detailLevelButtonClass = (level: StreamDetailLevel) =>
    `p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-gray-700 ${
      stream.detailLevel === level
        ? 'bg-purple-600 text-white hover:bg-purple-500 focus:ring-purple-500'
        : 'bg-gray-600 text-gray-300 hover:bg-gray-500 focus:ring-indigo-500'
    }`;

  const toggleReasoning = (updateId: string) => {
    setShowReasoning(prev => ({ ...prev, [updateId]: !prev[updateId] }));
  };

  const showFullCardContent = isMaximized || areAllSummariesExpanded;
  const tableHidingClass = !isMaximized ? 'hide-tables-in-grid-card' : '';
  const latestUpdateTimestamp = streamUpdates.length > 0 ? streamUpdates[0].timestamp : null;

  const cardClasses = isMaximized 
    ? "fixed inset-x-2 sm:inset-x-4 md:inset-x-8 inset-y-2 sm:inset-y-4 z-50 bg-gray-800 rounded-lg shadow-2xl flex flex-col border border-blue-500 overflow-hidden"
    : "bg-gray-800 rounded-lg shadow-lg flex flex-col border border-gray-700 hover:border-blue-600 transition-colors duration-150 h-full min-h-[75vh]";

  const renderGroundingSources = (currentUpdateId: string, groundingMetadata?: GroundingChunk[]) => {
    if (!groundingMetadata || groundingMetadata.length === 0) return null;
    const validSources = groundingMetadata.filter(chunk => 
        (chunk.web && chunk.web.uri && chunk.web.uri !== '#') || 
        (chunk.retrievedContext && chunk.retrievedContext.uri)
    );
    if (validSources.length === 0) return null;

    return (
      <div className="mt-2 pt-1.5 border-t border-gray-700">
        <h5 className="text-xs font-semibold text-gray-400 mb-1">Sources:</h5>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          {validSources.map((chunk, index) => {
             const sourceInfo = chunk.web || chunk.retrievedContext;
             if (!sourceInfo || !sourceInfo.uri || sourceInfo.uri === '#') return null;
             return (
                <li key={`grounding-${currentUpdateId}-${index}`} className="truncate">
                  <a 
                    href={sourceInfo.uri} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300 hover:underline" 
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
    <div ref={cardRef} className={cardClasses}>
      {/* Header Section - Sticky. */}
      <div className={`flex-shrink-0 px-3 md:px-4 pt-3 md:pt-4 pb-2 border-b border-gray-700 sticky top-0 z-20 bg-gray-800`}>
        {/* Top row of header: Stream Name and main controls */}
        <div className="flex justify-between items-start mb-2"> {/* items-start for title wrapping */}
            <div 
                className="font-semibold text-lg text-white overflow-hidden cursor-pointer hover:text-blue-400 flex-grow" 
                onClick={isMaximized ? undefined : onSelectStream}
                title={isMaximized ? stream.name : `Focus: ${stream.focus}\nClick to view full stream in List View`}
                style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 1, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}
            >
            {stream.name}
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0 ml-2"> {/* Added ml-2 */}
              <button
                onClick={(e) => { e.stopPropagation(); onEditStream(); }}
                className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors"
                aria-label="Edit stream settings"
                title="Edit Stream Settings"
              >
                <PencilSquareIcon className="w-4 h-4" />
              </button>
              <div className="relative" ref={exportMenuRef}>
                <button
                    onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
                    disabled={streamUpdates.length === 0}
                    className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-haspopup="true"
                    aria-expanded={showExportMenu}
                    aria-label="Export this stream's updates"
                    title="Export Stream Updates"
                >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                </button>
                {showExportMenu && (
                    <div className={`absolute right-0 mt-1 w-48 bg-gray-700 border border-gray-600 rounded-md shadow-xl z-30 py-1 ${isMaximized ? 'max-h-48 overflow-y-auto' : ''}`}>
                    <button onClick={() => { onExportStream('txt'); setShowExportMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 flex items-center">
                        <DocumentTextIcon className="w-3.5 h-3.5 mr-1.5" /> Export to .txt
                    </button>
                    <button onClick={() => { onExportStream('md'); setShowExportMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 flex items-center">
                        <DocumentTextIcon className="w-3.5 h-3.5 mr-1.5" /> Export to .md
                    </button>
                    <button onClick={() => { onExportStream('csv'); setShowExportMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 flex items-center">
                        <DocumentDuplicateIcon className="w-3.5 h-3.5 mr-1.5" /> Export to .csv
                    </button>
                    </div>
                )}
              </div>
              <button
                  onClick={(e) => { e.stopPropagation(); onRefreshStream(); }}
                  disabled={isLoading}
                  className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Refresh stream"
                  title="Refresh Stream"
              >
                  {isLoading ? <LoadingSpinner className="w-4 h-4" /> : <RefreshIcon className="w-4 h-4" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleMaximize(); }}
                className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors"
                title={isMaximized ? "Minimize Stream" : "Maximize Stream"}
              >
                {isMaximized ? <ArrowsPointingInIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
              </button>
            </div>
        </div>
        
        <div className="flex justify-between items-center text-xs mb-2">
            <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-400 font-medium mr-1">Detail:</span>
                <button 
                    onClick={(e) => {e.stopPropagation(); onUpdateDetailLevel('brief')}}
                    className={detailLevelButtonClass('brief')}
                    aria-pressed={stream.detailLevel === 'brief'}
                    title="Brief"
                >
                    <ClipboardDocumentListIcon className="w-3.5 h-3.5" />
                </button>
                <button 
                    onClick={(e) => {e.stopPropagation(); onUpdateDetailLevel('comprehensive')}}
                    className={detailLevelButtonClass('comprehensive')}
                    aria-pressed={stream.detailLevel === 'comprehensive'}
                    title="Comprehensive"
                >
                    <DocumentTextIcon className="w-3.5 h-3.5" />
                </button>
                <button 
                    onClick={(e) => {e.stopPropagation(); onUpdateDetailLevel('research')}}
                    className={detailLevelButtonClass('research')}
                    aria-pressed={stream.detailLevel === 'research'}
                    title="Research"
                >
                    <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                </button>
            </div>
            <span className={`px-2 py-0.5 rounded-full whitespace-nowrap ${latestUpdateTimestamp ? 'bg-sky-600 text-sky-100' : 'bg-gray-600 text-gray-300'}`}>
                {latestUpdateTimestamp ? formatTimeAgo(latestUpdateTimestamp, 'short') : 'No updates'}
            </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5">
                <span className="text-xs text-gray-400 font-medium">Context:</span>
                <button 
                    onClick={(e) => {e.stopPropagation(); onUpdateContextPreference('none')}}
                    className={contextPreferenceButtonClass('none')}
                    aria-pressed={stream.contextPreference === 'none'}
                    title="Fresh Update (No Context)"
                > <SparklesIcon className="w-3.5 h-3.5" /> </button>
                <button 
                    onClick={(e) => {e.stopPropagation(); onUpdateContextPreference('last')}}
                    className={contextPreferenceButtonClass('last')}
                    disabled={streamUpdates.length === 0}
                    aria-pressed={stream.contextPreference === 'last'}
                    title="Use Last Summary"
                > <BackwardIcon className="w-3.5 h-3.5" /> </button>
                <button 
                    onClick={(e) => {e.stopPropagation(); onUpdateContextPreference('all')}}
                    className={contextPreferenceButtonClass('all')}
                    disabled={streamUpdates.length === 0} 
                    aria-pressed={stream.contextPreference === 'all'}
                    title="Use All Summaries"
                > <ArchiveBoxIcon className="w-3.5 h-3.5" /> </button>
            </div>
            <div className="flex items-center space-x-1.5">
                <span className="bg-pink-700 text-pink-100 px-1.5 py-0.5 rounded-full text-xs flex items-center" title={`Using model: ${displayModelName}`}>
                    {displayModelName}
                    {(stream.reasoningMode === 'request' && currentModelConfig?.supportsThinkingConfig) ? <span role="img" aria-label="brain" title="Reasoning: Requested & Supported" className="ml-1 text-sm">🧠</span> : <span title={`Reasoning: ${stream.reasoningMode === 'request' ? 'Requested (Experimental)' : 'Off'}`} className="ml-1 text-sm opacity-60">🧠</span>}
                </span>
                {totalTokens > 0 && (
                <div className="font-mono bg-gray-950 text-green-400 px-1.5 py-0.5 border border-gray-700 rounded text-xs flex items-center" title="Estimated total tokens">
                    <TagIcon className="w-3 h-3 mr-1 text-green-500" />
                    {totalTokens.toLocaleString()}
                </div>
                )}
            </div>
        </div>
      </div>

      {/* Content Area - Scrollable feed of all updates */}
      <div 
        ref={contentScrollRef}
        className={`flex-grow px-3 md:px-4 pt-3 pb-3 overflow-y-auto rounded-b-lg flex flex-col space-y-0`} 
      >
        {isLoading && streamUpdates.length === 0 && (
          <div className="text-center text-gray-500 py-4 text-sm flex flex-col items-center justify-center h-full">
            <LoadingSpinner className="w-8 h-8 mb-2"/>
            <p>Fetching updates...</p>
          </div>
        )}
        {!isLoading && streamUpdates.length === 0 && (
          <div className="text-center text-gray-500 py-4 text-sm flex items-center justify-center h-full">
            No summary content available. Try refreshing.
          </div>
        )}

        {streamUpdates.slice(0, showFullCardContent ? streamUpdates.length : 1).map((update, index) => {
          const totalUpdateTokens = (update.mainContentTokens || 0) + (update.reasoningTokens || 0);
          return (
          <div key={update.id} className={`py-2 ${tableHidingClass}`}>
            {index > 0 && <hr className="border-gray-700 my-3" />} 
            <div className="text-xs text-gray-400 mb-1.5 flex justify-between items-center"> 
              <span>Updated: {formatTimeAgo(update.timestamp)}</span>
              <div className="space-x-1">
                {update.mainContentTokens !== undefined && <span>Output: ~{update.mainContentTokens}t</span>}
                {update.reasoningTokens !== undefined && update.reasoningTokens > 0 && <span>Reasoning: ~{update.reasoningTokens}t</span>}
              </div>
            </div>
            <MarkdownRenderer markdownContent={update.mainContent} />
            {update.reasoningContent && (
              <div className="mt-2">
                <button 
                  onClick={() => toggleReasoning(update.id)}
                  className="flex items-center text-xs text-purple-400 hover:text-purple-300 py-1 px-1.5 rounded hover:bg-gray-700 transition-colors"
                >
                  <span role="img" aria-label="brain" className="mr-1.5">🧠</span>
                  {showReasoning[update.id] ? "Hide Reasoning" : "Show Reasoning"}
                </button>
                {showReasoning[update.id] && (
                  <div className="mt-1.5 p-2 border border-purple-700 bg-purple-900 bg-opacity-20 rounded-md">
                    <h5 className="text-xs font-semibold text-purple-300 mb-1">Model's Reasoning:</h5>
                    <MarkdownRenderer markdownContent={update.reasoningContent} />
                  </div>
                )}
              </div>
            )}
            {renderGroundingSources(update.id, update.groundingMetadata)}
          </div>
        );
        })}
      </div>
      
      {!isMaximized && streamUpdates.length > 1 && (
        <div className={`flex-shrink-0 px-3 md:px-4 pt-2 pb-2 mt-auto ${showFullCardContent ? 'border-t border-gray-700' : ''}`}>
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleAllSummariesExpansion(); }}
            className="w-full flex items-center justify-center p-1.5 text-xs text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors"
            title={areAllSummariesExpanded ? "Show Less" : "Show More"}
          >
            {areAllSummariesExpanded ? <ChevronUpIcon className="w-4 h-4 mr-1" /> : <ChevronDownIcon className="w-4 h-4 mr-1" />}
            {areAllSummariesExpanded ? "Show Less" : "Show More"}
          </button>
        </div>
      )}
    </div>
  );
};

export default StreamGridCard;