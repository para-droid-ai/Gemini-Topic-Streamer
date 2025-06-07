# Gemini Topic Streamer

**Gemini Topic Streamer** is a powerful, web-based application designed to help users create and maintain personalized, in-depth information feeds on specific topics. Leveraging the capabilities of Google's Gemini API, it acts like an intelligent, self-updating research assistant, providing comprehensive updates with search-backed grounding, a clear view of the AI's reasoning process if desired, and the ability to listen to content via Text-to-Speech.

## The Challenge: Staying Deeply Informed

In today's fast-paced information landscape, staying truly informed about specific, evolving topics can be challenging. Standard web searches provide snapshots in time, and general AI chat tools, while versatile, often lack the continuous, focused depth required for ongoing research or specialized interest tracking. Users need a way to:

*   Track developments on niche subjects comprehensively.
*   Receive synthesized information rather than just lists of links.
*   Understand how new information builds upon previous knowledge.
*   Control the depth and breadth of the information received.
*   Consume content in multiple ways, including listening.

## What Gemini Topic Streamer Does

This application empowers users to:

1.  **Create "Topic Streams":** Define specific areas of interest with a descriptive name and a detailed "focus prompt" that guides the AI.
2.  **Select AI Model:** Choose from available Gemini models (e.g., `gemini-2.5-flash-preview-04-17`, `gemini-2.5-flash-preview-05-20`, `gemini-2.5-pro-preview-05-06`, `gemini-2.5-pro-preview-06-05`) for each stream, allowing for different balances of speed, cost, and capability.
3.  **Generate Rich Updates:** Request new updates for a stream at any time. The selected Gemini API model, with Google Search grounding, fetches, processes, and synthesizes relevant information.
4.  **Listen to Updates:** Generate and play Text-to-Speech (TTS) audio for stream updates, with controls for play/pause, seek, speed adjustment, stop, and audio export (WAV).
5.  **Control Information Flow:**
    *   **Detail Level:** Choose between 'brief', 'comprehensive', or 'research' level reports.
    *   **Contextual Awareness (Stream Updates):** Opt for fresh updates ('none'), or instruct the AI to consider the last stream update ('last') or all previous stream updates ('all') to build upon existing knowledge and avoid redundancy.
    *   **Pinned Chat Context:** Manually pin important messages from "Deep Dive" chat sessions. These pinned messages are included in the prompt for new stream updates *only if* the stream's `contextPreference` (for past stream updates) is set to 'last' or 'all'.
    *   **Model Parameters:** Fine-tune Temperature, Top-K, Top-P, and Seed.
    *   **Reasoning Control (`reasoningMode`):**
        *   **Off:** No specific reasoning/thinking process is requested from the model beyond standard generation.
        *   **Request:** The model is prompted to use `<think>...</think>` tags to expose its reasoning process.
            *   For models that officially support `thinkingConfig` (e.g., `gemini-2.5-flash-preview-04-17`), this is **"Recommended"**. The user can then set a "Thinking Token Budget" (Auto, Off, or a specific number) which adjusts the `thinkingConfig` API parameter. If "Auto", the model's default budget is used. If "Off", `thinkingBudget: 0` is sent.
            *   For models that do *not* officially support `thinkingConfig`, this is **"Experimental"**. The prompt for `<think>` tags is still sent, but the `thinkingConfig` API parameter is omitted. The model *may* provide reasoning at its discretion. The "Thinking Token Budget" UI is still available but has no effect on the API call for these models.
6.  **Consume Content Efficiently:** Updates are presented in clean, readable Markdown format, and can also be listened to.
7.  **Explore Further with "Deep Dive" Chat:** Engage in a contextual chat session based on any specific stream update to ask follow-up questions or clarify details. This chat also uses Google Search grounding.
8.  **Manage & Organize:**
    *   View streams in a detailed list or a summarized grid view.
    *   Edit, delete, and reorder streams.
    *   Export individual updates or entire streams in various formats (TXT, MD, CSV), including audio for individual updates.
    *   Export and import all application data (JSON backup).

## How It Works

