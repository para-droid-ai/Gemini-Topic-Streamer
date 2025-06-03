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
2.  **Select AI Model:** Choose from available Gemini models (e.g., `gemini-2.5-flash-preview-04-17`, `gemini-2.5-flash-preview-05-20`, `gemini-2.5-pro-preview-05-06`) for each stream, allowing for different balances of speed, cost, and capability.
3.  **Generate Rich Updates:** Request new updates for a stream at any time. The selected Gemini API model, with Google Search grounding, fetches, processes, and synthesizes relevant information.
4.  **Listen to Updates:** Generate and play Text-to-Speech (TTS) audio for stream updates, with controls for play/pause, seek, speed adjustment, stop, and audio export (WAV).
5.  **Control Information Flow:**
    *   **Detail Level:** Choose between 'brief', 'comprehensive', or 'research' level reports (approx. 1k, 5k, 10k words respectively).
    *   **Contextual Awareness:** Opt for fresh updates, or instruct the AI to consider the last update or all previous updates to build upon existing knowledge and avoid redundancy.
    *   **Model Parameters:** Fine-tune Temperature, Top-K, Top-P, and Seed for nuanced control over the AI's output.
    *   **Reasoning Transparency:** For 'research' level and compatible models (currently `gemini-2.5-flash-preview-04-17`), enable "thinking" to see the AI's underlying thought process. This can be set to an automatic budget or a specific token budget. For other models, this setting is ignored.
6.  **Consume Content Efficiently:** Updates are presented in clean, readable Markdown format, and can also be listened to.
7.  **Explore Further with "Deep Dive" Chat:** Engage in a contextual chat session based on any specific stream update to ask follow-up questions or clarify details.
8.  **Manage & Organize:**
    *   View streams in a detailed list or a summarized grid view.
    *   Edit, delete, and reorder streams.
    *   Export individual updates or entire streams in various formats (TXT, MD, CSV), including audio for individual updates.
    *   Export and import all application data (JSON backup).

## How It Works

1.  **Stream Definition:** The user creates a stream, providing a name, a focus prompt, and selecting a desired Gemini model.
2.  **API Interaction (Content):** When an update is requested, the application constructs a detailed prompt for the Gemini API. This prompt includes:
    *   The stream's name and focus.
    *   The selected `modelName` for the stream.
    *   Instructions for the desired detail level and Markdown formatting.
    *   System instructions for the AI's role.
    *   Optionally, the content of previous updates (based on context preference).
    *   Configuration for `temperature`, `topK`, `topP`, `seed`.
    *   **Conditionally**, if the selected model is `gemini-2.5-flash-preview-04-17` and reasoning is enabled, `thinkingConfig` is included. For other models, `thinkingConfig` is omitted as per guidelines.
    *   Crucially, it enables `googleSearch` for grounding.
3.  **Content Generation & Grounding:** The selected Gemini API model processes the prompt, performs Google searches, and generates the update.
4.  **Text-to-Speech (TTS):** For any stream update, users can request audio generation using the `gemini-2.5-flash-preview-tts` model.
5.  **Response Processing:** The application receives the AI's response, including main content, optional reasoning (if applicable), and grounding metadata.
6.  **Display & Interaction:** The update is rendered. Users can read, listen, export, or "Deep Dive" with chat.

## Unique Differentiators

*   **Model Choice:** Users can select different Gemini models per stream.
*   **Proactive & Curated Information Flow:** Builds a narrative on topics over time.
*   **Multi-Modal Consumption:** Read Markdown or listen via TTS.
*   **Depth, Synthesis & Structure:** Produces in-depth, structured reports.
*   **Evolving Contextual Understanding:** Focuses on novel information.
*   **Transparent AI Reasoning (Conditional):** "Thinking" feature available for compatible models.
*   **Focused Exploration with Contextual Chat:** Targeted follow-up on updates.
*   **Data Ownership & Portability:** Local storage and comprehensive export.
*   **Customization:** Extensive control over detail, context, and model parameters.

## Key Features

*   **Stream Creation & Management.**
*   **Selectable AI Models per Stream.**
*   **Customizable Update Generation:** Detail Level, Context, Temperature, Reasoning (conditional), Thinking Budget (conditional), Top-K, Top-P, Seed.
*   **Text-to-Speech (TTS) with Playback Controls & Export.**
*   **Rich Markdown Rendering.**
*   **Google Search Grounding.**
*   **"Deep Dive" Chat.**
*   **Data Export & Import (JSON, TXT, MD, CSV, WAV).**
*   **Multiple Views (List & Grid).**
*   **Responsive Design.**
*   **Local Storage.**
*   **API Key Management.**

## Getting Started

1.  **API Key:** Ensure `API_KEY` environment variable is set.
2. TBD

## Technology Stack

*   **Frontend:** React, TypeScript
*   **AI:** Google Gemini API (`@google/genai` SDK). Models:
    *   Content: `gemini-2.5-flash-preview-04-17`, `gemini-2.5-flash-preview-05-20`, `gemini-2.5-pro-preview-05-06` (selectable)
    *   TTS: `gemini-2.5-flash-preview-tts`
*   **Styling:** Tailwind CSS
*   **Markdown:** `react-markdown`, `remark-gfm`
*   **Audio:** Web Audio API
*   **Utilities:** JSZip

---

Gemini Topic Streamer aims to transform information gathering into proactive, intelligent, and continuous learning.
