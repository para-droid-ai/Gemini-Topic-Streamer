import { StreamContextPreference, StreamDetailLevel } from "./types"; // StreamFrequency removed

export const GEMINI_MODEL_NAME = "gemini-2.5-flash-preview-04-17";
export const GEMINI_TTS_MODEL_NAME = "gemini-2.5-flash-preview-tts";
export const GEMINI_TTS_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL_NAME}:generateContent`;

export const APP_NAME = "Gemini Topic Streamer";
export const USER_API_KEY_STORAGE_KEY = 'geminiUserApiKey_v1';


export const DISPLAY_MODEL_NAME = "Gemini 2.5 Flash"; // For UI display

export const DEFAULT_TEMPERATURE = 0.7;
// export const DEFAULT_FREQUENCY: StreamFrequency = 'on-demand'; // Removed
export const DEFAULT_DETAIL_LEVEL: StreamDetailLevel = 'comprehensive';
// export const DEFAULT_AUTO_UPDATE_ENABLED = false; // Removed
export const DEFAULT_CONTEXT_PREFERENCE: StreamContextPreference = 'none';

export const DEFAULT_ENABLE_REASONING = true;
export const DEFAULT_AUTO_THINKING_BUDGET = true; // Added: Auto budget is default
export const DEFAULT_THINKING_TOKEN_BUDGET = 0; // Slider's initial value if auto is false / stored value if auto is true
// topK, topP, seed will default to undefined if not set by user via EditStreamModal

// Audio constants
export const TTS_DEFAULT_VOICE = "Kore"; // Default voice for Gemini TTS
export const TTS_SAMPLE_RATE = 24000; // Gemini TTS outputs at 24kHz