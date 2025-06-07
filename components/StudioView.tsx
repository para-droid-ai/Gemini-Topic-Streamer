// components/StudioView.tsx
import React from 'react';
import { Podcast, Stream } from '../types'; 
import { PlusIcon, TrashIcon, PlayIcon, LoadingSpinner, PauseIcon, StopCircleIcon, ArrowDownTrayIcon as ExportAudioIcon, DocumentTextIcon as TranscriptIcon, ChevronUpIcon, ChevronDownIcon, PhotoIcon, ArrowsPointingOutIcon } from './icons'; // Added PhotoIcon and ArrowsPointingOutIcon
import { formatTimeAgo } from './StreamUpdateCard'; 
import MarkdownRenderer from './MarkdownRenderer'; 
import { TTS_DEFAULT_VOICE, AVAILABLE_TTS_VOICES } from '../constants';

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

interface StudioViewProps {
  streams: Stream[]; 
  podcasts: Podcast[];
  onDeletePodcast: (podcastId: string) => void;
  onGeneratePodcastRequest: () => void;
  onPlayPodcast: (podcast: Podcast) => void;
  onSeekPodcast: (time: number) => void;
  playingPodcastId: string | null;
  isPodcastPlaying: boolean;
  podcastCurrentTime: number;
  podcastDuration: number;
  onExportPodcastAudio: (podcast: Podcast) => void;
  expandedTranscriptPodcastId: string | null;
  onToggleTranscript: (podcastId: string) => void;
  onOpenFullTranscriptView: (podcastId: string) => void; // Added prop
}

