// components/FullTranscriptView.tsx
import React from 'react';
import { Podcast } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { XMarkIcon } from './icons';

interface FullTranscriptViewProps {
  podcast: Podcast | null;
  onClose: () => void;
}

const FullTranscriptView: React.FC<FullTranscriptViewProps> = ({ podcast, onClose }) => {
  if (!podcast || !podcast.scriptText) return null;

  return (
    <div 
        className="fixed inset-0 bg-gray-900 bg-opacity-95 z-[60] flex flex-col p-4 sm:p-6 md:p-8" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="fullTranscriptTitle"
    >
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 id="fullTranscriptTitle" className="text-xl sm:text-2xl font-semibold text-white truncate max-w-[calc(100%-3rem)]" title={podcast.title}>
          Transcript: {podcast.title}
        </h2>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors flex-shrink-0"
          aria-label="Close full transcript view"
        >
          <XMarkIcon className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      </div>
      <div className="flex-grow overflow-y-auto bg-gray-800 p-4 sm:p-6 rounded-md shadow-inner">
        {/* Using prose classes directly on the MarkdownRenderer's wrapper from MarkdownRenderer.tsx via "markdown-content" class */}
        <MarkdownRenderer markdownContent={podcast.scriptText} />
      </div>
    </div>
  );
};

export default FullTranscriptView;
