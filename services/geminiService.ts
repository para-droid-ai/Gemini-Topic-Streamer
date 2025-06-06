
import { GoogleGenAI, GenerateContentResponse, GroundingChunk as GenAIGroundingChunk, Chat, Content } from "@google/genai";
import { 
    GEMINI_MODEL_NAME_FOR_CHAT_AND_OPTIMIZE, 
    GEMINI_TTS_API_ENDPOINT, 
    GEMINI_TTS_MODEL_NAME, 
    TTS_DEFAULT_VOICE,
    DEFAULT_GEMINI_MODEL_ID,
    AVAILABLE_MODELS
} from '../constants';
import { GroundingChunk, Stream, StreamUpdate, PinnedChatMessage } from '../types'; 

let ai: GoogleGenAI | null = null;
let activeInitializedKey: string | null = null; 
let userProvidedApiKey: string | null = null; 

export const updateUserApiKey = (newKey: string | null): void => {
  const oldEffectiveKey = userProvidedApiKey || process.env.API_KEY;
  userProvidedApiKey = newKey;
  const newEffectiveKey = userProvidedApiKey || process.env.API_KEY;

  if (oldEffectiveKey !== newEffectiveKey || !ai) {
    activeInitializedKey = null; 
    ai = null; 
    console.log("Gemini API key updated. Client will re-initialize on next call.");
  }
};

const initializeGenAI = (): GoogleGenAI | null => {
  const effectiveKey = userProvidedApiKey || process.env.API_KEY;

  if (ai && activeInitializedKey === effectiveKey) {
    return ai; 
  }

  if (effectiveKey) {
    try {
      ai = new GoogleGenAI({ apiKey: effectiveKey });
      activeInitializedKey = effectiveKey;
      console.log(`Gemini API client initialized with ${userProvidedApiKey ? 'user-provided' : 'environment'} key.`);
      return ai;
    } catch (error) {
      console.error("Failed to initialize Gemini API client with key:", error);
      ai = null;
      activeInitializedKey = null;
      return null;
    }
  } else {
    ai = null;
    activeInitializedKey = null;
    return null;
  }
};

const getAiClient = (): GoogleGenAI => {
  const client = initializeGenAI(); 
  if (!client) {
    throw new Error("Gemini API client is not initialized. API_KEY might be missing or invalid.");
  }
  return client;
};

export const isApiKeyEffectivelySet = (): boolean => {
  return !!(userProvidedApiKey || process.env.API_KEY);
};

export const getActiveKeySource = (): 'user' | 'environment' | 'none' => {
    if (userProvidedApiKey) return 'user';
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) return 'environment';
    return 'none';
}

interface FetchStreamUpdatesResult {
  mainContent: string;
  reasoningContent?: string;
  groundingMetadata?: GroundingChunk[];
  mainContentTokens?: number;
  reasoningTokens?: number;
}

export type PreviousContext = {
  type: 'last';
  update: StreamUpdate; 
} | {
  type: 'all';
  updates: StreamUpdate[]; 
} | null;

