# Gemini Topic Streamer

**Gemini Topic Streamer** is a powerful, web-based application designed to help users create and maintain personalized, in-depth information feeds on specific topics. Leveraging the capabilities of Google's Gemini API, it acts like an intelligent, self-updating research assistant, providing comprehensive updates with search-backed grounding, a clear view of the AI's reasoning process if desired, and the ability to listen to content via Text-to-Speech or consume it as a fully generated podcast.

## The Challenge: Staying Deeply Informed

In today's fast-paced information landscape, staying truly informed about specific, evolving topics can be challenging. Standard web searches provide snapshots in time, and general AI chat tools, while versatile, often lack the continuous, focused depth required for ongoing research or specialized interest tracking. Users need a way to:

*   Track developments on niche subjects comprehensively.
*   Receive synthesized information rather than just lists of links.
*   Understand how new information builds upon previous knowledge.
*   Control the depth and breadth of the information received.
*   Consume content in multiple ways, including listening to individual updates or full podcast episodes.

## What Gemini Topic Streamer Does

This application empowers users to:

1.  **Create "Topic Streams":** Define specific areas of interest with a descriptive name and a detailed "focus prompt" that guides the AI.
2.  **Select AI Model:** Choose from available Gemini models (e.g., `gemini-2.5-flash-preview-04-17`, `gemini-2.5-flash-preview-05-20`, `gemini-2.5-pro-preview-05-06`, `gemini-2.5-pro-preview-06-05`) for each stream, allowing for different balances of speed, cost, and capability.
3.  **Generate Rich Updates:** Request new updates for a stream at any time. The selected Gemini API model, with Google Search grounding, fetches, processes, and synthesizes relevant information.
4.  **Listen to Updates:** Generate and play Text-to-Speech (TTS) audio for individual stream updates, with controls for play/pause, seek, speed adjustment, stop, and audio export (WAV). For lengthy updates, text is automatically chunked before TTS conversion to ensure reliability, and the resulting audio segments are seamlessly joined.
5.  **Produce Podcasts in the "Studio":**
    *   Select multiple source streams and specify the number of recent updates per stream.
    *   Provide a podcast title and choose a TTS voice.
    *   The AI generates a cohesive podcast script, narrating and structuring the content from the selected streams.
    *   An artistic title card image is automatically generated using Imagen 3.
    *   The script is converted to audio using Gemini TTS. Similar to individual updates, large scripts are intelligently chunked for reliable audio generation and then stitched together.
    *   Manage, play (with progress bar and seeking), and export (WAV) generated podcasts. View podcast transcripts.
6.  **Control Information Flow:**
    *   **Detail Level:** Choose between 'brief', 'comprehensive', or 'research' level reports for stream updates.
    *   **Contextual Awareness (Stream Updates):** Opt for fresh updates ('none'), or instruct the AI to consider the last stream update ('last') or all previous stream updates ('all') to build upon existing knowledge and avoid redundancy.
    *   **Pinned Chat Context:** Manually pin important messages from "Deep Dive" chat sessions. These pinned messages are included in the prompt for new stream updates *only if* the stream's `contextPreference` (for past stream updates) is set to 'last' or 'all'.
    *   **Model Parameters:** Fine-tune Temperature, Top-K, Top-P, and Seed for stream updates.
    *   **Reasoning Control (`reasoningMode`):**
        *   **Off:** The AI provides the direct answer without exposing its thinking steps.
        *   **Request:** The AI is prompted to use `<think>...</think>` tags to outline its reasoning process before providing the main content. This is useful for transparency and understanding the AI's approach. The effectiveness of this mode can vary based on whether the selected Gemini model officially supports `thinkingConfig` (recommended) or if it's experimental for that model.
