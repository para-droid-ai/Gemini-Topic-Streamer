// components/StreamUpdateCard.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StreamUpdate, GroundingChunk } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { 
    ChatBubbleOvalLeftEllipsisIcon, ClipboardDocumentIcon, DocumentTextIcon, ArrowDownTrayIcon, 
    ChevronDownIcon, LoadingSpinner, TrashIcon, DocumentDuplicateIcon, SpeakerWaveIcon, StopCircleIcon,
    PlayIcon, PauseIcon, ForwardIcon, BackwardIcon, MusicalNoteIcon
} from './icons';
import { convertToCSV, downloadFile } from '../utils/exportUtils';
import { stripMarkdown } from '../utils/textUtils';
import { generateSpeechFromText } from '../services/geminiService';
import { loadAudioForPlayback, getPlaybackControls, AudioPlaybackControls, stopGlobalAudio, base64ToFloat32Array } from '../utils/audioUtils';
import { TTS_SAMPLE_RATE, TTS_DEFAULT_VOICE } from '../constants';
import { saveTtsAudio, getTtsAudio } from '../services/dbService'; // <-- ADDED IMPORT

interface StreamUpdateCardProps {
  id: string; 
  update: StreamUpdate;
  streamName: string;
  apiKeyAvailable: boolean;
  onStartDeepDive: (content: string, timestamp: string) => void;
  onDeleteUpdate: (updateId: string) => void;
  isNewest?: boolean; 
}