export const fetchStreamUpdates = async (stream: Stream, previousContext?: PreviousContext): Promise<FetchStreamUpdatesResult> => {
  const localAi = getAiClient();
  const modelToUse = stream.modelName || DEFAULT_GEMINI_MODEL_ID;
  const selectedModelConfig = AVAILABLE_MODELS.find(m => m.id === modelToUse) || AVAILABLE_MODELS.find(m => m.id === DEFAULT_GEMINI_MODEL_ID);

  let detailInstruction = "";
  switch (stream.detailLevel) {
    case 'brief':
      detailInstruction = "Present a concise summary in well-structured Markdown format, approximately 1024 words.";
      break;
    case 'comprehensive':
      detailInstruction = "Present the output in well-structured Markdown format. Aim for a response that is approximately 5000 words, covering multiple facets of the topic extensively.";
      break;
    case 'research':
      detailInstruction = "Present an in-depth research report in well-structured Markdown format. Aim for a very comprehensive response, approximately 10000 words, exploring the topic with significant depth, including nuances, data, and detailed analysis.";
      break;
    default: 
      detailInstruction = "Present the output in well-structured Markdown format. Aim for a response that is approximately 5000 words, covering multiple facets of the topic extensively.";
      break;
  }

  // Always add the reasoning prompt if the mode is 'request'
  if (stream.reasoningMode === 'request') {
    detailInstruction += `\nIMPORTANT: Utilize <think>...</think> XML-like tags extensively to expose your reasoning process. This could include your plan, information gathering strategy, key points to cover, and how you decide to structure the response. This thinking process should precede the main content for a given section or thought.`;
  }

  let contextPreamble = "";
  let contextInstruction = "";

  if (previousContext) { // This implies stream.contextPreference is 'last' or 'all'
    let contextText = "";
    switch (previousContext.type) {
      case 'last':
        contextText = `Previous Update (from ${new Date(previousContext.update.timestamp).toLocaleString()}):\n${previousContext.update.mainContent}`;
        break;
      case 'all':
        if (previousContext.updates && previousContext.updates.length > 0) {
          contextText = "Previous Updates History (newest first):\n" +
                        previousContext.updates.map((upd, idx) =>
                          `Update ${previousContext.updates.length - idx} (from ${new Date(upd.timestamp).toLocaleString()}):\n${upd.mainContent}`
                        ).join("\n\n---\n\n");
        }
        break;
    }

    if (contextText) {
      contextPreamble = `
PREVIOUS CONTEXT (STREAM UPDATES):
The following is context from previous update(s) for this stream. Review it carefully to understand what information has already been provided.
--- BEGIN PREVIOUS STREAM UPDATE CONTEXT ---
${contextText}
--- END PREVIOUS STREAM UPDATE CONTEXT ---

`;
      contextInstruction = `
TASK MODIFICATION BASED ON PREVIOUS STREAM UPDATE CONTEXT:
Your primary goal now is to build upon the PREVIOUS STREAM UPDATE CONTEXT provided above. Specifically:
- Identify and present **NEW information, recent developments, deeper analysis, or different perspectives** that were NOT covered in the previous stream update context.
- If you are expanding on a point from the previous context, explicitly state that you are doing so.
- **Critically avoid repeating information** already present in the context unless it's absolutely necessary for comparison, to highlight a significant change, or to provide a direct counterpoint.
`;
    }
  }

  let pinnedMessagesPreamble = "";
  // Pinned messages are only included if stream.contextPreference is 'last' or 'all'
  if ( (stream.contextPreference === 'last' || stream.contextPreference === 'all') && 
       stream.pinnedChatMessages && stream.pinnedChatMessages.length > 0
     ) {
    const pinnedContextText = stream.pinnedChatMessages
      .map(pm => `${pm.role === 'user' ? 'User' : 'Assistant'} (pinned from chat on ${new Date(pm.originalTimestamp).toLocaleString()}): ${pm.text}`)
      .join("\n");
    
    pinnedMessagesPreamble = `
USER-PINNED CHAT CONTEXT:
The following are messages manually pinned by the user from a previous chat discussion related to this stream. These are considered highly relevant by the user and should be considered alongside any previous stream update context.
--- BEGIN PINNED CHAT CONTEXT ---
${pinnedContextText}
--- END PINNED CHAT CONTEXT ---

Based on this pinned chat context, ensure your response integrates or addresses these points as appropriate, in addition to any instructions related to previous stream updates.
`;
  }


  const prompt = `
${pinnedMessagesPreamble} 
${contextPreamble}
You are an AI assistant tasked with generating updates on specific topics, similar to an in-depth RSS feed item, a briefing document, or a research paper, depending on the requested detail level.
The information should be current and relevant, drawing from recent news, discussions, and developments.
${detailInstruction}

Topic: "${stream.name}"
Focus: "${stream.focus}"

Please provide an update covering:
- Key developments and milestones.
- Significant news articles or announcements.
- Notable public or expert discussions and opinions.
- Potential implications or future outlook.
${contextInstruction}

Prioritize recent information (last few weeks/months if applicable, based on the stream's focus) and structure it clearly using Markdown headings, lists, and paragraphs for excellent readability.
Ensure to cite sources if specific claims or data are presented by leveraging Google Search grounding.
Your response should be entirely in Markdown.
If reasoning is requested via instructions to use <think> tags, ensure these tags wrap your thought processes.
`;

  try {
    let clampedTemperature = stream.temperature;
    if (stream.temperature < 0.0 || stream.temperature > 1.0) {
      console.warn(`Temperature ${stream.temperature} for stream "${stream.name}" is outside the typical API range (0.0-1.0) for text models. Clamping to ${Math.max(0.0, Math.min(1.0, stream.temperature))}.`);
      clampedTemperature = Math.max(0.0, Math.min(1.0, stream.temperature));
    }
    
    const apiCallConfig: any = { 
        tools: [{ googleSearch: {} }],
        temperature: clampedTemperature,
    };

    if (stream.topK !== undefined && stream.topK !== null && !isNaN(stream.topK)) apiCallConfig.topK = stream.topK;
    if (stream.topP !== undefined && stream.topP !== null && !isNaN(stream.topP)) apiCallConfig.topP = stream.topP;
    if (stream.seed !== undefined && stream.seed !== null && !isNaN(stream.seed)) apiCallConfig.seed = stream.seed;

    if (selectedModelConfig?.supportsThinkingConfig) {
      if (stream.reasoningMode === 'off') {
        apiCallConfig.thinkingConfig = { thinkingBudget: 0 };
      } else if (stream.reasoningMode === 'request') {
        if (stream.autoThinkingBudget === true || stream.autoThinkingBudget === undefined) {
          // No explicit thinkingConfig needed, model uses its default budget for "request" mode.
        } else {
          if (stream.thinkingTokenBudget !== undefined) {
            apiCallConfig.thinkingConfig = { thinkingBudget: stream.thinkingTokenBudget };
          }
        }
      }
    }
    // For models that don't support thinkingConfig, it's omitted.

    const response: GenerateContentResponse = await localAi.models.generateContent({
      model: modelToUse, // Use the selected model for the stream
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: apiCallConfig,
    });

    const rawText = response.text;
    let mainContentAccumulator = "";
    let reasoningContentAccumulator = "";
    const thinkTagRegex = /<think>([\s\S]*?)<\/think>/g;
    let lastIndex = 0;
    let match;

    while ((match = thinkTagRegex.exec(rawText)) !== null) {
      mainContentAccumulator += rawText.substring(lastIndex, match.index);
      if (match[1].trim()) { 
        reasoningContentAccumulator += (reasoningContentAccumulator ? "\n\n---\n\n" : "") + match[1].trim();
      }
      lastIndex = thinkTagRegex.lastIndex;
    }
    mainContentAccumulator += rawText.substring(lastIndex);

    const finalMainContent = mainContentAccumulator.trim();
    const finalReasoningContent = reasoningContentAccumulator.trim() || undefined;

    const mainContentTokens = finalMainContent ? Math.ceil(finalMainContent.length / 4) : 0;
    const reasoningTokens = finalReasoningContent ? Math.ceil(finalReasoningContent.length / 4) : 0;

    const rawGroundingData = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    let groundingMetadata: GroundingChunk[] | undefined = undefined;
    if (Array.isArray(rawGroundingData)) {
      groundingMetadata = rawGroundingData.map((chunk: GenAIGroundingChunk) => {
        if (chunk.web) {
          return { web: { uri: chunk.web.uri || '', title: chunk.web.title || 'Untitled Source' } };
        }
        if (chunk.retrievedContext) { 
          return { web: { uri: chunk.retrievedContext.uri || '', title: chunk.retrievedContext.title || 'Untitled Source' } };
        }
        return { web: { uri: '#', title: 'Unknown Source' } }; 
      }).filter(chunk => chunk.web && chunk.web.uri && chunk.web.uri !== '#'); 
    }
    
    return { 
        mainContent: finalMainContent, 
        reasoningContent: finalReasoningContent, 
        groundingMetadata, 
        mainContentTokens, 
        reasoningTokens 
    };

  } catch (error) {
    console.error("Error fetching stream updates from Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while fetching updates from Gemini.");
  }
};


