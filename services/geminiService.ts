
// services/geminiService.ts

import { GoogleGenAI, GenerateContentResponse, GroundingChunk as GenAIGroundingChunk, Chat, Content } from "@google/genai";
import { 
    GEMINI_MODEL_NAME_FOR_CHAT_AND_OPTIMIZE, 
    GEMINI_TTS_API_ENDPOINT, 
    GEMINI_TTS_MODEL_NAME, 
    TTS_DEFAULT_VOICE,
    DEFAULT_GEMINI_MODEL_ID,
    AVAILABLE_MODELS
} from '../constants';
import { GroundingChunk, Stream, StreamUpdate, PinnedChatMessage, StreamDetailLevel } from '../types'; 

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

  if (stream.reasoningMode === 'request') {
    detailInstruction += `\nIMPORTANT: Utilize <think>...</think> XML-like tags extensively to expose your reasoning process. This could include your plan, information gathering strategy, key points to cover, and how you decide to structure the response. This thinking process should precede the main content for a given section or thought.`;
  }

  let contextPreamble = "";
  let contextInstruction = "";

  if (previousContext) { 
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

    const response: GenerateContentResponse = await localAi.models.generateContent({
      model: modelToUse, 
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
        tools: [{ googleSearch: {} }] 
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

export const optimizePromptForStream = async (streamName: string, currentFocus: string, detailLevel: StreamDetailLevel): Promise<string> => {
  const localAi = getAiClient();
  
  let taskInstruction = "";
  switch (detailLevel) {
    case 'brief':
      taskInstruction = `
Your task is to refine the "Focus Prompt" to be more effective for generating **concise yet deep and nuanced updates**.
The goal is to capture key developments and essential details succinctly.
The output should be suitable for a quick, informative overview.
Consider techniques such as:
- Explicitly asking for the most critical information (e.g., "latest key findings, primary expert reactions, most significant emerging trends, direct impacts").
- Suggesting a very structured and brief output format if it enhances clarity (e.g., "a few bullet points per key area").
- Focusing on clarity and eliminating redundancy.
- Ensuring the prompt encourages depth on core aspects but conciseness in presentation.`;
      break;
    case 'comprehensive':
      taskInstruction = `
Your task is to refine the "Focus Prompt" to be more effective for generating **comprehensive and nuanced updates**.
The goal is to help the user receive in-depth updates, capturing both major developments and subtle details related to the stream's topic.
Consider techniques such as:
- Explicitly asking for different types of information (e.g., "latest news, expert opinions, emerging trends, potential impacts, detailed explanations of specific sub-topics like X and Y").
- Suggesting a structure for the desired output if it significantly enhances clarity for this specific focus.
- Clarifying ambiguities or overly broad statements.
- Broadening or narrowing the scope appropriately based on the stream name and original focus to ensure comprehensive coverage without losing specificity.
- Ensuring the prompt encourages depth, nuance, and the inclusion of diverse perspectives where applicable.
- Phrasing that helps the model understand the desired level of detail and complexity.`;
      break;
    case 'research':
      taskInstruction = `
Your task is to transform the "Current Focus Prompt" into a **highly detailed research directive**.
The goal is to guide a large language model to produce an in-depth research report, potentially incorporating extensive search, planning, and structured formatting.
The refined prompt should be very specific and demanding.
Consider instructing the model (within the refined prompt you generate) to:
- **Perform thorough information gathering:** Explicitly mention seeking diverse sources, data, academic papers, expert analyses, and recent news.
- **Outline a research plan:** Suggest that the model (when it later uses this optimized prompt) should first plan its response structure, identify key research questions derived from the focus, and strategize how it will cover them.
- **Adopt a formal, analytical tone.**
- **Structure the output like a research paper or in-depth briefing:** This might include sections like "Introduction/Scope", "Methodology/Information Sources", "Key Findings", "Detailed Analysis of Sub-Topics (e.g., X, Y, Z)", "Data & Evidence", "Counterarguments/Limitations", "Future Outlook/Implications", and "Conclusion".
- **IMPORTANT for the prompt you generate:** Include a placeholder like "[Current Date: YYYY-MM-DD HH:MM UTC]" or an instruction like "Incorporate the current date and time (e.g., 'As of [Current Date/Time], the situation is...') to contextualize its search and findings." Ensure this placeholder is part of the *outputted optimized prompt*.
- **Demand significant depth and comprehensiveness.**`;
      break;
    default:
      taskInstruction = `
Your task is to refine the "Focus Prompt" to be more effective for generating **comprehensive and nuanced updates**.
The goal is to help the user receive in-depth updates, capturing both major developments and subtle details related to the stream's topic.
Consider techniques such as:
- Explicitly asking for different types of information (e.g., "latest news, expert opinions, emerging trends, potential impacts, detailed explanations of specific sub-topics like X and Y").
- Suggesting a structure for the desired output if it significantly enhances clarity for this specific focus.
- Clarifying ambiguities or overly broad statements.
- Broadening or narrowing the scope appropriately based on the stream name and original focus to ensure comprehensive coverage without losing specificity.
- Ensuring the prompt encourages depth, nuance, and the inclusion of diverse perspectives where applicable.
- Phrasing that helps the model understand the desired level of detail and complexity.`;
      break;
  }

  const prompt = `
You are an expert prompt engineer.
The user has a "Topic Stream" with a name and a "Focus Prompt" that will be used to generate regular updates using a large language model.
The user has also selected a desired "Detail Level" for the stream's output: "${detailLevel}".

Stream Name: "${streamName}"
Current Focus Prompt: """
${currentFocus}
"""

${taskInstruction}

Return ONLY the revised "Focus Prompt" text. Do not include any other explanatory text, preamble, or markdown formatting (like \`\`\`json or \`\`\`text) around the prompt itself. The output should be ready to be directly used as the new focus prompt.
  `;

  try {
    const response: GenerateContentResponse = await localAi.models.generateContent({
      model: GEMINI_MODEL_NAME_FOR_CHAT_AND_OPTIMIZE, 
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

const TTS_CHUNK_SIZE = 4500; 

const chunkText = (text: string): string[] => {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > TTS_CHUNK_SIZE) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk += " " + sentence;
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  return chunks.map(c => c.trim()).filter(c => c.length > 0);
};


export const generateSpeechFromText = async (
  textToSpeak: string,
  voiceName: string = TTS_DEFAULT_VOICE,
  onProgress: (progress: { loaded: number, total: number }) => void
): Promise<string[]> => { 
  
  const apiKey = getApiKeyForTTS();
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured. Cannot generate speech.");
  }

  const textChunks = chunkText(textToSpeak);
  const totalChunks = textChunks.length;
  let loadedChunks = 0;

  console.log(`Text split into ${totalChunks} chunks for TTS processing.`);
  onProgress({ loaded: loadedChunks, total: totalChunks });

  if (totalChunks === 0) {
      return [];
  }

  const chunkPromises = textChunks.map(async (chunk, index) => {
    const requestBody = {
      contents: [{ parts: [{ text: chunk }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
      model: GEMINI_TTS_MODEL_NAME,
    };

    try {
      const response = await fetch(`${GEMINI_TTS_API_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: `Chunk ${index + 1} failed with status ${response.status}` } }));
        throw new Error(`Gemini TTS API request for chunk ${index + 1} failed: ${errorBody.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      loadedChunks++;
      onProgress({ loaded: loadedChunks, total: totalChunks });

      if (data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
        return data.candidates[0].content.parts[0].inlineData.data;
      } else {
        throw new Error(`Invalid response structure for chunk ${index + 1}.`);
      }
    } catch (error) {
      console.error(`Error processing chunk ${index + 1}:`, error);
      throw error;
    }
  });

  return Promise.all(chunkPromises);
};

export const generatePodcastScript = async (rawContent: string, title: string): Promise<string> => {
  const localAi = getAiClient();
  const prompt = `You are an expert podcast scriptwriter. You will be given a collection of raw text from different topic streams, demarcated by [START STREAM: "STREAM NAME"] and [END STREAM: "STREAM NAME"]. This raw text is generated from other AI processes and may include information up to the current date, based on Google Search grounding at the time of its generation.

Your task is to transform THIS EXACT raw text into a single, cohesive podcast script with the title "${title}".

The script must include:
1.  A brief, engaging introduction that previews the topics to be discussed, based *only* on the provided raw content.
2.  Smooth, conversational transitions between each topic stream.
3.  The core content FROM THE PROVIDED TEXT. You must edit this text for flow and clarity as if it were being read aloud, summarizing where necessary to maintain a good pace, BUT YOU MUST NOT INTRODUCE ANY INFORMATION, DATES, CORRECTIONS, OR DETAILS THAT ARE NOT EXPLICITLY PRESENT IN THE RAW CONTENT PROVIDED. Your role is to narrate and structure the given information, not to add to it or fact-check it against external knowledge. The provided raw content is the sole source of truth for this script.
4.  A brief concluding summary that wraps up the report, based *only* on the provided raw content.

The output should be ONLY the final, clean script text, ready for text-to-speech narration. Do not include any other explanatory text, preamble, or markdown formatting, or labels like "Introduction:". Do not use your own knowledge cutoff date; rely solely on the information within the provided \`rawContent\`.

Here is the raw content:
---
${rawContent}
---
`;

  try {
    const response = await localAi.models.generateContent({
      model: GEMINI_MODEL_NAME_FOR_CHAT_AND_OPTIMIZE, 
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.6 }, 
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating podcast script:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API error during podcast script generation: ${error.message}`);
    }
    throw new Error("Failed to generate podcast script from Gemini.");
  }
};

export const generatePodcastTitleCardImage = async (podcastTitle: string, scriptContent: string): Promise<string | null> => {
  const localAi = getAiClient();
  const scriptExcerpt = scriptContent.substring(0, 350).replace(/\n/g, " "); 
  const primaryModel = 'imagen-3.0-generate-002';
  const fallbackModel = 'gemini-2.0-flash-preview-image-generation';

  const imagePrompt = `**ABSOLUTE DIRECTIVE: THE IMAGE MUST BE COMPLETELY DEVOID OF ANY TEXT, LETTERS, WORDS, NUMBERS, CHARACTERS, OR WRITTEN SYMBOLS. THIS INCLUDES TEXT WITHIN LOGOS, ON CLOTHING, ON EQUIPMENT, OR IN THE BACKGROUND. PURELY VISUAL AND SYMBOLIC. NO TEXT WHATSOEVER.**

You are an AI artist creating a highly artistic, modern, and engaging visual for a podcast title card.
Podcast Title: "${podcastTitle}"
Podcast Script Excerpt (for thematic inspiration): "${scriptExcerpt}"

Your task is to generate a **symbolic or abstract visual representation** of the core subject matter hinted at by the podcast title and inspired by the script excerpt.

**Key Visual Requirements:**
1.  **Core Subject Essence:** The image MUST capture the *essence and dynamic feel* of the podcast's main subject.
    *   For example, if the title is 'NHL Daily' or mentions hockey, the image should evoke the essence of ice hockey – speed, the puck, skates, ice patterns, abstract player forms, dynamic motion, cool color palettes.
2.  **NO LITERAL TEXT OR LOGOS:**
    *   **Crucial for sports (e.g., hockey):** AVOID depicting jerseys with team names or numbers, player names, or equipment branding (like on sticks, skates, or helmets). DO NOT show official league logos (e.g., "NHL" shield) or text on rink boards, scoreboards, or as part of the ice markings.
    *   **General Rule:** For any topic, avoid any text that would typically appear in a literal or photorealistic representation of the subject. The goal is a visual interpretation, not a depiction of branded items.
3.  **Artistic Interpretation Focus:**
    *   **Abstract:** Use shapes, colors, and textures to evoke the mood and theme.
    *   **Symbolic:** Use recognizable symbols of the subject (e.g., a puck, a stick, a net for hockey, but rendered artistically and completely free of any text or branding) in a creative, non-literal composition.
    *   **Stylized Illustration:** A non-photorealistic illustration that focuses on action or mood without including textual details or specific branding.
4.  **Visual Elements from Script:** Use the script excerpt to inspire colors, mood, or specific actions/elements to incorporate *artistically* into the image, while strictly adhering to the "NO TEXT" and "NO LOGOS" rule. For instance, if a hockey script mentions a "fast break," the image could show dynamic lines and a sense of motion related to hockey, without showing actual players with jersey text.
5.  **Professional Aesthetic:** The image should be modern, high-quality, and visually engaging as a podcast thumbnail.

**Reiteration of Critical Constraint: Zero text, zero letters, zero numbers, zero written symbols. This is the most important rule. The image must be purely visual artwork.**

Generate an image based on these strict instructions.`;

  const imageConfig = { numberOfImages: 1, outputMimeType: 'image/jpeg' };

  try {
    console.log(`Attempting title card image generation with primary model: ${primaryModel}`);
    const response = await localAi.models.generateImages({
      model: primaryModel,
      prompt: imagePrompt,
      config: imageConfig,
    });

    if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      console.log(`Primary image generation successful with ${primaryModel}.`);
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    console.warn(`No image generated or image data missing from ${primaryModel} response. Prompt used:`, imagePrompt);
    // If primary model "succeeds" but returns no image, don't fallback yet, could be prompt issue.
    // Fallback is primarily for quota errors.
    return null;
  } catch (primaryError: any) {
    const primaryErrorMessageString = primaryError instanceof Error ? primaryError.message : String(primaryError);

    if (primaryErrorMessageString.includes("RESOURCE_EXHAUSTED") || primaryErrorMessageString.includes("429")) {
      console.warn(`Primary model ${primaryModel} quota exceeded. Attempting fallback with ${fallbackModel}. Prompt:`, imagePrompt, "Primary Error Details:", primaryErrorMessageString);

      try {
        console.log(`Attempting title card image generation with fallback model: ${fallbackModel}`);
        const fallbackResponse = await localAi.models.generateImages({
          model: fallbackModel,
          prompt: imagePrompt,
          config: imageConfig,
        });

        if (fallbackResponse.generatedImages && fallbackResponse.generatedImages.length > 0 && fallbackResponse.generatedImages[0].image?.imageBytes) {
          const base64ImageBytes = fallbackResponse.generatedImages[0].image.imageBytes;
          console.log(`Fallback image generation successful with ${fallbackModel}.`);
          return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        console.warn(`Fallback model ${fallbackModel} also failed to generate image or returned no image data. Prompt used:`, imagePrompt);
        return null;
      } catch (fallbackError: any) {
        const fallbackErrorMessageString = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        console.error(`Fallback model ${fallbackModel} failed. Prompt used:`, imagePrompt, "Fallback Error Details:", fallbackErrorMessageString);
        return null;
      }
    } else {
      // Error with primary model was not a quota issue
      console.error(`Error generating podcast title card image with primary model ${primaryModel}. No fallback attempted for this error type. Prompt:`, imagePrompt, "Full Error:", primaryError);
      return null;
    }
  }
};
