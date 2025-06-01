
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
2.  **Generate Rich Updates:** Request new updates for a stream at any time. The Gemini API, with Google Search grounding, fetches, processes, and synthesizes relevant information.
3.  **Listen to Updates:** Generate and play Text-to-Speech (TTS) audio for stream updates, with controls for play/pause, seek, speed adjustment, stop, and audio export (WAV).
4.  **Control Information Flow:**
    *   **Detail Level:** Choose between 'brief', 'comprehensive', or 'research' level reports (approx. 1k, 5k, 10k words respectively).
    *   **Contextual Awareness:** Opt for fresh updates, or instruct the AI to consider the last update or all previous updates to build upon existing knowledge and avoid redundancy.
    *   **Model Parameters:** Fine-tune Temperature, Top-K, Top-P, and Seed for nuanced control over the AI's output.
    *   **Reasoning Transparency:** For 'research' level, enable "thinking" to see the AI's underlying thought process and how it arrived at the information presented. This can be set to an automatic budget or a specific token budget.
5.  **Consume Content Efficiently:** Updates are presented in clean, readable Markdown format, and can also be listened to.
6.  **Explore Further with "Deep Dive" Chat:** Engage in a contextual chat session based on any specific stream update to ask follow-up questions or clarify details.
7.  **Manage & Organize:**
    *   View streams in a detailed list or a summarized grid view.
    *   Edit, delete, and reorder streams.
    *   Export individual updates or entire streams in various formats (TXT, MD, CSV), including audio for individual updates.
    *   Export and import all application data (JSON backup).

## How It Works

1.  **Stream Definition:** The user creates a stream, providing a name (e.g., "Advances in Quantum Computing") and a focus prompt (e.g., "Provide an update on recent breakthroughs, key research papers, notable company announcements, and expert opinions regarding quantum computing hardware, algorithms, and potential applications. Focus on developments in the last 1-3 months.").
2.  **API Interaction (Content):** When an update is requested, the application constructs a detailed prompt for the Gemini API. This prompt includes:
    *   The stream's name and focus.
    *   Instructions for the desired detail level and Markdown formatting.
    *   System instructions for the AI's role.
    *   Optionally, the content of previous updates (based on context preference) to guide the generation of *new* information.
    *   Configuration for `temperature`, `topK`, `topP`, `seed`, and `thinkingConfig`. The `thinkingConfig` is used to manage the AI's reasoning process: it can be effectively disabled (e.g., by setting `enableReasoning: false` in the stream's configuration or by using a zero token budget), set to allow the model to automatically determine its thinking budget (default behavior when reasoning is enabled), or manually set to a specific token budget if desired.
    *   Crucially, it enables `googleSearch` for grounding, ensuring information is current and verifiable.
3.  **Content Generation & Grounding:** The Gemini API processes the prompt, performs Google searches for relevant, up-to-date information, and generates the update.
4.  **Text-to-Speech (TTS):** For any stream update, users can request audio generation. The application sends the update's text content (after stripping Markdown) to the Gemini TTS API (`gemini-2.5-flash-preview-tts` model). The API returns base64 encoded PCM audio data. This data is decoded client-side into a playable audio buffer, offering controls like play, pause, stop, seek, playback speed adjustment, and WAV export.
5.  **Response Processing:** The application receives the AI's response:
    *   The main content in Markdown.
    *   Optionally, the AI's `<think>...</think>` blocks (reasoning process), which are separated and can be viewed.
    *   Grounding metadata (source URLs and titles from Google Search), which are displayed as citations.
6.  **Display & Interaction:** The update is rendered as Markdown. Users can then read, listen (with TTS controls), export, or initiate a "Deep Dive" chat session, where the selected update's content provides the initial context for the conversation with Gemini.

## Unique Differentiators

Gemini Topic Streamer stands apart from standard web search and general AI chat tools:

