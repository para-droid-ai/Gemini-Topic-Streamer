
import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Stream, StreamDetailLevel, StreamContextPreference, AvailableGeminiModelId, ReasoningMode } from '../types';
import { XMarkIcon, SparklesIcon, LoadingSpinner, ChevronDownIcon, ChevronUpIcon } from './icons';
import { 
    DEFAULT_TEMPERATURE, 
    DEFAULT_DETAIL_LEVEL, 
    DEFAULT_CONTEXT_PREFERENCE,
    DEFAULT_REASONING_MODE,
    DEFAULT_THINKING_TOKEN_BUDGET,
    DEFAULT_AUTO_THINKING_BUDGET,
    AVAILABLE_MODELS,
    DEFAULT_GEMINI_MODEL_ID
} from '../constants';
import { optimizePromptForStream } from '../services/geminiService';

interface EditStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  stream: Stream | null;
  onSave: (streamData: Stream) => void;
  apiKeyAvailable: boolean;
  mode: 'add' | 'edit';
}

const EditStreamModal: React.FC<EditStreamModalProps> = ({ isOpen, onClose, stream, onSave, apiKeyAvailable, mode }) => {
  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [detailLevel, setDetailLevel] = useState<StreamDetailLevel>(DEFAULT_DETAIL_LEVEL);
  const [contextPreference, setContextPreference] = useState<StreamContextPreference>(DEFAULT_CONTEXT_PREFERENCE);
  const [modelName, setModelName] = useState<AvailableGeminiModelId>(DEFAULT_GEMINI_MODEL_ID);
  
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>(DEFAULT_REASONING_MODE);
  const [autoThinkingBudget, setAutoThinkingBudget] = useState(DEFAULT_AUTO_THINKING_BUDGET);
  const [thinkingTokenBudget, setThinkingTokenBudget] = useState(DEFAULT_THINKING_TOKEN_BUDGET);
  const [topK, setTopK] = useState<number | undefined>(undefined);
  const [topP, setTopP] = useState<number | undefined>(undefined);
  const [seed, setSeed] = useState<number | undefined>(undefined);

  const [isOptimizingFocus, setIsOptimizingFocus] = useState(false);
  const [optimizingFocusError, setOptimizingFocusError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedModelConfig = AVAILABLE_MODELS.find(m => m.id === modelName) || AVAILABLE_MODELS.find(m => m.id === DEFAULT_GEMINI_MODEL_ID);
  // This is a derived constant, not state. It will update whenever modelName state changes.
  const currentModelSupportsThinking = selectedModelConfig?.supportsThinkingConfig || false;

  // Ref to store if the previous model supported thinking. Undefined means modal was closed or just opened.
  const prevModelSupportedThinkingRef = useRef<boolean | undefined>(undefined);

  // Effect 1: Initialize form when modal opens or stream/mode changes
  useEffect(() => {
    if (isOpen) {
      let initialModelId: AvailableGeminiModelId;
      let initialReasoning: ReasoningMode;
      let initialModelSupportsThinking: boolean;

      if (mode === 'edit' && stream) {
        setName(stream.name);
        setFocus(stream.focus);
        setTemperature(stream.temperature ?? DEFAULT_TEMPERATURE);
        setDetailLevel(stream.detailLevel ?? DEFAULT_DETAIL_LEVEL);
        setContextPreference(stream.contextPreference ?? DEFAULT_CONTEXT_PREFERENCE);
        
        initialModelId = stream.modelName ?? DEFAULT_GEMINI_MODEL_ID;
        
        const modelConfig = AVAILABLE_MODELS.find(m => m.id === initialModelId) || AVAILABLE_MODELS.find(m => m.id === DEFAULT_GEMINI_MODEL_ID);
        initialModelSupportsThinking = modelConfig?.supportsThinkingConfig || false;

        if (!initialModelSupportsThinking) {
          initialReasoning = 'off';
        } else {
          initialReasoning = stream.reasoningMode || DEFAULT_REASONING_MODE;
        }
        
        setAutoThinkingBudget(stream.autoThinkingBudget ?? DEFAULT_AUTO_THINKING_BUDGET);
        setThinkingTokenBudget(stream.thinkingTokenBudget ?? DEFAULT_THINKING_TOKEN_BUDGET);
        setTopK(stream.topK);
        setTopP(stream.topP);
        setSeed(stream.seed);
      } else { // 'add' mode
        setName('');
        setFocus('');
        setTemperature(DEFAULT_TEMPERATURE);
        setDetailLevel(DEFAULT_DETAIL_LEVEL);
        setContextPreference(DEFAULT_CONTEXT_PREFERENCE);
        
        initialModelId = DEFAULT_GEMINI_MODEL_ID;
        const defaultAddModelConfig = AVAILABLE_MODELS.find(m => m.id === initialModelId);
        initialModelSupportsThinking = defaultAddModelConfig?.supportsThinkingConfig || false;

        if (!initialModelSupportsThinking) {
          initialReasoning = 'off';
        } else {
          initialReasoning = DEFAULT_REASONING_MODE;
        }
        setAutoThinkingBudget(DEFAULT_AUTO_THINKING_BUDGET);
        setThinkingTokenBudget(DEFAULT_THINKING_TOKEN_BUDGET);
        setTopK(undefined);
        setTopP(undefined);
        setSeed(undefined);
      }
      
      setModelName(initialModelId); // Set model name first
      setReasoningMode(initialReasoning); // Then set reasoning mode based on it

      prevModelSupportedThinkingRef.current = initialModelSupportsThinking; // Prime the ref

      setIsOptimizingFocus(false);
      setOptimizingFocusError(null);
      // setShowAdvanced(false); // Consider resetting or not
    } else {
      // Modal is closed, reset the ref
      prevModelSupportedThinkingRef.current = undefined;
    }
  }, [isOpen, stream, mode]);


  // Effect 2: Handle reasoning mode changes dynamically when AI model selection (modelName) changes
  useEffect(() => {
    if (!isOpen) return;

    const prevSupport = prevModelSupportedThinkingRef.current;

    // If prevSupport is undefined, it means Effect 1 (init) is responsible or just ran.
    // This effect is for model *changes* after initialization.
    if (prevSupport === undefined) {
        // On the very first run where prevSupport is undefined (because Effect 1 set it),
        // ensure the ref is correctly set to the current model's capability for the *next* change.
        prevModelSupportedThinkingRef.current = currentModelSupportsThinking;
        return;
    }
    
    if (!currentModelSupportsThinking) {
      // Current selected model does NOT support thinking.
      if (reasoningMode !== 'off') { // Only change if it's not already 'off'.
        setReasoningMode('off');
      }
    } else {
      // Current selected model DOES support thinking.
      // Check if the previous model did not support thinking AND current reasoning is 'off'.
      if (prevSupport === false && reasoningMode === 'off') {
        // This means we switched from a non-thinking model (which forced reasoning to 'off')
        // to a thinking model. So, "toggle back on" to 'request'.
        setReasoningMode('request');
      }
      // If prevSupport was true (thinking model to another thinking model),
      // or if reasoningMode was already 'request', no automatic change is made here.
      // This respects the user's explicit choice to set reasoningMode to 'off' for a thinking model.
    }

    // Update the ref with the current model's thinking support status for the next change cycle,
    // but only if it has actually changed from the previous.
    if (currentModelSupportsThinking !== prevSupport) {
       prevModelSupportedThinkingRef.current = currentModelSupportsThinking;
    }

  }, [isOpen, modelName, currentModelSupportsThinking, reasoningMode]); // reasoningMode is included to correctly react if it's 'off' during a switch

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert("Stream Name cannot be empty."); return; }
    if (!focus.trim()) { alert("Focus/Prompt Details cannot be empty."); return; }

    const commonData: Omit<Stream, 'id' | 'lastUpdated' | 'pinnedChatMessages'> = {
      name: name.trim(),
      focus: focus.trim(),
      temperature,
      detailLevel,
      contextPreference,
      modelName,
      reasoningMode: reasoningMode, 
      autoThinkingBudget: autoThinkingBudget,
      thinkingTokenBudget: thinkingTokenBudget,
      topK: topK !== undefined && !isNaN(topK) ? Math.max(1, topK) : undefined,
      topP: topP !== undefined && !isNaN(topP) ? Math.min(1, Math.max(0, topP)) : undefined,
      seed: seed !== undefined && !isNaN(seed) ? seed : undefined,
    };
    
    if (mode === 'edit' && stream) {
      onSave({ 
        ...stream, 
        ...commonData 
      });
    } else { 
      onSave(commonData as Stream); 
    }
  };
  
  const handleOptimizeFocus = async () => {
    if (!apiKeyAvailable || !name.trim() || !focus.trim()) {
        setOptimizingFocusError("API key unavailable or Stream Name/Focus is empty.");
        return;
    }
    setIsOptimizingFocus(true);
    setOptimizingFocusError(null);
    try {
      const optimizedFocus = await optimizePromptForStream(name.trim(), focus, detailLevel);
      setFocus(optimizedFocus);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setOptimizingFocusError(message);
    } finally {
      setIsOptimizingFocus(false);
    }
  };

  if (!isOpen) return null;
  const modalTitle = mode === 'edit' && stream ? `Edit Stream: ${stream.name}` : 'Add New Stream';
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-white">{modalTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close modal">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="modalStreamName" className="block text-sm font-medium text-gray-300">Stream Name</label>
            <input type="text" id="modalStreamName" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-100" required disabled={isOptimizingFocus} />
          </div>
          <div>
            <label htmlFor="modalStreamDetailLevel" className="block text-sm font-medium text-gray-300">Detail Level (influences Focus Optimization)</label>
            <select 
              id="modalStreamDetailLevel" 
              value={detailLevel} 
              onChange={(e) => setDetailLevel(e.target.value as StreamDetailLevel)} 
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-100"
              disabled={isOptimizingFocus}
            >
              <option value="brief">Brief (~1,024 words)</option>
              <option value="comprehensive">Comprehensive (~5,000 words)</option>
              <option value="research">Research (~10,000 words)</option>
            </select>
          </div>
          <div>
            <label htmlFor="modalStreamFocus" className="block text-sm font-medium text-gray-300">Focus/Prompt Details</label>
            <textarea id="modalStreamFocus" value={focus} onChange={(e) => setFocus(e.target.value)} rows={6} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-100" required disabled={isOptimizingFocus} placeholder="Describe the core topic..." />
            <button type="button" onClick={handleOptimizeFocus} disabled={!apiKeyAvailable || isOptimizingFocus || !name.trim() || !focus.trim()} className="mt-2 flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-500">
              {isOptimizingFocus ? <LoadingSpinner className="w-4 h-4 mr-2" /> : <SparklesIcon className="w-4 h-4 mr-1.5" />}
              {isOptimizingFocus ? 'Optimizing...' : `Optimize for '${detailLevel}'`}
            </button>            
            {optimizingFocusError && <p className="mt-1.5 text-xs text-red-400">{optimizingFocusError}</p>}
          </div>

          <div>
            <label htmlFor="modalModelName" className="block text-sm font-medium text-gray-300">AI Model</label>
            <select 
              id="modalModelName" 
              value={modelName} 
              onChange={(e) => setModelName(e.target.value as AvailableGeminiModelId)} 
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-100"
            >
              {AVAILABLE_MODELS.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="modalStreamTemperature" className="block text-sm font-medium text-gray-300">Model Temperature: <span className="font-normal text-gray-400">({temperature.toFixed(1)})</span></label>
            <input type="range" id="modalStreamTemperature" min="0" max="2" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="mt-1 block w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
          </div>
          
          <div className="p-3 rounded-md bg-gray-750 border border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Model Reasoning (Thinking)
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setReasoningMode('off')}
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors border ${
                  reasoningMode === 'off'
                    ? 'bg-gray-600 border-gray-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                Off
              </button>
              <button
                type="button"
                onClick={() => { if (currentModelSupportsThinking) setReasoningMode('request'); }}
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors border flex flex-col items-center justify-center ${
                  reasoningMode === 'request' && currentModelSupportsThinking
                    ? 'bg-green-600 border-green-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-green-700'
                } ${!currentModelSupportsThinking ? 'opacity-50 cursor-not-allowed' : '' }`}
                disabled={!currentModelSupportsThinking}
                title={!currentModelSupportsThinking ? "This model does not support reasoning control." : "Request model to show reasoning steps."}
              >
                <span className="font-semibold">Request</span>
                <span className="text-xs opacity-80 mt-0.5">
                  {currentModelSupportsThinking ? '(Recommended)' : '(Not Supported by Model)'}
                </span>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              "Request" asks the model to show its thought process using {'<think>'} tags.
              <br/>
              <span className={currentModelSupportsThinking ? 'text-green-400' : 'text-yellow-400'}>
                {selectedModelConfig?.name || "This model"} {currentModelSupportsThinking
                  ? 'officially supports this feature.'
                  : 'may provide reasoning at its discretion or not at all.'}
              </span>
            </p>

            {reasoningMode === 'request' && currentModelSupportsThinking && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                    <label htmlFor="modalThinkingTokenBudget" className="block text-sm font-medium text-gray-300">
                      Thinking Token Budget: <span className="font-normal text-gray-400">({autoThinkingBudget ? "Auto" : (thinkingTokenBudget === 0 ? "Off" : thinkingTokenBudget.toLocaleString())})</span>
                    </label>
                    <div className="flex items-center">
                        <input 
                            type="checkbox" 
                            id="modalAutoThinkingBudget" 
                            checked={autoThinkingBudget} 
                            onChange={(e) => setAutoThinkingBudget(e.target.checked)}
                            className="h-4 w-4 text-purple-600 border-gray-500 bg-gray-700 rounded focus:ring-purple-500"
                        />
                        <label htmlFor="modalAutoThinkingBudget" className="ml-1.5 text-sm text-gray-300">Auto</label>
                    </div>
                </div>
                <input 
                  type="range" 
                  id="modalThinkingTokenBudget" 
                  min="0" 
                  max="8000" 
                  step="100" 
                  value={thinkingTokenBudget} 
                  onChange={(e) => setThinkingTokenBudget(parseInt(e.target.value, 10))} 
                  className={`mt-1 block w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer ${autoThinkingBudget ? 'opacity-50 cursor-not-allowed' : 'accent-purple-500'}`}
                  disabled={autoThinkingBudget}
                />
                <p className="text-xs mt-1 text-gray-400">
                    "Auto" uses model default. Uncheck "Auto" for manual control: 0 means budget is Off, &gt;0 sets specific budget.
                </p>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="modalContextPreference" className="block text-sm font-medium text-gray-300">Context for New Updates</label>
            <select id="modalContextPreference" value={contextPreference} onChange={(e) => setContextPreference(e.target.value as StreamContextPreference)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-100">
              <option value="none">Fresh (No Context)</option> <option value="last">Use Last Summary</option> <option value="all">Use All Summaries</option>
            </select>
          </div>
          
          <div className="pt-2">
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center justify-between w-full text-sm font-medium text-gray-300 hover:text-white">
              Advanced Model Parameters
              {showAdvanced ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-3 p-3 bg-gray-700 bg-opacity-50 rounded-md border border-gray-600">
                <div>
                  <label htmlFor="modalTopK" className="block text-xs font-medium text-gray-400">Top-K <span className="text-gray-500">(Optional, e.g., 40, min 1)</span></label>
                  <input type="number" id="modalTopK" value={topK ?? ''} onChange={(e) => setTopK(e.target.value ? parseInt(e.target.value, 10) : undefined)} min="1" className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1.5 px-2 text-sm text-gray-100" />
                </div>
                <div>
                  <label htmlFor="modalTopP" className="block text-xs font-medium text-gray-400">Top-P <span className="text-gray-500">(Optional, 0.0-1.0, e.g., 0.95)</span></label>
                  <input type="number" id="modalTopP" value={topP ?? ''} onChange={(e) => setTopP(e.target.value ? parseFloat(e.target.value) : undefined)} min="0" max="1" step="0.01" className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1.5 px-2 text-sm text-gray-100" />
                </div>
                <div>
                  <label htmlFor="modalSeed" className="block text-xs font-medium text-gray-400">Seed <span className="text-gray-500">(Optional integer for deterministic output)</span></label>
                  <input type="number" id="modalSeed" value={seed ?? ''} onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value, 10) : undefined)} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md py-1.5 px-2 text-sm text-gray-100" />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} disabled={isOptimizingFocus} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors">Cancel</button>
            <button type="submit" disabled={isOptimizingFocus} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">{mode === 'add' ? 'Add Stream' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStreamModal;
