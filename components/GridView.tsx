

import React, { useState, useEffect, useRef, useCallback } from 'react';
// Fix: Add StreamDetailLevel to import
import { Stream, StreamUpdate, StreamContextPreference, StreamDetailLevel } from '../types';
import StreamGridCard from './StreamGridCard';
import { ChevronLeftIcon, ChevronRightIcon, ArrowSmallUpIcon } from './icons'; // Added ArrowSmallUpIcon

interface GridViewProps {
  streams: Stream[];
  streamUpdates: { [key: string]: StreamUpdate[] };
  loadingStates: { [key: string]: boolean };
  onSelectStreamAndSwitchView: (streamId: string) => void;
  onEditStream: (streamId: string) => void;
  onExportStreamData: (stream: Stream, format: 'txt' | 'md' | 'csv') => void;
  onRefreshStream: (stream: Stream) => void;
  onUpdateContextPreference: (streamId: string, preference: StreamContextPreference) => void;
  // Fix: Add onUpdateDetailLevel to GridViewProps
  onUpdateDetailLevel: (streamId: string, detailLevel: StreamDetailLevel) => void;
}

const GridView: React.FC<GridViewProps> = ({ 
    streams, 
    streamUpdates, 
    loadingStates,
    onSelectStreamAndSwitchView,
    onEditStream, 
    onExportStreamData,
    onRefreshStream,
    onUpdateContextPreference,
    // Fix: Destructure onUpdateDetailLevel
    onUpdateDetailLevel 
}) => {
  const [currentStartIndex, setCurrentStartIndex] = useState(0);
  const [visibleStreamCount, setVisibleStreamCount] = useState(4);
  const [maximizedStreamId, setMaximizedStreamId] = useState<string | null>(null);
  const [areAllSummariesExpanded, setAreAllSummariesExpanded] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [showPageScrollToTop, setShowPageScrollToTop] = useState(false);

  const calculateVisibleStreams = useCallback(() => {
    if (window.innerWidth < 640) return 1; // sm
    if (window.innerWidth < 768) return 2; // md
    if (window.innerWidth < 1024) return 3; // lg
    if (window.innerWidth < 1280) return 4; // xl
    return 5; // 2xl and up
  }, []);

  useEffect(() => {
    const updateVisibleCount = () => {
      setVisibleStreamCount(calculateVisibleStreams());
    };
    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, [calculateVisibleStreams]);

  useEffect(() => {
    if (currentStartIndex > 0 && currentStartIndex >= streams.length - visibleStreamCount + 1) {
      setCurrentStartIndex(Math.max(0, streams.length - visibleStreamCount));
    }
     if (streams.length <= visibleStreamCount) {
      setCurrentStartIndex(0);
    }
  }, [streams.length, visibleStreamCount, currentStartIndex]);

  useEffect(() => {
    const mainArea = gridContainerRef.current;
    const handleScroll = () => {
      if (mainArea) {
        setShowPageScrollToTop(mainArea.scrollTop > 300); 
      }
    };

    if (mainArea) {
      mainArea.addEventListener('scroll', handleScroll);
      handleScroll(); 
    }
    return () => mainArea?.removeEventListener('scroll', handleScroll);
  }, []);


  const handleNextStreams = () => {
    setCurrentStartIndex(prev => Math.min(prev + 1, streams.length - visibleStreamCount));
  };

  const handlePrevStreams = () => {
    setCurrentStartIndex(prev => Math.max(0, prev - 1));
  };

  const handleToggleMaximize = (streamId: string | null) => {
    setMaximizedStreamId(streamId);
    if (streamId) { 
        setAreAllSummariesExpanded(false); 
    }
  };

  const handleToggleAllSummariesExpansion = () => {
    setAreAllSummariesExpanded(prev => !prev);
  };

  const handlePageScrollToTop = () => {
    gridContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (streams.length === 0) {
    return (
      <div className="flex-grow p-6 flex items-center justify-center text-gray-500 bg-gray-850">
        <p className="text-xl">No streams yet. Add a new stream from the sidebar.</p>
      </div>
    );
  }

  const visibleStreams = streams.slice(currentStartIndex, currentStartIndex + visibleStreamCount);
  const showPrevButton = currentStartIndex > 0 && streams.length > visibleStreamCount;
  const showNextButton = currentStartIndex < streams.length - visibleStreamCount && streams.length > visibleStreamCount;

  const maximizedStream = streams.find(s => s.id === maximizedStreamId);

  if (maximizedStream) {
    const updatesForMaximizedStream = streamUpdates[maximizedStream.id] || [];
    // totalTokensForMaximized is calculated inside StreamGridCard now from streamUpdates
    const isLoadingMaximizedStream = loadingStates[maximizedStream.id] || false;

    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-90 z-40 p-4 md:p-8 overflow-y-auto flex items-center justify-center">
        <StreamGridCard
          key={maximizedStream.id}
          stream={maximizedStream}
          streamUpdates={updatesForMaximizedStream}
          // totalTokens prop removed, card calculates it
          isLoading={isLoadingMaximizedStream}
          onSelectStream={() => {
            onSelectStreamAndSwitchView(maximizedStream.id);
            handleToggleMaximize(null); 
          }}
          onEditStream={() => onEditStream(maximizedStream.id)}
          onExportStream={(format) => onExportStreamData(maximizedStream, format)}
          onRefreshStream={() => onRefreshStream(maximizedStream)}
          onUpdateContextPreference={(preference) => onUpdateContextPreference(maximizedStream.id, preference)}
          // Fix: Pass onUpdateDetailLevel to StreamGridCard for maximized view
          onUpdateDetailLevel={(detailLevel) => onUpdateDetailLevel(maximizedStream.id, detailLevel)}
          isMaximized={true}
          onToggleMaximize={() => handleToggleMaximize(null)}
          areAllSummariesExpanded={true} // Always expanded when card is maximized
          onToggleAllSummariesExpansion={() => {}} // No global toggle effect needed when card is maximized
        />
      </div>
    );
  }


  return (
    <div 
      ref={gridContainerRef} 
      className="flex-grow px-4 md:px-6 pb-4 md:pb-6 bg-gray-850 overflow-y-auto h-full relative" /* pt-0 ensures flush with app header */
    >
      {streams.length > visibleStreamCount && (
        <>
          {showPrevButton && (
            <button 
              onClick={handlePrevStreams}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full shadow-lg ml-1 md:ml-2"
              aria-label="Previous streams"
            >
              <ChevronLeftIcon className="w-6 h-6" />
            </button>
          )}
          {showNextButton && (
            <button 
              onClick={handleNextStreams}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full shadow-lg mr-1 md:mr-2"
              aria-label="Next streams"
            >
              <ChevronRightIcon className="w-6 h-6" />
            </button>
          )}
        </>
      )}
      <div 
        className={`grid grid-cols-1 gap-4 md:gap-6 transition-transform duration-300 ease-in-out`}
        style={{
            gridTemplateColumns: `repeat(${visibleStreamCount}, minmax(0, 1fr))`,
        }}
      >
        {visibleStreams.map(stream => {
          const updatesForThisStream = streamUpdates[stream.id] || [];
          // totalTokens prop removed, card calculates it
          const isLoadingThisStream = loadingStates[stream.id] || false;

          return (
            <StreamGridCard
              key={stream.id}
              stream={stream}
              streamUpdates={updatesForThisStream}
              isLoading={isLoadingThisStream}
              onSelectStream={() => onSelectStreamAndSwitchView(stream.id)}
              onEditStream={() => onEditStream(stream.id)}
              onExportStream={(format) => onExportStreamData(stream, format)}
              onRefreshStream={() => onRefreshStream(stream)}
              onUpdateContextPreference={(preference) => onUpdateContextPreference(stream.id, preference)}
              // Fix: Pass onUpdateDetailLevel to StreamGridCard for grid view
              onUpdateDetailLevel={(detailLevel) => onUpdateDetailLevel(stream.id, detailLevel)}
              isMaximized={false}
              onToggleMaximize={() => handleToggleMaximize(stream.id)}
              areAllSummariesExpanded={areAllSummariesExpanded}
              onToggleAllSummariesExpansion={handleToggleAllSummariesExpansion}
            />
          );
        })}
      </div>
      {showPageScrollToTop && (
        <button
          onClick={handlePageScrollToTop}
          className="fixed bottom-10 right-10 z-30 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-opacity duration-300"
          aria-label="Scroll to top of page"
          title="Scroll to Top"
        >
          <ArrowSmallUpIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default GridView;