*   **Proactive & Curated Information Flow:** Instead of reactively searching for information snippet by snippet, users define a topic, and the app proactively generates comprehensive, curated updates *on that topic* over time. It builds a narrative.
*   **Multi-Modal Consumption:** Read visually rich Markdown or listen to updates via integrated Text-to-Speech.
*   **Depth, Synthesis & Structure:** It's designed to produce in-depth, synthesized reports, not just a list of links or short answers. The Markdown output is well-structured for readability and comprehension. Users control the desired depth.
*   **Evolving Contextual Understanding:** The ability to feed previous updates back into the AI for new requests allows the stream to "learn" what has already been covered, focusing on novel information and building a richer, more coherent knowledge base over time.
*   **Transparent AI Reasoning:** The optional "thinking" feature for research-level streams offers a look into the AI's process, enhancing trust and understanding.
*   **Focused Exploration with Contextual Chat:** The "Deep Dive" chat is not a general chat; it's anchored to the specific content of an update, allowing for targeted follow-up questions and deeper analysis of the presented material.
*   **Data Ownership & Portability:** All data is stored locally in the browser. Comprehensive export options (JSON, TXT, MD, CSV, WAV for TTS) ensure users own their data and can use it in other tools.
*   **Customization for Specific Needs:** Extensive control over detail level, context, and model parameters allows users to tailor the information stream to their precise requirements, whether for quick summaries or deep research.

## Key Features

*   **Stream Creation & Management:** Add, edit, delete, and reorder topic streams.
*   **Customizable Update Generation:**
    *   Three levels of detail: Brief, Comprehensive, Research.
    *   Context preferences: None, Last Update, All Updates.
    *   Adjustable model temperature.
    *   Control over model reasoning (enable/disable thinking).
    *   Configurable "Thinking Token Budget" (auto or manual).
    *   Advanced parameters: Top-K, Top-P, Seed.
*   **Text-to-Speech (TTS):** Convert stream updates to audio with playback controls (play, pause, stop, seek, speed control, progress bar) and export generated audio as WAV.
*   **Rich Markdown Rendering:** Cleanly displays AI-generated content, including tables, lists, code blocks, etc.
*   **Google Search Grounding:** Updates are backed by Google Search, with sources cited.
*   **"Deep Dive" Chat:** Contextual AI chat based on individual stream updates.
*   **Data Export & Import:**
    *   Export individual updates (TXT, MD, CSV, WAV for audio).
    *   Export entire streams (TXT, MD, CSV).
    *   Export/Import all application data (JSON).
*   **Multiple Views:**
    *   **List View:** Detailed view of a selected stream's updates.
    *   **Grid View:** Overview of multiple streams, each with its latest summaries.
*   **Responsive Design:** Usable across various screen sizes.
*   **Local Storage:** All data saved in the browser for privacy and offline access (once loaded).
*   **API Key Status:** Indicates if the Gemini API key is configured.

## Getting Started

1.  **API Key:** Ensure the `API_KEY` environment variable is correctly set up in your execution environment. The application relies on this to communicate with the Gemini API for both content generation and Text-to-Speech.
2.  Install dependencies: npm install
3.  **Create a Stream:** Click the "+" icon in the sidebar (List View) or the "Add New Stream" button in the header (if no streams exist or from EditStreamModal).
    *   Give your stream a descriptive **Name**.
    *   Write a clear and detailed **Focus/Prompt Details** to guide the AI. Use the "Optimize Focus" button to let Gemini refine your prompt.
    *   Adjust other parameters like **Temperature**, **Detail Level**, **Context Preference**, and **Reasoning/Thinking Budget** as needed.
4.  **Fetch Updates:** Once a stream is created (or selected), click the "Refresh" icon to fetch the initial update.
5.  **Explore & Listen:**
    *   Read the updates in Markdown.
    *   Click the "Read" button on an update card to generate and play audio. Use the controls to play/pause, seek, adjust speed, or stop.
    *   Deep dive with chat, adjust settings, and create more streams!

## Technology Stack

*   **Frontend:** React, TypeScript
*   **AI:** Google Gemini API (`@google/genai` SDK) for content (`gemini-2.5-flash-preview-04-17`) and Text-to-Speech (`gemini-2.5-flash-preview-tts`).
*   **Styling:** Tailwind CSS (via CDN)
*   **Markdown:** `react-markdown` with `remark-gfm`
*   **Audio:** Web Audio API for TTS playback and manipulation.
*   **Utilities:** JSZip (for CSV export)

---

Gemini Topic Streamer aims to transform how users gather and synthesize information on topics they care about, moving from reactive searching to proactive, intelligent, and continuous learning, with flexible consumption options.