const StudioView: React.FC<StudioViewProps> = ({ 
    streams, 
    podcasts, 
    onDeletePodcast, 
    onGeneratePodcastRequest,
    onPlayPodcast,
    onSeekPodcast,
    playingPodcastId,
    isPodcastPlaying,
    podcastCurrentTime,
    podcastDuration,
    onExportPodcastAudio,
    expandedTranscriptPodcastId,
    onToggleTranscript,
    onOpenFullTranscriptView, // Destructure prop
}) => {

  const getVoiceDisplayName = (voiceId?: string): string => {
    if (!voiceId) { 
        const defaultVoiceObj = AVAILABLE_TTS_VOICES.find(v => v.id === TTS_DEFAULT_VOICE);
        return defaultVoiceObj ? defaultVoiceObj.name : TTS_DEFAULT_VOICE;
    }
    const voice = AVAILABLE_TTS_VOICES.find(v => v.id === voiceId);
    return voice ? voice.name : voiceId;
  };

  return (
    <div className="p-4 md:p-6 bg-gray-850 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Podcast Studio</h1>
        <button 
          onClick={onGeneratePodcastRequest}
          className="flex items-center bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition-colors shadow"
          aria-label="Create new podcast"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Create New Podcast
        </button>
      </div>
      
      <div className="space-y-4">
        {podcasts.length === 0 ? (
          <p className="text-center text-gray-500 py-10">No podcasts generated yet. Click "Create New Podcast" to get started!</p>
        ) : (
          podcasts.map(podcast => {
            const isPlayingThis = playingPodcastId === podcast.id;
            const isTranscriptVisible = expandedTranscriptPodcastId === podcast.id;
            return (
                <div key={podcast.id} className="bg-gray-800 rounded-lg shadow-md border border-gray-700 flex flex-col">
                  {podcast.titleCardImageUrl ? (
                    <img 
                        src={podcast.titleCardImageUrl} 
                        alt={`Title card for ${podcast.title}`} 
                        className="w-full h-48 object-cover rounded-t-lg" 
                    />
                  ) : (
                    podcast.status === 'complete' && ( // Only show placeholder if generation was supposed to be complete
                        <div className="w-full h-48 bg-gray-700 rounded-t-lg flex items-center justify-center">
                            <div className="text-center text-gray-500">
                                <PhotoIcon className="w-16 h-16 mx-auto opacity-50" />
                                <p className="text-xs mt-1">Title card image not available.</p>
                            </div>
                        </div>
                    )
                  )}
                  <div className="p-4 flex flex-col flex-grow">
                    <div className="flex items-start justify-between w-full mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg text-white truncate" title={podcast.title}>
                            {podcast.title}
                            {podcast.audioDuration && podcast.audioDuration > 0 && (
                                <span className="text-sm text-gray-400 font-normal ml-2">({formatTime(podcast.audioDuration)})</span>
                            )}
                        </h3>
                        <p className="text-xs text-gray-400">
                          Created: {formatTimeAgo(podcast.createdAt, 'long')}
                        </p>
                        <p className="text-xs text-gray-400">
                          Streams: {podcast.sourceStreamIds.length}
                        </p>
                        {podcast.voiceName && podcast.status === 'complete' && (
                          <p className="text-xs text-gray-400">
                            Voice: {getVoiceDisplayName(podcast.voiceName)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 sm:space-x-2 ml-2 sm:ml-4 flex-shrink-0 flex-wrap gap-y-1 justify-end">
                        {podcast.status === 'processing' && (
                          <div className="flex items-center text-xs text-yellow-400" title="Podcast generation in progress">
                            <LoadingSpinner className="w-4 h-4 mr-1.5" />
                            Processing...
                          </div>
                        )}
                        {podcast.status === 'failed' && (
                          <span className="text-xs text-red-400" title={`Failed: ${podcast.failureReason || 'Unknown error'}`}>Failed</span>
                        )}
                        {podcast.status === 'complete' && (
                          <>
                            {podcast.audioB64Chunks && podcast.audioB64Chunks.length > 0 ? (
                              <>
                                <button
                                    onClick={() => onPlayPodcast(podcast)}
                                    className={`p-1.5 sm:p-2 text-white rounded-full transition-colors ${
                                    isPlayingThis && isPodcastPlaying
                                        ? 'bg-orange-600 hover:bg-orange-700' 
                                        : (isPlayingThis ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700')
                                    }`}
                                    title={isPlayingThis && isPodcastPlaying ? "Pause Podcast" : (isPlayingThis ? "Resume Podcast" : "Play Podcast")}
                                    aria-label={isPlayingThis && isPodcastPlaying ? "Pause Podcast" : (isPlayingThis ? "Resume Podcast" : "Play Podcast")}
                                >
                                    {isPlayingThis && isPodcastPlaying ? <PauseIcon className="w-4 h-4 sm:w-5 sm:h-5" /> : <PlayIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
                                </button>
                                {isPlayingThis && (
                                  <button
                                      onClick={() => onPlayPodcast({ ...podcast, audioB64Chunks: undefined})} // Effectively a stop
                                      className="p-1.5 sm:p-2 text-white bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                                      title="Stop Podcast"
                                      aria-label="Stop Podcast"
                                    >
                                      <StopCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => onExportPodcastAudio(podcast)}
                                  className="p-1.5 sm:p-2 text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
                                  title="Export Podcast Audio (WAV)"
                                  aria-label="Export Podcast Audio (WAV)"
                                >
                                  <ExportAudioIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                              </>
                            ) : (
                                  <span className="text-xs text-gray-500" title="Audio data missing or empty">No Audio</span>
                            )}
                            {podcast.scriptText && (podcast.audioB64Chunks && podcast.audioB64Chunks.length > 0) && (
                              <button
                                  onClick={() => onToggleTranscript(podcast.id)}
                                  className={`p-1.5 sm:p-2 text-white rounded-full transition-colors ${isTranscriptVisible ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-600 hover:bg-gray-500'}`}
                                  title={isTranscriptVisible ? "Hide Inline Transcript" : "Show Inline Transcript"}
                                  aria-label={isTranscriptVisible ? "Hide Inline Transcript" : "Show Inline Transcript"}
                                  aria-expanded={isTranscriptVisible}
                              >
                                  {isTranscriptVisible ? <ChevronUpIcon className="w-4 h-4 sm:w-5 sm:h-5"/> : <TranscriptIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
                              </button>
                            )}
                             {podcast.scriptText && (
                                <button
                                  onClick={() => onOpenFullTranscriptView(podcast.id)}
                                  className="p-1.5 sm:p-2 text-white bg-teal-600 rounded-full hover:bg-teal-700 transition-colors"
                                  title="View Full Transcript"
                                  aria-label="View Full Transcript"
                                >
                                  <ArrowsPointingOutIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                              )}
                          </>
                        )}
                        
                        <button 
                          onClick={() => onDeletePodcast(podcast.id)}
                          className="p-1.5 sm:p-2 text-gray-300 bg-gray-600 rounded-full hover:bg-red-600 hover:text-white transition-colors"
                          aria-label={`Delete podcast ${podcast.title}`}
                          title={`Delete podcast ${podcast.title}`}
                        >
                          <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>

                    {isPlayingThis && podcastDuration > 0 && (
                      <div className="mt-2 w-full">
                        <div
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const percentage = clickX / rect.width;
                            onSeekPodcast(podcastDuration * percentage);
                          }}
                          className="w-full h-2 bg-gray-600 rounded-full cursor-pointer"
                          role="slider"
                          aria-valuemin={0}
                          aria-valuemax={podcastDuration}
                          aria-valuenow={podcastCurrentTime}
                          aria-label="Podcast progress"
                          tabIndex={0}
                          onKeyDown={(e) => {
                              if (e.key === 'ArrowLeft') onSeekPodcast(Math.max(0, podcastCurrentTime - 10));
                              if (e.key === 'ArrowRight') onSeekPodcast(Math.min(podcastDuration, podcastCurrentTime + 10));
                          }}
                        >
                          <div 
                            className="h-full bg-blue-500 rounded-full" 
                            style={{ width: `${(podcastCurrentTime / podcastDuration) * 100 || 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>{formatTime(podcastCurrentTime)}</span>
                          <span>{formatTime(podcastDuration)}</span>
                        </div>
                      </div>
                    )}

                    {isTranscriptVisible && podcast.scriptText && (
                      <div className="mt-4 pt-3 border-t border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Transcript (Inline Preview):</h4>
                        <div className="max-h-[calc(50vh-40px)] min-h-48 overflow-y-auto p-3 bg-gray-900 rounded prose dark:prose-invert prose-p:my-1 prose-headings:my-1.5 markdown-content">
                          <MarkdownRenderer markdownContent={podcast.scriptText} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            )
          })
        )}
      </div>
    </div>
  );
};

export default StudioView;
