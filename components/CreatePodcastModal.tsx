
// components/CreatePodcastModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Stream } from '../types';
import { XMarkIcon, PlusIcon, ChevronUpDownIcon } from './icons'; // Added ChevronUpDownIcon
import { AVAILABLE_TTS_VOICES, TTS_DEFAULT_VOICE, AvailableTTSVoiceId } from '../constants';

interface CreatePodcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  streams: Stream[];
  onGenerate: (title: string, streamIds: string[], updatesPerStream: number, voiceName: AvailableTTSVoiceId) => void;
}

const CreatePodcastModal: React.FC<CreatePodcastModalProps> = ({ isOpen, onClose, streams, onGenerate }) => {
  const [title, setTitle] = useState('');
  const [selectedStreamIdsSet, setSelectedStreamIdsSet] = useState<Set<string>>(new Set());
  const [updatesPerStream, setUpdatesPerStream] = useState(5);
  const [selectedVoice, setSelectedVoice] = useState<AvailableTTSVoiceId>(TTS_DEFAULT_VOICE as AvailableTTSVoiceId);

  // State for managing the order of all streams displayed in the modal
  const [orderedDisplayStreams, setOrderedDisplayStreams] = useState<Stream[]>([]);

  // Drag-and-drop states
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dropIndicatorPosition, setDropIndicatorPosition] = useState<'before' | 'after' | null>(null);

  const streamMap = useMemo(() => new Map(streams.map(s => [s.id, s])), [streams]);

  useEffect(() => {
    if (isOpen) {
      // Initialize orderedDisplayStreams with the current streams prop when modal opens
      setOrderedDisplayStreams([...streams]);
      // Reset other states
      setTitle('');
      setSelectedStreamIdsSet(new Set());
      setUpdatesPerStream(5);
      setSelectedVoice(TTS_DEFAULT_VOICE as AvailableTTSVoiceId);
      setDraggingItemId(null);
      setDragOverItemId(null);
      setDropIndicatorPosition(null);
    }
  }, [isOpen, streams]);


  if (!isOpen) return null;

  const handleToggleStreamCheckbox = (streamId: string) => {
    const newSelection = new Set(selectedStreamIdsSet);
    if (newSelection.has(streamId)) {
      newSelection.delete(streamId);
    } else {
      newSelection.add(streamId);
    }
    setSelectedStreamIdsSet(newSelection);
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      alert("Please provide a podcast title.");
      return;
    }
    
    // Filter the orderedDisplayStreams to get only selected streams, preserving the display order
    const finalSelectedAndOrderedIds = orderedDisplayStreams
      .filter(stream => selectedStreamIdsSet.has(stream.id))
      .map(stream => stream.id);

    if (finalSelectedAndOrderedIds.length === 0) {
        alert("Please select at least one source stream.");
        return;
    }
    onGenerate(title.trim(), finalSelectedAndOrderedIds, updatesPerStream, selectedVoice);
    // Resetting states is handled by useEffect when isOpen changes or explicitly if needed
  };

  // Drag-and-drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, streamId: string) => {
    e.dataTransfer.setData('application/vnd.gemini-topic-streamer.stream-id', streamId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingItemId(streamId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetStreamId: string) => {
    e.preventDefault();
    if (draggingItemId && draggingItemId !== targetStreamId) {
      setDragOverItemId(targetStreamId);
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      setDropIndicatorPosition(y < rect.height / 2 ? 'before' : 'after');
    }
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only reset if leaving the actual item, not just moving within it
     if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragOverItemId(null);
        setDropIndicatorPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetStreamId: string) => {
    e.preventDefault();
    const draggedStreamId = e.dataTransfer.getData('application/vnd.gemini-topic-streamer.stream-id');

    if (draggedStreamId && draggedStreamId !== targetStreamId && draggingItemId === draggedStreamId) {
      setOrderedDisplayStreams(prevOrderedStreams => {
        const newOrderedStreams = [...prevOrderedStreams];
        const draggedItemIndex = newOrderedStreams.findIndex(s => s.id === draggedStreamId);
        
        if (draggedItemIndex === -1) return prevOrderedStreams; // Should not happen

        const [draggedItem] = newOrderedStreams.splice(draggedItemIndex, 1);
        let targetItemIndex = newOrderedStreams.findIndex(s => s.id === targetStreamId);

        if (dropIndicatorPosition === 'before') {
          newOrderedStreams.splice(targetItemIndex, 0, draggedItem);
        } else {
          newOrderedStreams.splice(targetItemIndex + 1, 0, draggedItem);
        }
        return newOrderedStreams;
      });
    }
    cleanupDragStates();
  };

  const handleDragEnd = () => {
    cleanupDragStates();
  };
  
  const cleanupDragStates = () => {
    setDraggingItemId(null);
    setDragOverItemId(null);
    setDropIndicatorPosition(null);
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog" aria-labelledby="createPodcastModalTitle">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 id="createPodcastModalTitle" className="text-xl font-semibold text-white">Create New Podcast</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close modal">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="podcastTitle" className="block text-sm font-medium text-gray-300">Podcast Title</label>
            <input 
                type="text" 
                id="podcastTitle" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md text-gray-100 p-2 shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                required
            />
          </div>

          <div>
            <label htmlFor="podcastVoice" className="block text-sm font-medium text-gray-300">Podcast Voice</label>
            <select
              id="podcastVoice"
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value as AvailableTTSVoiceId)}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md text-gray-100 p-2 shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {AVAILABLE_TTS_VOICES.map(voice => (
                <option key={voice.id} value={voice.id}>{voice.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="updatesPerStream" className="block text-sm font-medium text-gray-300">Recent Updates per Stream: <span className="font-semibold">{updatesPerStream}</span></label>
            <input 
                type="range" 
                id="updatesPerStream"
                min="1" 
                max="20" 
                value={updatesPerStream} 
                onChange={e => setUpdatesPerStream(Number(e.target.value))} 
                className="mt-1 w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Select & Order Source Streams ({selectedStreamIdsSet.size} selected)</label>
            {streams.length > 0 ? (
              <div 
                className="mt-2 max-h-60 overflow-y-auto border border-gray-700 rounded-md p-2 space-y-1 bg-gray-750"
                onDragLeave={handleDragLeave} // To clear drop indicator if mouse leaves the container
              >
                {orderedDisplayStreams.map(stream => {
                  const isChecked = selectedStreamIdsSet.has(stream.id);
                  const isBeingDragged = draggingItemId === stream.id;
                  let dropIndicatorClass = '';
                  if (dragOverItemId === stream.id) {
                    if (dropIndicatorPosition === 'before') dropIndicatorClass = 'border-t-2 border-blue-500';
                    if (dropIndicatorPosition === 'after') dropIndicatorClass = 'border-b-2 border-blue-500';
                  }

                  return (
                    <div 
                      key={stream.id} 
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, stream.id)}
                      onDragOver={(e) => handleDragOver(e, stream.id)}
                      onDrop={(e) => handleDrop(e, stream.id)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center p-1.5 rounded transition-all duration-150 ease-in-out group relative
                                  ${isBeingDragged ? 'opacity-50 bg-gray-600 cursor-grabbing' : 'hover:bg-gray-600 cursor-grab'}
                                  ${dropIndicatorClass}`}
                      aria-grabbed={isBeingDragged}
                    >
                      <input
                          type="checkbox"
                          id={`stream-checkbox-${stream.id}`}
                          checked={isChecked}
                          onChange={() => handleToggleStreamCheckbox(stream.id)}
                          className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-green-600 focus:ring-green-500 cursor-pointer flex-shrink-0"
                      />
                      <label htmlFor={`stream-checkbox-${stream.id}`} className="ml-2 text-sm text-gray-300 cursor-pointer flex-grow truncate" title={stream.name}>
                          {stream.name}
                      </label>
                      <span title="Drag to reorder" className="flex-shrink-0 ml-1">
                        <ChevronUpDownIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors"/>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
                <p className="text-xs text-gray-500 mt-1">No streams available to select.</p>
            )}
            
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors">Cancel</button>
          <button 
            type="button" 
            onClick={handleSubmit} 
            disabled={!title.trim() || selectedStreamIdsSet.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon className="w-4 h-4 mr-1.5"/> Generate Podcast
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePodcastModal;
