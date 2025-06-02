
import { DEFAULT_GEMINI_MODEL_ID, AVAILABLE_MODELS } from "./constants";

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web?: GroundingChunkWeb;
  retrievedContext?: {
    uri: string;
    title: string;
  };
  [key: string]: any; 
}

// StreamFrequency removed
export type StreamDetailLevel = 'brief' | 'comprehensive' | 'research';
export type StreamContextPreference = 'none' | 'last' | 'all';
export type AvailableGeminiModelId = typeof AVAILABLE_MODELS[number]['id'];


export interface Stream {
  id: string;
  name: string;
  focus: string;
  temperature: number; // UI allows 0.0 to 2.0, API for text model expects 0.0-1.0
  detailLevel: StreamDetailLevel;
  contextPreference: StreamContextPreference;
  enableReasoning: boolean; 
  autoThinkingBudget?: boolean; 
  thinkingTokenBudget?: number; 
  topK?: number; 
  topP?: number; 
  seed?: number; 
  modelName?: AvailableGeminiModelId; // Added: To store the selected Gemini model for this stream
}

export interface StreamUpdate {
  id: string;
  mainContent: string; 
  reasoningContent?: string; 
  groundingMetadata?: GroundingChunk[];
  timestamp: string;
  streamId: string;
  mainContentTokens?: number; 
  reasoningTokens?: number; 
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface AppBackup {
  streams: Stream[];
  streamUpdates: { [key: string]: StreamUpdate[] };
}