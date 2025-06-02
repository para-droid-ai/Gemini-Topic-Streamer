
import { StreamContextPreference, StreamDetailLevel } from "./types"; // StreamFrequency removed

export const AVAILABLE_MODELS = [
  { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash (04-17)", supportsThinkingConfig: true, default: true },
  { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash (05-20)", supportsThinkingConfig: false, default: false },
  { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro (05-06)", supportsThinkingConfig: false, default: false },
] as const;

export type AvailableGeminiModelId = typeof AVAILABLE_MODELS[number]['id'];

export const DEFAULT_GEMINI_MODEL_ID: AvailableGeminiModelId = 
    AVAILABLE_MODELS.find(m => m.default)?.id || "gemini-2.5-flash-preview-04-17";

// GEMINI_MODEL_NAME is deprecated for stream-specific generation. Use stream.modelName or DEFAULT_GEMINI_MODEL_ID.
// It's kept here for services like chat or prompt optimization that don't have per-stream model selection yet.
export const GEMINI_MODEL_NAME_FOR_CHAT_AND_OPTIMIZE = DEFAULT_GEMINI_MODEL_ID;


export const GEMINI_TTS_MODEL_NAME = "gemini-2.5-flash-preview-tts";
export const GEMINI_TTS_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL_NAME}:generateContent`;

export const APP_NAME = "Gemini Topic Streamer";
export const USER_API_KEY_STORAGE_KEY = 'geminiUserApiKey_v1';

// DISPLAY_MODEL_NAME is deprecated. Get model name from AVAILABLE_MODELS using stream.modelName.
// export const DISPLAY_MODEL_NAME = "Gemini 2.5 Flash"; 

export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_DETAIL_LEVEL: StreamDetailLevel = 'comprehensive';
export const DEFAULT_CONTEXT_PREFERENCE: StreamContextPreference = 'none';

export const DEFAULT_ENABLE_REASONING = true;
export const DEFAULT_AUTO_THINKING_BUDGET = true; 
export const DEFAULT_THINKING_TOKEN_BUDGET = 0; 


// Audio constants
export const TTS_DEFAULT_VOICE = "Kore"; 
export const TTS_SAMPLE_RATE = 24000; 