1.  **Stream Definition:** The user creates a stream, providing a name, a focus prompt, and selecting a desired Gemini model and other parameters like `reasoningMode`.
2.  **API Interaction (Content):** When an update is requested, the application constructs a detailed prompt for the Gemini API. This prompt includes:
    *   The stream's name and focus.
    *   The selected `modelName` for the stream.
    *   Instructions for the desired detail level and Markdown formatting.
    *   System instructions for the AI's role.
    *   **Conditionally, User-Pinned Chat Context:** If `stream.contextPreference` is 'last' or 'all', any chat messages pinned by the user for this stream are included.
    *   Optionally, the content of previous *stream updates* (based on `stream.contextPreference`).
    *   Configuration for `temperature`, `topK`, `topP`, `seed`.
    *   **Reasoning Instructions:** If `reasoningMode` is 'request', the prompt includes instructions for the model to use `<think>...</think>` tags.
    *   **Conditional `thinkingConfig`:** If the selected model officially supports `thinkingConfig` and `reasoningMode` is 'request', the `thinkingConfig` (with `thinkingBudget`) is added to the API call based on user settings (Auto/Manual/Off). If `reasoningMode` is 'off' (and model supports it), `thinkingBudget: 0` is sent. If the model does not support `thinkingConfig`, this parameter is omitted.
    *   Crucially, it enables `googleSearch` for grounding.
3.  **Content Generation & Grounding:** The selected Gemini API model processes the prompt, performs Google searches, and generates the update.
4.  **Text-to-Speech (TTS):** For any stream update, users can request audio generation using the `gemini-2.5-flash-preview-tts` model.
5.  **Response Processing:** The application receives the AI's response, including main content, optional reasoning (if `<think>` tags are used), and grounding metadata.
6.  **Display & Interaction:** The update is rendered. Users can read, listen, export, or "Deep Dive" with chat.

## Unique Differentiators

*   **Model Choice:** Users can select different Gemini models per stream, including `gemini-2.5-flash-preview-04-17`, `gemini-2.5-flash-preview-05-20`, `gemini-2.5-pro-preview-05-06`, and `gemini-2.5-pro-preview-06-05`.
*   **Proactive & Curated Information Flow:** Builds a narrative on topics over time.
*   **Multi-Modal Consumption:** Read Markdown or listen via TTS.
*   **Depth, Synthesis & Structure:** Produces in-depth, structured reports.
*   **Evolving Contextual Understanding:** Focuses on novel information, with explicit control over past stream update context and conditional pinned chat context.
*   **Transparent AI Reasoning:** User-controlled `reasoningMode` ('off'/'request'). UI distinguishes between officially supported ("Recommended") thinking features and "Experimental" attempts on other models.
*   **Focused Exploration with Contextual Chat:** Targeted follow-up on updates with search grounding.
*   **Data Ownership & Portability:** Local storage and comprehensive export.
*   **Customization:** Extensive control over detail, context, model parameters, and reasoning requests.

## Key Features

*   **Stream Creation & Management.**
*   **Selectable AI Models per Stream.**
*   **Customizable Update Generation:** Detail Level, Context settings (for stream updates & pinned chat), Temperature, `reasoningMode` ('off'/'request'), Thinking Token Budget (conditional on model support and `reasoningMode`), Top-K, Top-P, Seed.
*   **Text-to-Speech (TTS) with Playback Controls & Export.**
*   **Rich Markdown Rendering.**
*   **Google Search Grounding (for stream updates and chat).**
*   **"Deep Dive" Chat with Pinning Functionality.**
*   **Data Export & Import (JSON, TXT, MD, CSV, WAV).**
*   **Multiple Views (List & Grid).**
*   **Responsive Design.**
*   **Local Storage (IndexedDB).**
*   **API Key Management.**

## Getting Started

1.  **API Key:** Ensure `API_KEY` environment variable is set or provide one via the UI.
2.  **Access:** Open `index.html`.
3.  **Create a Stream:**
    *   Provide Name, Focus Prompt (use "Optimize Focus").
    *   **Select an AI Model.**
    *   Adjust Temperature, Detail Level, Context, `reasoningMode`, and other advanced parameters as needed.
4.  **Fetch Updates & Explore.**

## Technology Stack

*   **Frontend:** React, TypeScript
*   **AI:** Google Gemini API (`@google/genai` SDK). Models:
    *   Content: `gemini-2.5-flash-preview-04-17`, `gemini-2.5-flash-preview-05-20`, `gemini-2.5-pro-preview-05-06`, `gemini-2.5-pro-preview-06-05` (selectable)
    *   TTS: `gemini-2.5-flash-preview-tts`
*   **Styling:** Tailwind CSS
*   **Markdown:** `react-markdown`, `remark-gfm`
*   **Audio:** Web Audio API
*   **Data Persistence:** IndexedDB (`idb` library)
*   **Utilities:** JSZip

---

Gemini Topic Streamer aims to transform information gathering into proactive, intelligent, and continuous learning.