export const createChatSession = (initialContext: string): Chat | null => {
  const localAi = getAiClient();
 
  const history: Content[] = [
    {
      role: "user",
      parts: [{ text: `The following is the context for our discussion. Please read it carefully:\n\n---\n${initialContext}\n---\n\nI will ask you questions about this context.` }]
    },
    {
      role: "model",
      parts: [{ text: "Understood. I have reviewed the context you provided. I'm ready for your questions." }]
    }
  ];

  try {
    const chat: Chat = localAi.chats.create({
      model: GEMINI_MODEL_NAME_FOR_CHAT_AND_OPTIMIZE, 
      history: history,
      config: {
        systemInstruction: "You are an intelligent assistant. Your primary goal is to help the user explore and understand the provided context in more detail. Answer questions based on the context. If the context doesn't provide an answer, say so. Use Google Search grounding to provide current and relevant information for your answers.",
        tools: [{ googleSearch: {} }] // Enable Google Search for chat
      }
    });
    return chat;
  } catch (error) {
    console.error("Error creating chat session with Gemini:", error);
    return null; 
  }
};

interface SendMessageResult {
  text: string;
  groundingMetadata?: GroundingChunk[];
}

export const sendMessageInChat = async (chat: Chat, message: string): Promise<SendMessageResult> => {
  getAiClient(); 

  try {
    const response: GenerateContentResponse = await chat.sendMessage({ message });
    const text = response.text;
    let groundingMetadata: GroundingChunk[] | undefined = undefined;
    const rawGroundingData = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

    if (Array.isArray(rawGroundingData)) {
      groundingMetadata = rawGroundingData.map((chunk: GenAIGroundingChunk) => {
        if (chunk.web) {
          return { web: { uri: chunk.web.uri || '', title: chunk.web.title || 'Untitled Source' } };
        }
        if (chunk.retrievedContext) {
          return { web: { uri: chunk.retrievedContext.uri || '', title: chunk.retrievedContext.title || 'Untitled Source' } };
        }
        return { web: { uri: '#', title: 'Unknown Source' } };
      }).filter(chunk => chunk.web && chunk.web.uri && chunk.web.uri !== '#');
    }

    return { text, groundingMetadata };
  } catch (error) {
    console.error("Error sending message in chat to Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API chat error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while sending a chat message to Gemini.");
  }
};

