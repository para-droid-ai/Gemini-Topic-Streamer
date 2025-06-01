import React, { useState, useEffect } from 'react';
import { XMarkIcon, KeyIcon } from './icons';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveKey: (key: string) => void;
  onClearKey: () => void;
  currentKeyExists: boolean;
  currentKeySource: 'user' | 'environment' | 'none';
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ 
    isOpen, 
    onClose, 
    onSaveKey, 
    onClearKey, 
    currentKeyExists,
    currentKeySource
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKeyInput(''); // Reset input field when modal opens
      setShowKey(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (apiKeyInput.trim()) {
      onSaveKey(apiKeyInput.trim());
      onClose();
    } else {
      alert("Please enter an API key.");
    }
  };

  const handleClear = () => {
    onClearKey();
    // Optionally close, or let user see the status update
    // onClose(); 
  };

  if (!isOpen) return null;

  let statusMessage = "API Key: Not Set. Functionality will be limited.";
  let statusColor = "text-red-400";
  if (currentKeyExists) {
      if (currentKeySource === 'user') {
          statusMessage = "API Key: Set by user (stored in browser).";
          statusColor = "text-green-400";
      } else if (currentKeySource === 'environment') {
          statusMessage = "API Key: Provided by environment. You can override it below.";
          statusColor = "text-yellow-400";
      }
  }


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <KeyIcon className="w-6 h-6 mr-2 text-yellow-400" />
            Configure API Key
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close modal">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <p className={`text-sm mb-3 ${statusColor}`}>{statusMessage}</p>
        
        <p className="text-xs text-gray-400 mb-4">
          Enter your Google Gemini API Key. It will be stored in your browser's local storage and used for all API requests. 
          This key is not sent to any server other than Google's.
        </p>

        <div className="mb-4">
          <label htmlFor="apiKeyInput" className="block text-sm font-medium text-gray-300 mb-1">
            Gemini API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              id="apiKeyInput"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-100 pr-10"
              placeholder={currentKeySource === 'user' ? "Enter new key to change" : "Enter your API Key"}
            />
            <button 
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-200"
                aria-label={showKey ? "Hide API Key" : "Show API Key"}
            >
              {showKey ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={handleClear}
            disabled={!currentKeyExists && currentKeySource !== 'environment'} // Can clear env override
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentKeySource === 'user' ? "Clear Stored Key" : (currentKeySource === 'environment' ? "Use Environment Key" : "Clear Key")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Save Key
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