7.  **Deep Dive Chat:** Engage in a conversational chat with the AI, specifically about the content of a particular stream update, with Google Search grounding for up-to-date answers.
8.  **Markdown Formatting:** Updates are presented in a clean, readable Markdown format.
9.  **Data Persistence:** Streams and their updates are saved locally in your browser using IndexedDB, allowing you to pick up where you left off.
10. **Export & Import:**
    *   Export individual stream updates to TXT, MD, or CSV.
    *   Export entire stream histories to TXT, MD, or CSV.
    *   Export all application data (streams, updates, podcasts) to a single JSON backup file.
    *   Import application data from a JSON backup file.
11. **API Key Management:** Users can provide and manage their own Google Gemini API key directly within the application. The key is stored securely in browser local storage.
12. **Customizable Viewing:**
    *   **List View:** Focused view of a single selected stream.
    *   **Grid View:** Overview of multiple streams, each in its own card, with pagination and options to maximize individual streams or expand all summaries.
    *   **Studio View:** Dedicated interface for creating, managing, and playing podcasts.
    *   **Collapsible Sidebar:** Maximize screen real estate for content.
13. **Optimized Focus Prompts:** An AI-powered feature to help refine your stream focus prompts for better results.

## How It Works (Core Stream Update Flow)

1.  The user creates a "Topic Stream" with a name (e.g., "Latest in Quantum Entanglement Research") and a "focus prompt" (e.g., "Provide a comprehensive update on recent breakthroughs, experiments, and theoretical advancements in quantum entanglement, including implications for quantum computing and communication. Cite key papers and research institutions.").
2.  The user selects a Gemini model, temperature, detail level, and context preference.
3.  When an update is requested:
    *   The application constructs a detailed prompt for the Gemini API, incorporating the stream's focus, selected parameters, and optionally, context from previous updates or pinned chat messages.
    *   If `reasoningMode` is 'request', specific instructions are added to prompt the model to expose its thinking process using `<think>` tags.
    *   The Gemini API (e.g., `gemini-2.5-flash-preview-04-17`) processes the prompt, using Google Search for grounding to ensure information is current.
    *   The response, formatted in Markdown and potentially including `<think>` blocks, is returned.
    *   The application parses the response, separating reasoning content from the main content.
    *   The new update (main content, reasoning, and grounding metadata) is displayed and saved to IndexedDB.
4.  Users can then read the update, view the reasoning, explore cited sources, engage in a "Deep Dive" chat, or generate TTS audio (which involves chunking for large texts).

## Unique Differentiators

*   **Focused, Continuous Tracking:** Unlike general search or one-off AI queries, it's designed for ongoing, in-depth monitoring of specific topics.
*   **Controllable Detail & Context:** Users can specify the desired level of detail and how much previous information the AI should consider.
*   **Transparent Reasoning (Optional):** The `<think>` tag exposure offers a unique look into the AI's process.
*   **Search-Grounded Information:** Ensures updates are based on current information from the web.
*   **Multi-Modal Consumption:** Read, listen to individual updates (with robust TTS for long content via chunking), or generate full podcast episodes in the Studio.
*   **Client-Side & Private:** All data (streams, updates, API key) is stored locally in the user's browser. No server-side accounts or data storage (beyond Gemini API interactions).
*   **Model Selection Flexibility:** Choose different Gemini models per stream to balance needs.

## Key Features

*   Create and manage multiple Topic Streams.
*   Selectable Gemini models per stream.
*   Adjustable Temperature, Detail Level, Context Preference, Top-K, Top-P, Seed per stream.
*   AI-generated, Markdown-formatted stream updates.
*   Google Search grounding for up-to-date information.
*   Optional display of AI's reasoning process.
*   "Deep Dive" chat about specific updates (with search grounding).
*   Pinning important chat messages for stream context.
*   List, Grid, and Studio view modes.
*   Stream and update export (TXT, MD, CSV).
*   Full application data backup (JSON) and import.
*   Text-to-Speech for stream updates with playback controls (play, pause, stop, seek, speed, export). Handles large updates by chunking text for reliable TTS generation.
*   **Podcast Studio:**
    *   Generate podcast scripts from stream content.
    *   Generate podcast title card images.
    *   Convert scripts to audio using Gemini TTS, intelligently chunking large scripts for robust processing.
    *   Manage, play, and export podcasts (WAV).
    *   View podcast transcripts.