export const optimizePromptForStream = async (streamName: string, currentFocus: string): Promise<string> => {
  const localAi = getAiClient();
  
  const prompt = `
You are an expert prompt engineer.
The user has a "Topic Stream" with a name and a "Focus Prompt" that will be used to generate regular updates using a large language model.
Your task is to refine the "Focus Prompt" to be more effective.
The goal is to help the user receive comprehensive and nuanced updates, capturing both major developments and subtle details related to the stream's topic.

Stream Name: "${streamName}"
Current Focus Prompt: """
${currentFocus}
"""

Analyze the Stream Name and the Current Focus Prompt.
Rewrite and improve the "Focus Prompt" to be clearer, more specific, and better structured for querying a large language model like Gemini.
Consider incorporating techniques such as:
- Explicitly asking for different types of information (e.g., "latest news, expert opinions, emerging trends, potential impacts, detailed explanations of specific sub-topics like X and Y").
- Suggesting a structure for the desired output only if it significantly enhances clarity for this specific focus.
- Clarifying ambiguities or overly broad statements.
- Broadening or narrowing the scope appropriately based on the stream name and original focus to ensure comprehensive coverage without losing specificity.
- Ensuring the prompt encourages depth, nuance, and the inclusion of diverse perspectives where applicable.
- Phrasing that helps the model understand the desired level of detail and complexity.

Return ONLY the revised "Focus Prompt" text. Do not include any other explanatory text, preamble, or markdown formatting (like \`\`\`json or \`\`\`text) around the prompt itself. The output should be ready to be directly used as the new focus prompt.
  `;

  try {
    const response: GenerateContentResponse = await localAi.models.generateContent({
      model: GEMINI_MODEL_NAME_FOR_CHAT_AND_OPTIMIZE, // Prompt optimization uses default model
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.5, 
      },
    });
    
    let optimizedText = response.text.trim();
    const fenceRegex = /^```(?:\w+)?\s*\n?(.*?)\n?\s*```$/s; 
    const match = optimizedText.match(fenceRegex);
    if (match && match[1]) {
      optimizedText = match[1].trim();
    }
    
    return optimizedText;

  } catch (error) {
    console.error("Error optimizing prompt with Gemini:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API error during prompt optimization: ${error.message}`);
    }
    throw new Error("An unknown error occurred while optimizing the prompt with Gemini.");
  }
};

const getApiKeyForTTS = (): string | null => {
  return userProvidedApiKey || (typeof process !== 'undefined' && process.env && process.env.API_KEY) || null;
}

export const generateSpeechFromText = async (textToSpeak: string, voiceName: string = TTS_DEFAULT_VOICE): Promise<string> => {
  const apiKey = getApiKeyForTTS();
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured. Cannot generate speech.");
  }

  const requestBody = {
    contents: [{
      parts: [{
        text: textToSpeak
      }]
    }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceName
          }
        }
      }
    },
    model: GEMINI_TTS_MODEL_NAME, 
  };

  const startTime = performance.now();
  try {
    const response = await fetch(`${GEMINI_TTS_API_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: { message: "Unknown API error structure" } }));
      console.error("Gemini TTS API Error Response:", errorBody);
      throw new Error(`Gemini TTS API request failed with status ${response.status}: ${errorBody.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`Gemini TTS request for "${textToSpeak.substring(0, 30)}..." took: ${duration.toFixed(2)}ms`);
    
    if (data.candidates && data.candidates.length > 0 &&
        data.candidates[0].content && data.candidates[0].content.parts &&
        data.candidates[0].content.parts.length > 0 &&
        data.candidates[0].content.parts[0].inlineData &&
        data.candidates[0].content.parts[0].inlineData.data) {
      return data.candidates[0].content.parts[0].inlineData.data;
    } else {
      console.error("Invalid response structure from Gemini TTS API:", data);
      throw new Error("Invalid response structure from Gemini TTS API. No audio data found.");
    }
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.error(`Gemini TTS request for "${textToSpeak.substring(0,30)}..." failed after ${duration.toFixed(2)}ms. Error:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unknown error occurred while generating speech.");
  }
};