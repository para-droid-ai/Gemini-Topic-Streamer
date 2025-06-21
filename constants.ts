
import { StreamContextPreference, StreamDetailLevel, ReasoningMode } from "./types"; // StreamFrequency removed, Added ReasoningMode

const DEFAULT_TEXT_MODEL_ID = 'gemini-2.5-flash-preview-04-17';

export const AVAILABLE_MODELS = [
  { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash (04-17)", supportsThinkingConfig: true, default: DEFAULT_TEXT_MODEL_ID === "gemini-2.5-flash-preview-04-17" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", supportsThinkingConfig: true, default: (DEFAULT_TEXT_MODEL_ID as string) === "gemini-2.5-flash" },
  { id: "gemini-2.5-flash-lite-preview-06-17", name: "Gemini 2.5 Flash Lite (06-17)", supportsThinkingConfig: true, default: (DEFAULT_TEXT_MODEL_ID as string) === "gemini-2.5-flash-lite-preview-06-17" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", supportsThinkingConfig: true, default: (DEFAULT_TEXT_MODEL_ID as string) === "gemini-2.5-pro" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", supportsThinkingConfig: false, default: (DEFAULT_TEXT_MODEL_ID as string) === "gemini-2.0-flash" },
] as const;

export type AvailableGeminiModelId = typeof AVAILABLE_MODELS[number]['id'];

export const DEFAULT_GEMINI_MODEL_ID: AvailableGeminiModelId = 
    AVAILABLE_MODELS.find(m => m.default)?.id || DEFAULT_TEXT_MODEL_ID;

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

export const DEFAULT_REASONING_MODE: ReasoningMode = 'off';
export const DEFAULT_AUTO_THINKING_BUDGET = true; 
export const DEFAULT_THINKING_TOKEN_BUDGET = 0; 


// Audio constants
export const TTS_DEFAULT_VOICE = "Kore"; 
export const TTS_SAMPLE_RATE = 24000;

export const AVAILABLE_TTS_VOICES = [
  { id: "Kore", name: "Kore (Default)" }, // Assuming Kore is a valid and desired default
  { id: "Aoede", name: "Aoede" },
  { id: "Enceladus", name: "Enceladus" },
  { id: "Zephyr", name: "Zephyr" },
  { id: "Puck", name: "Puck" },
  { id: "Leda", name: "Leda" },
  { id: "Alnilam", name: "Alnilam" },
  { id: "Sulafat", name: "Sulafat" },
  { id: "Algenib", name: "Algenib" },
] as const;

export type AvailableTTSVoiceId = typeof AVAILABLE_TTS_VOICES[number]['id'];