*   User-managed API Key (stored in browser local storage).
*   Responsive design.
*   Data persistence via IndexedDB.

## Technologies Used

*   **React 19**
*   **TypeScript**
*   **@google/genai (Gemini API Client)**
*   Tailwind CSS (via CDN)
*   `react-markdown` & `remark-gfm` for Markdown rendering.
*   `jszip` for CSV export packaging.
*   `idb` for IndexedDB interactions.
*   HTML5, CSS3, ES Modules

## Getting Started (Using Vercel for Testing)

The primary way to test and use the Gemini Topic Streamer is by deploying your own instance to Vercel. This allows you to use your own Google Gemini API key directly in the deployed application.

1.  **Prerequisites:**
    *   A [GitHub](https://github.com/) account.
    *   A [Vercel](https://vercel.com/) account.
    *   A Google Gemini API Key (you can get one from [Google AI Studio](https://aistudio.google.com/)).

2.  **Fork the Repository:**
    *   Go to the [Gemini Topic Streamer GitHub repository](https://github.com/your-username/gemini-topic-streamer) (replace with the actual link if you have one, or instruct users to find it).
    *   Click the "Fork" button in the top-right corner to create a copy of the repository under your GitHub account.

3.  **Deploy to Vercel:**
    *   Log in to your Vercel dashboard.
    *   Click "Add New..." and then "Project".
    *   Under "Import Git Repository," select your forked `gemini-topic-streamer` repository.
    *   Vercel should automatically detect that it's a React/TypeScript project. You generally don't need to change the default build and output settings.
        *   Framework Preset: `Vite` (or it might auto-detect as Create React App if configuration matches that more closely, but Vite is generally a good default for modern React with TS).
        *   Build Command: Usually `npm run build` or `vite build`.
        *   Output Directory: `dist`.
    *   Click "Deploy." Vercel will build and deploy your application.

4.  **Using the Deployed Application:**
    *   Once deployed, Vercel will provide you with a URL (e.g., `your-project-name.vercel.app`).
    *   Open this URL in your browser.
    *   The application will guide you to enter your Google Gemini API key via the UI (click the "API Key" button in the header). This key is stored locally in your browser and is necessary for the app to function.
    *   You can now start creating streams, fetching updates, and exploring the features!

**Note on Local Development (for contributors):**
If you intend to contribute to the development of Gemini Topic Streamer, you'll need a local development environment:
*   Clone your forked repository.
*   Ensure Node.js (LTS version recommended) and npm are installed.
*   Install dependencies: `npm install`
*   You'll need a way to serve the `index.html` and compile the TypeScript/JSX. A development server like **Vite** is recommended.
    *   Install Vite: `npm install --save-dev vite @vitejs/plugin-react`
    *   Create a `vite.config.ts` file (see Vite documentation for setup).
    *   Update `package.json` scripts:
        ```json
        "scripts": {
          "dev": "vite",
          "build": "tsc && vite build",
          "preview": "vite preview"
        }
        ```
    *   Run the development server: `npm run dev`
*   You will also need to manage your Gemini API Key for local development. The application attempts to use `process.env.API_KEY`. For client-side development with Vite, you'd typically set this in a `.env.local` file as `VITE_API_KEY=your_key_here` and access it in `geminiService.ts` via `import.meta.env.VITE_API_KEY`. The application's UI key management will override this if a key is entered there.


## Disclaimer

This application interacts with the Google Gemini API. Use of the API is subject to Google's terms of service and pricing. Ensure you have a valid API key and are aware of potential costs associated with its usage. The API key is stored locally in your browser and is not transmitted to any server other than Google's.

---

This project provides a robust foundation for deep topic exploration. Future enhancements are planned to further improve its capabilities and user experience. See the [ROADMAP.md](docs/ROADMAP.md) and [TODO.md](docs/TODO.md) for more details.