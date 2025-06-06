
import { DEFAULT_GEMINI_MODEL_ID, AVAILABLE_MODELS } from "./constants";

export type ReasoningMode = 'off' | 'request';

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

export interface PinnedChatMessage {
  id: string; // Unique ID for the pinned message entry
  messageId: string; // Original ID of the chat message
  role: 'user' | 'model';
  text: string;
  originalTimestamp: string;
  pinnedTimestamp: string;
}

export interface Stream {
  id: string;
  name: string;
  focus: string;
  temperature: number; // UI allows 0.0 to 2.0, API for text model expects 0.0-1.0
  detailLevel: StreamDetailLevel;
  contextPreference: StreamContextPreference;
  reasoningMode: ReasoningMode; 
  autoThinkingBudget?: boolean; 
  thinkingTokenBudget?: number; 
  topK?: number; 
  topP?: number; 
  seed?: number; 
  modelName?: AvailableGeminiModelId; // Added: To store the selected Gemini model for this stream
  pinnedChatMessages?: PinnedChatMessage[]; // Added for pinned chat messages
  lastUpdated?: string; // Optional ISO date string for when the stream was last updated or reordered
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
  groundingMetadata?: GroundingChunk[]; // Added for chat grounding
}

export interface AppBackup {
  streams: Stream[];
  streamUpdates: { [key: string]: StreamUpdate[] };
}