export const formatTimeAgo = (isoTimestamp?: string, formatType: 'short' | 'long' = 'long'): string => {
  if (!isoTimestamp) return 'N/A';
  const date = new Date(isoTimestamp);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const weeks = Math.round(days / 7);

  if (formatType === 'short') {
    if (seconds < 5) return 'now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 365) { 
        if (weeks <= 52) return `${weeks}w ago`;
        return date.toLocaleString('default', { month: 'short', year: 'numeric' });
    }
    return date.toLocaleString('default', { year: 'numeric' });
  } else { 
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds} seconds ago`;
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    return date.toLocaleString([], { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
};

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const StreamUpdateCard: React.FC<StreamUpdateCardProps> = ({ id, update, streamName, apiKeyAvailable, onStartDeepDive, onDeleteUpdate, isNewest }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  
  const [isFetchingAudio, setIsFetchingAudio] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [ttsProgress, setTtsProgress] = useState<{ loaded: number, total: number } | null>(null);
  
  const playbackControlsRef = useRef<AudioPlaybackControls | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const resetTtsState = useCallback(() => {
    if (playbackControlsRef.current) {
        playbackControlsRef.current.stop();
        playbackControlsRef.current.cleanup();
        playbackControlsRef.current = null;
    }
    audioBufferRef.current = null;
    setIsFetchingAudio(false);
    setAudioLoaded(false);
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
    setDuration(0);
    setTtsProgress(null);
  }, []);

  useEffect(() => {
    return () => {
      resetTtsState();
    };
  }, [update.id, resetTtsState]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(update.mainContent).then(() => alert('Update content copied to clipboard!')).catch(err => alert('Failed to copy: ' + err));
    setShowExportMenu(false);
  };

  const handleExportToFile = (format: 'txt' | 'md' | 'csv') => {
    const dateForFilename = new Date(update.timestamp).toISOString().substring(0, 19).replace(/:/g,'-').replace('T','_');
    const filenameBase = `${streamName.replace(/\s+/g, '_')}_update_${dateForFilename}`;

    if (format === 'csv') {
      const headers = ['update_id', 'timestamp', 'stream_name', 'main_content', 'reasoning_content', 'main_content_tokens', 'reasoning_tokens', 'grounding_source_urls'];
      const groundingUrls = (update.groundingMetadata || [])
        .map(chunk => chunk.web?.uri || chunk.retrievedContext?.uri)
        .filter(Boolean)
        .join(', ');
      const data = [{
        update_id: update.id,
        timestamp: update.timestamp,
        stream_name: streamName,
        main_content: update.mainContent,
        reasoning_content: update.reasoningContent || '',
        main_content_tokens: update.mainContentTokens || 0,
        reasoning_tokens: update.reasoningTokens || 0,
        grounding_source_urls: groundingUrls,
      }];
      const csvString = convertToCSV(data, headers);
      downloadFile(csvString, `${filenameBase}.csv`, 'text/csv;charset=utf-8;');
    } else {
      let exportContent = update.mainContent;
      if (format === 'md' && update.reasoningContent) {
        exportContent += `\n\n### Model's Reasoning:\n${update.reasoningContent}`;
      }
      downloadFile(exportContent, `${filenameBase}.${format}`, format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8');
    }
    setShowExportMenu(false);
  };
  
  const handleExportAudio = () => {
    if (!audioLoaded || !playbackControlsRef.current) {
      alert("Audio is not loaded yet. Please generate audio first.");
      setShowExportMenu(false);
      return;
    }
    const dateForFilename = new Date(update.timestamp).toISOString().substring(0, 19).replace(/:/g,'-').replace('T','_');
    const filename = `${streamName.replace(/\s+/g, '_')}_update_${dateForFilename}_audio.wav`;
    playbackControlsRef.current.exportWav(filename);
    setShowExportMenu(false);
  };

  const handleDelete = () => {
    onDeleteUpdate(update.id);
  };
  
  const handleFetchAndPlayAudio = async () => {
    if (!apiKeyAvailable) {
      alert('API Key is not configured. Text-to-speech is unavailable.');
      return;
    }
    if (isFetchingAudio || audioLoaded) return; // Don't fetch if already fetching or audio is loaded and ready

    stopGlobalAudio(); // Stop any other audio playing globally
    resetTtsState();   // Reset this card's specific TTS state
    setIsFetchingAudio(true); // Set fetching state for this card

    try {
      // 1. CHECK CACHE FIRST
      const cachedAudioB64 = await getTtsAudio(update.id);
      let finalAudioB64: string;

      if (cachedAudioB64) {
        // CACHE HIT: Use the cached audio
        console.log(`TTS Cache HIT for update: ${update.id}`);
        finalAudioB64 = cachedAudioB64;
        setTtsProgress(null); // No progress for cached audio
      } else {
        // CACHE MISS: Generate audio via API
        console.log(`TTS Cache MISS for update: ${update.id}. Fetching from API.`);
        const textToSpeak = stripMarkdown(update.mainContent);
        if (!textToSpeak.trim()) {
          alert("Nothing to read for this summary.");
          setIsFetchingAudio(false);
          return;
        }

        const base64Chunks = await generateSpeechFromText(
          textToSpeak,
          TTS_DEFAULT_VOICE,
          (progress) => setTtsProgress(progress) // Update progress state
        );
        
        // The API returns chunks as an array. Join them for a single base64 string for caching and playback.
        finalAudioB64 = base64Chunks.join('');

        // WARM THE CACHE: Save the newly generated audio (single string) to DB
        if (finalAudioB64) { // Ensure there's data to save
          await saveTtsAudio(update.id, finalAudioB64);
        } else {
           console.warn("Generated audio data was empty, not caching.");
        }
      }

      if (!finalAudioB64) {
        alert("Audio data could not be retrieved or generated.");
        resetTtsState();
        return;
      }

      // --- The rest of the playback logic remains the same ---
      // Decode the single base64 string (from cache or API) into raw audio data
      const pcmData = base64ToFloat32Array(finalAudioB64);
      
      const loadedBuffer = await loadAudioForPlayback(
        pcmData, // Pass the stitched raw data
        TTS_SAMPLE_RATE,
        (err) => {
          console.error('TTS Load Error:', err);
          alert(`Error loading audio: ${err.message || 'Unknown error'}`);
          resetTtsState();
        }
      );

      if (!loadedBuffer) {
        setIsFetchingAudio(false); // Ensure fetching is false if buffer loading fails
        return;
      }
      
      audioBufferRef.current = loadedBuffer;
      setDuration(loadedBuffer.duration);
      setAudioLoaded(true);
      setIsFetchingAudio(false); // Done fetching
      setTtsProgress(null); // Clear progress indicator
      
      playbackControlsRef.current = getPlaybackControls(
        loadedBuffer,
        () => { // onEnd
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentTime(loadedBuffer.duration);
        },
        (err) => { // onError
          console.error('TTS Playback Error:', err);
          alert(`Error during audio playback: ${err.message || 'Unknown error'}`);
          resetTtsState();
        },
        (newTime) => { // onTimeUpdate
          setCurrentTime(newTime);
        }
      );
      
      playbackControlsRef.current.setPlaybackRate(playbackRate);
      playbackControlsRef.current.play();
      setIsPlaying(true);
      setIsPaused(false);

    } catch (fetchError: any) {
      console.error('TTS Fetch/Cache Error:', fetchError);
      alert(`Error processing audio: ${fetchError.message || 'Unknown error'}`);
      resetTtsState(); // Ensure state is reset on any error during the process
    }
  };

  const handlePlayPauseToggle = async () => {
    if (!playbackControlsRef.current || !audioLoaded) return;
    if (isPlaying) {
      playbackControlsRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    } else {
      playbackControlsRef.current.play();
      setIsPlaying(true);
      setIsPaused(false);
    }
  };

  const handleStopTTS = () => resetTtsState();

  const handleSeek = (seekTime: number) => {
    if (playbackControlsRef.current && audioLoaded) {
      const newTime = Math.max(0, Math.min(seekTime, duration));
      playbackControlsRef.current.seek(newTime);
      setCurrentTime(newTime); 
       if (isPaused && !isPlaying) {
            playbackControlsRef.current.pause();
       }
    }
  };

  const handleProgressBarClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    handleSeek(duration * percentage);
  };

  const handlePlaybackRateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newRate = parseFloat(event.target.value);
    setPlaybackRate(newRate);
    if (playbackControlsRef.current && audioLoaded) {
      playbackControlsRef.current.setPlaybackRate(newRate);
    }
  };
  
  const renderGroundingMetadata = () => {
    if (!update.groundingMetadata || update.groundingMetadata.length === 0) return null;
    const validSources = update.groundingMetadata.filter(chunk => 
        (chunk.web && chunk.web.uri && chunk.web.uri !== '#') || 
        (chunk.retrievedContext && chunk.retrievedContext.uri)
    );
    if (validSources.length === 0) return null;

    return (
      <div className="mt-3 pt-3 border-t border-gray-700">
        <h4 className="text-sm font-semibold text-gray-300 mb-1.5">Sources:</h4>
        <ul className="list-disc list-inside space-y-1">
          {validSources.map((chunk, index) => {
             const sourceInfo = chunk.web || chunk.retrievedContext;
             if (!sourceInfo || !sourceInfo.uri || sourceInfo.uri === '#') return null;
             return (
                <li key={`${update.id}-grounding-${index}`} className="text-xs">
                  <a 
                    href={sourceInfo.uri} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300 hover:underline truncate block" 
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
  
  let mainTtsButtonIcon;
  let mainTtsButtonText;
  let mainTtsButtonTitle;
  let mainTtsButtonAction: () => Promise<void> | void = handleFetchAndPlayAudio;
  let mainTtsButtonClasses = "flex items-center text-xs font-medium py-1 px-2 rounded-md transition-colors";

  if (isFetchingAudio) {
    mainTtsButtonIcon = <LoadingSpinner className="w-3.5 h-3.5 mr-1" />;
    if (ttsProgress && ttsProgress.total > 1) {
      mainTtsButtonText = `Loading ${ttsProgress.loaded}/${ttsProgress.total}`;
    } else {
      mainTtsButtonText = "Loading...";
    }
    mainTtsButtonTitle = "Fetching audio...";
    mainTtsButtonClasses += " bg-yellow-600 text-white cursor-wait";
    mainTtsButtonAction = async () => {};
  } else if (audioLoaded) {
    if (isPlaying) {
      mainTtsButtonIcon = <PauseIcon className="w-3.5 h-3.5 mr-1" />;
      mainTtsButtonText = "Pause";
      mainTtsButtonTitle = "Pause Reading";
      mainTtsButtonClasses += " bg-orange-600 hover:bg-orange-700 text-white";
    } else {
      mainTtsButtonIcon = <PlayIcon className="w-3.5 h-3.5 mr-1" />;
      mainTtsButtonText = "Play";
      mainTtsButtonTitle = "Play Reading";
      mainTtsButtonClasses += " bg-green-600 hover:bg-green-700 text-white";
    }
    mainTtsButtonAction = handlePlayPauseToggle;
  } else {
    mainTtsButtonIcon = <SpeakerWaveIcon className="w-3.5 h-3.5 mr-1" />;
    mainTtsButtonText = "Read";
    mainTtsButtonTitle = "Read Aloud";
    mainTtsButtonClasses += " bg-teal-600 hover:bg-teal-700 text-white";
  }

  return (
    <div id={id} className={`bg-gray-800 p-4 md:p-5 rounded-lg shadow-lg border ${isNewest ? 'border-blue-500 animate-pulse-border-once' : 'border-gray-700'}`}>
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs text-gray-400">
          Updated: {formatTimeAgo(update.timestamp)} 
          {(isNewest && !isFetchingAudio && !audioLoaded) && <LoadingSpinner className="w-3 h-3 inline-block ml-2 text-blue-400" />}
        </div>
        <div className="flex items-center space-x-2">
          {apiKeyAvailable && (
            <button
              onClick={mainTtsButtonAction}
              className={mainTtsButtonClasses}
              aria-label={mainTtsButtonTitle}
              title={mainTtsButtonTitle}
              disabled={isFetchingAudio && !audioLoaded && !ttsProgress} // Disable only if truly busy and not just showing progress for API fetch
            >
              {mainTtsButtonIcon}
              {mainTtsButtonText}
            </button>
          )}
          {audioLoaded && apiKeyAvailable && (
             <button
                onClick={handleStopTTS}
                className="flex items-center text-xs bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-2 rounded-md transition-colors"
                title="Stop TTS & Reset"
                aria-label="Stop TTS & Reset"
            >
                <StopCircleIcon className="w-3.5 h-3.5 mr-1" /> Stop
            </button>
          )}
          {apiKeyAvailable && (
            <button
              onClick={() => onStartDeepDive(update.mainContent, update.timestamp)}
              className="flex items-center text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-1 px-2 rounded-md transition-colors"
              aria-label="Deep dive chat on this update"
            >
              <ChatBubbleOvalLeftEllipsisIcon className="w-3.5 h-3.5 mr-1" />
              Deep Dive
            </button>
          )}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 font-medium py-1 px-2 rounded-md transition-colors"
              aria-haspopup="true"
              aria-expanded={showExportMenu}
              aria-label="Export this update"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5 mr-1" />
              Export
              <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-48 bg-gray-700 border border-gray-600 rounded-md shadow-xl z-10 py-1">
                <button onClick={handleCopyToClipboard} className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 flex items-center"><ClipboardDocumentIcon className="w-3.5 h-3.5 mr-1.5" /> Copy Content</button>
                <button onClick={() => handleExportToFile('txt')} className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 flex items-center"><DocumentTextIcon className="w-3.5 h-3.5 mr-1.5" /> Export to .txt</button>
                <button onClick={() => handleExportToFile('md')} className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 flex items-center"><DocumentTextIcon className="w-3.5 h-3.5 mr-1.5" /> Export to .md</button>
                <button onClick={() => handleExportToFile('csv')} className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 flex items-center"><DocumentDuplicateIcon className="w-3.5 h-3.5 mr-1.5" /> Export to .csv</button>
                {apiKeyAvailable && (
                  <button 
                    onClick={handleExportAudio} 
                    disabled={!audioLoaded}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-600 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MusicalNoteIcon className="w-3.5 h-3.5 mr-1.5" /> Export Audio (.wav)
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleDelete}
            className="flex items-center text-xs bg-red-700 hover:bg-red-800 text-white font-medium py-1 px-2 rounded-md transition-colors"
            aria-label="Delete this summary"
            title="Delete this summary"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {audioLoaded && apiKeyAvailable && (
        <div className="my-3 p-2 bg-gray-750 rounded-md border border-gray-700">
          <div 
            ref={progressBarRef}
            onClick={handleProgressBarClick}
            className="w-full h-2.5 bg-gray-600 rounded-full cursor-pointer mb-1.5"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            aria-label="Audio progress"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') handleSeek(Math.max(0, currentTime - 10));
              if (e.key === 'ArrowRight') handleSeek(Math.min(duration, currentTime + 10));
            }}
          >
            <div 
              className="h-full bg-blue-500 rounded-full" 
              style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="flex items-center justify-center space-x-3">
            <button 
                onClick={() => handleSeek(Math.max(0, currentTime - 10))} 
                className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-600 rounded-full"
                title="Rewind 10s" aria-label="Rewind 10 seconds"
            >
              <BackwardIcon className="w-4 h-4" />
            </button>
            <button 
                onClick={() => handleSeek(Math.min(duration, currentTime + 10))}
                className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-600 rounded-full"
                title="Fast-Forward 10s" aria-label="Fast-Forward 10 seconds"
            >
              <ForwardIcon className="w-4 h-4" />
            </button>
            <select 
              value={playbackRate} 
              onChange={handlePlaybackRateChange}
              className="bg-gray-600 text-gray-200 text-xs rounded p-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Playback speed" aria-label="Playback speed"
            >
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(rate => (
                <option key={rate} value={rate}>{rate}x</option>
              ))}
            </select>
          </div>
        </div>
      )}
      
      {update.reasoningContent && (
        <div className="mb-3">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center text-xs text-purple-400 hover:text-purple-300 py-1 px-1.5 rounded hover:bg-gray-700 transition-colors"
          >
            <span role="img" aria-label="brain" className="mr-1.5">🧠</span>
            {showReasoning ? "Hide Model Reasoning" : "Show Model Reasoning"}
          </button>
          {showReasoning && (
            <div className="mt-1.5 p-2 border border-purple-700 bg-purple-900 bg-opacity-20 rounded-md">
              <h5 className="text-xs font-semibold text-purple-300 mb-1">Model's Reasoning:</h5>
              <MarkdownRenderer markdownContent={update.reasoningContent} />
            </div>
          )}
        </div>
      )}
      
      <MarkdownRenderer markdownContent={update.mainContent} />
      
      {(update.mainContentTokens !== undefined || (update.reasoningTokens !== undefined && update.reasoningTokens > 0)) && (
        <div className="mt-3 pt-2 border-t border-gray-700 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
          {update.mainContentTokens !== undefined && (
            <span>Output Tokens: <span className="font-semibold text-gray-400">{update.mainContentTokens.toLocaleString()}</span></span>
          )}
          {update.reasoningTokens !== undefined && update.reasoningTokens > 0 && (
            <span>Reasoning Tokens: <span className="font-semibold text-gray-400">{update.reasoningTokens.toLocaleString()}</span></span>
          )}
        </div>
      )}

      {renderGroundingMetadata()}

       <style>{`
        @keyframes pulse-border {
          0% { border-color: #3b82f6; /* blue-500 */ }
          50% { border-color: #60a5fa; /* blue-400 */ }
          100% { border-color: #3b82f6; /* blue-500 */ }
        }
        .animate-pulse-border-once {
          animation: pulse-border 1.5s ease-in-out;
        }
        .progress-bar-container {
            width: 100%;
            background-color: #4a5568; /* bg-gray-700 */
            border-radius: 9999px; /* rounded-full */
            cursor: pointer;
            height: 0.625rem; /* h-2.5 */
        }
        .progress-bar-fill {
            height: 100%;
            background-color: #3b82f6; /* bg-blue-500 */
            border-radius: 9999px; /* rounded-full */
            transition: width 0.1s linear; 
        }
      `}</style>
    </div>
  );
};

export default StreamUpdateCard;
