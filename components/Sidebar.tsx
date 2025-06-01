
import React, { useState } from 'react';
import { Stream } from '../types';
import { PlusIcon, TrashIcon, PencilSquareIcon } from './icons';

interface SidebarProps {
  streams: Stream[];
  selectedStreamId: string | null;
  onSelectStream: (streamId: string) => void;
  onOpenAddModal: () => void;
  onDeleteStream: (streamId: string) => void;
  onEditStream: (streamId: string) => void;
  onReorderStreams: (draggedId: string, targetId: string, insertBefore: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    streams, 
    selectedStreamId, 
    onSelectStream, 
    onOpenAddModal,
    onDeleteStream, 
    onEditStream, 
    onReorderStreams,
}) => {
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData('application/vnd.gemini-topic-streamer.stream-id', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingItemId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault(); 
    if (id === draggingItemId || !draggingItemId) return;
    
    setDragOverItemId(id);
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDropPosition(y < rect.height / 2 ? 'before' : 'after');
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('application/vnd.gemini-topic-streamer.stream-id');
    if (draggedId && draggedId !== targetId && dragOverItemId === targetId && dropPosition) {
      onReorderStreams(draggedId, targetId, dropPosition === 'before');
    }
    cleanupDragStates();
  };

  const handleDragEnd = () => {
    cleanupDragStates();
  };

  const cleanupDragStates = () => {
    setDraggingItemId(null);
    setDragOverItemId(null);
    setDropPosition(null);
  };

  return (
    <div className="w-full h-full bg-gray-800 p-4 space-y-4 flex flex-col border-r border-gray-700">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white flex-grow text-center">Topic Streams</h2>
        <button
          onClick={onOpenAddModal}
          className="p-2 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          aria-label="Add new stream"
        >
          <PlusIcon className="w-6 h-6" />
        </button>
      </div>

      <div 
        className="flex-grow overflow-y-auto space-y-2 pr-1"
      >
        {streams.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No streams yet. Click '+' to add one!</p>
        ) : null}
        {streams.map((stream) => (
          <div
            key={stream.id}
            draggable="true"
            onDragStart={(e) => handleDragStart(e, stream.id)}
            onDragOver={(e) => handleDragOver(e, stream.id)}
            onDrop={(e) => handleDrop(e, stream.id)}
            onDragEnter={(e) => handleDragEnter(e, stream.id)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelectStream(stream.id)}
            className={`
              p-3 rounded-lg cursor-pointer transition-all duration-150 ease-in-out group relative
              ${selectedStreamId === stream.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'}
              ${draggingItemId === stream.id ? 'opacity-50 cursor-grabbing !bg-gray-500' : 'cursor-grab'}
              ${dragOverItemId === stream.id && dropPosition === 'before' ? 'border-t-2 border-blue-500' : ''}
              ${dragOverItemId === stream.id && dropPosition === 'after' ? 'border-b-2 border-blue-500' : ''}
            `}
            aria-grabbed={draggingItemId === stream.id}
            aria-dropeffect={dragOverItemId === stream.id ? 'move' : 'none'}
          >
            <div className="flex justify-between items-center">
              <span className="font-medium truncate block flex-grow" title={stream.name}>{stream.name}</span>
              <div className="flex-shrink-0 space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditStream(stream.id);
                  }}
                  className={`p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ${selectedStreamId === stream.id ? 'text-blue-200 hover:text-white hover:bg-blue-700' : 'text-gray-400 hover:text-green-400 hover:bg-gray-500'}`}
                  aria-label={`Edit stream ${stream.name}`}
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); 
                    // Removed window.confirm for immediate deletion
                    onDeleteStream(stream.id);
                  }}
                  className={`p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ${selectedStreamId === stream.id ? 'text-blue-200 hover:text-white hover:bg-blue-700' : 'text-gray-400 hover:text-red-400 hover:bg-gray-500'}`}
                  aria-label={`Delete stream ${stream.name}`}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
             <p className={`text-xs truncate mt-1 ${selectedStreamId === stream.id ? 'text-blue-100' : 'text-gray-400'}`} title={stream.focus}>
              {stream.focus}
            </p>
             <div className="mt-1.5 flex flex-wrap gap-1 text-xs">
                {/* Frequency badge removed */}
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${selectedStreamId === stream.id ? 'bg-blue-400 text-blue-50' : 'bg-gray-600 text-gray-300'}`}>
                    {stream.detailLevel}
                </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
