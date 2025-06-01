
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

export interface Stream {
  id: string;
  name: string;
  focus: string;
  temperature: number; // UI allows 0.0 to 2.0, API for text model expects 0.0-1.0
  detailLevel: StreamDetailLevel;
  // autoUpdateEnabled: boolean; // Removed
  contextPreference: StreamContextPreference;
  enableReasoning: boolean; 
  autoThinkingBudget?: boolean; // Added: true for auto/model default, false for manual slider
  thinkingTokenBudget?: number; // Value from slider (0-8000) if autoThinkingBudget is false
  topK?: number; 
  topP?: number; 
  seed?: number; 
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