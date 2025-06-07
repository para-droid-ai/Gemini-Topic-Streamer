
// components/CreatePodcastModal.tsx
import React, { useState } from 'react';
import { Stream } from '../types';
import { XMarkIcon, PlusIcon } from './icons';
import { AVAILABLE_TTS_VOICES, TTS_DEFAULT_VOICE, AvailableTTSVoiceId } from '../constants';

interface CreatePodcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  streams: Stream[];
  onGenerate: (title: string, streamIds: string[], updatesPerStream: number, voiceName: AvailableTTSVoiceId) => void;
}

const CreatePodcastModal: React.FC<CreatePodcastModalProps> = ({ isOpen, onClose, streams, onGenerate }) => {
  const [title, setTitle] = useState('');
  const [selectedStreamIds, setSelectedStreamIds] = useState<Set<string>>(new Set());
  const [updatesPerStream, setUpdatesPerStream] = useState(5); // Default to 5 updates
  const [selectedVoice, setSelectedVoice] = useState<AvailableTTSVoiceId>(TTS_DEFAULT_VOICE as AvailableTTSVoiceId);

  if (!isOpen) return null;

  const handleToggleStream = (streamId: string) => {
    const newSelection = new Set(selectedStreamIds);
    if (newSelection.has(streamId)) {
      newSelection.delete(streamId);
    } else {
      newSelection.add(streamId);
    }
    setSelectedStreamIds(newSelection);
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      alert("Please provide a podcast title.");
      return;
    }
    if (selectedStreamIds.size === 0) {
        alert("Please select at least one source stream.");
        return;
    }
    onGenerate(title.trim(), Array.from(selectedStreamIds), updatesPerStream, selectedVoice);
    setTitle('');
    setSelectedStreamIds(new Set());
    setUpdatesPerStream(5);
    setSelectedVoice(TTS_DEFAULT_VOICE as AvailableTTSVoiceId);
    // onClose(); // Typically handled by the parent calling onGenerate
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
                max="20" // Max 20 updates per stream for a podcast
                value={updatesPerStream} 
                onChange={e => setUpdatesPerStream(Number(e.target.value))} 
                className="mt-1 w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Select Source Streams ({selectedStreamIds.size} selected)</label>
            {streams.length > 0 ? (
                <div className="mt-2 max-h-48 overflow-y-auto border border-gray-700 rounded-md p-2 space-y-1 bg-gray-750">
                {streams.map(stream => (
                    <div key={stream.id} className="flex items-center p-1.5 hover:bg-gray-600 rounded">
                    <input
                        type="checkbox"
                        id={`stream-checkbox-${stream.id}`}
                        checked={selectedStreamIds.has(stream.id)}
                        onChange={() => handleToggleStream(stream.id)}
                        className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-green-600 focus:ring-green-500 cursor-pointer"
                    />
                    <label htmlFor={`stream-checkbox-${stream.id}`} className="ml-2 text-sm text-gray-300 cursor-pointer flex-grow truncate" title={stream.name}>
                        {stream.name}
                    </label>
                    </div>
                ))}
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
            disabled={!title.trim() || selectedStreamIds.size === 0}
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
