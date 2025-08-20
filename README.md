# Gemini Topic Streamer

**Gemini Topic Streamer** is a powerful, web-based application designed to help users create and maintain personalized, in-depth information feeds on specific topics. Leveraging the capabilities of Google's Gemini API, it acts like an intelligent, self-updating research assistant, providing comprehensive updates with search-backed grounding, a clear view of the AI's reasoning process if desired, and the ability to listen to content via Text-to-Speech or consume it as a fully generated podcast.

## The Challenge: Staying Deeply Informed

In today's fast-paced information landscape, staying truly informed about specific, evolving topics can be challenging. Standard web searches provide snapshots in time, and general AI chat tools, while versatile, often lack the continuous, focused depth required for ongoing research or specialized interest tracking. Users need a way to:

• Track developments on niche subjects comprehensively.
• Receive synthesized information rather than just lists of links.
• Understand how new information builds upon previous knowledge.
• Control the depth and breadth of the information received.
• Consume content in multiple ways, including listening to individual updates or full podcast episodes.

## What Gemini Topic Streamer Does

This application empowers users to:

1. **Create "Topic Streams":** Define specific areas of interest with a descriptive name and a detailed "focus prompt" that guides the AI.

2. **Select AI Model:** Choose from available Gemini models (e.g., `gemini-2.5-flash-preview-04-17`, `gemini-2.5-flash-preview-05-20`, `gemini-2.5-pro-preview-05-06`, `gemini-2.5-pro-preview-06-05`) for each stream, allowing for different balances of speed, cost, and capability.

   ![Edit Stream](https://github.com/para-droid-ai/Gemini-Topic-Streamer/blob/b0beed3d79f737db97669e54a73569a067414cd8/docs/edit_stream.png)
   
   **Edit/Create Stream Interface:** Define a new Topic Stream, set your focus prompt, detail level, and model—tailoring updates to your needs.

3. **Generate Rich Updates:** Request new updates for a stream at any time. The selected Gemini API model, with Google Search grounding, fetches, processes, and synthesizes relevant information.

4. **Listen to Updates:** Generate and play Text-to-Speech (TTS) audio for individual stream updates, with controls for play/pause, seek, speed adjustment, stop, and audio export (WAV). For lengthy updates, text is automatically chunked before TTS conversion to ensure reliability, and the resulting audio segments are seamlessly joined.

5. **Produce Podcasts in the "Studio":**
   
   • Select multiple source streams and specify the number of recent updates per stream.
   • Provide a podcast title and choose a TTS voice.
   
   ![Create Podcast](https://github.com/para-droid-ai/Gemini-Topic-Streamer/blob/b0beed3d79f737db97669e54a73569a067414cd8/docs/create_podcast_modal.png)
   
   **Podcast Studio – Create Interface:** Select streams and recent updates, then generate a podcast script and audio in just a few clicks.
   
   • The AI generates a cohesive podcast script, narrating and structuring the content from the selected streams.
   • An artistic title card image is automatically generated using Imagen 3.
   • The script is converted to audio using Gemini TTS. Similar to individual updates, large scripts are intelligently chunked for reliable audio generation and then stitched together.
   
   ![Podcast View](https://github.com/para-droid-ai/Gemini-Topic-Streamer/blob/b0beed3d79f737db97669e54a73569a067414cd8/docs/podcast_view.png)
   
   **Podcast Studio – Playback & Export:** Listen to generated podcast episodes, view transcripts, and export audio for sharing.
   
   • Manage, play (with progress bar and seeking), and export (WAV) generated podcasts. View podcast transcripts.

6. **Control Information Flow:**
   
   • **Detail Level:** Choose between 'brief', 'comprehensive', or 'research' level reports for stream updates.
   • **Contextual Awareness (Stream Updates):** Opt for fresh updates ('none'), or instruct the AI to consider the last stream update ('last') or all previous stream updates ('all') to build upon existing knowledge and avoid redundancy.
   • **Pinned Chat Context:** Manually pin important messages from "Deep Dive" chat sessions. These pinned messages are included in the prompt for new stream updates *only if* the stream's `contextPreference` (for past stream updates) is set to 'last' or 'all'.
   • **Model Parameters:** Fine-tune Temperature, Top-K, Top-P, and Seed for stream updates.
   • **Reasoning Control (`reasoningMode`):**
     ■ **Off:** The AI provides the direct answer without exposing its thinking steps.
     ■ **Request:** The AI is prompted to use `...` tags to outline its reasoning process before providing the main content. This is useful for transparency and understanding the AI's approach. The effectiveness of this mode can vary based on whether the selected Gemini model officially supports `thinkingConfig` (recommended) or if it's experimental for that model.

7. **Deep Dive Chat:** Engage in a conversational chat with the AI, specifically about the content of a particular stream update, with Google Search grounding for up-to-date answers.

8. **Markdown Formatting:** Updates are presented in a clean, readable Markdown format.

9. **Data Persistence:** Streams and their updates are saved locally in your browser using IndexedDB, allowing you to pick up where you left off.

10. **Export & Import:**
   
    • Export individual stream updates to TXT, MD, or CSV.
    • Export entire stream histories to TXT, MD, or CSV.
    • Export all application data (streams, updates, podcasts) to a single JSON backup file.
    • Import application data from a JSON backup file.

## Screenshots and Key Features

### Home Dashboard

The main dashboard provides a clean overview of all your topic streams, with options to create new streams, view recent updates, and access the podcast studio.

![Main Feed](https://github.com/para-droid-ai/Gemini-Topic-Streamer/blob/b0beed3d79f737db97669e54a73569a067414cd8/docs/main_feed_v2.png)

**Main Feed Dashboard:** Quickly view and manage all your active Topic Streams in a centralized dashboard.

### Stream Configuration

Detailed configuration options allow you to fine-tune each stream's behavior, including AI model selection, update frequency, detail level, and reasoning preferences.

### Podcast Studio

A dedicated workspace for creating audio content from your streams, with advanced TTS options and automatic script generation.

### Export and Data Management

Comprehensive tools for backing up your data, exporting content in multiple formats, and managing your information streams.

## Installation & Technical Stack

This is a client-side application built with:

• **React 18** with functional components and hooks.
• **TypeScript** for type safety and better development experience.
• **IndexedDB** (via `idb` library) for local data persistence.
• **Google Gemini API** for AI-powered content generation.
• **Web Audio API** and **Fetch API** for TTS functionality.
• **CSS3** with custom styling for a polished user interface.
• `react-markdown` & `remark-gfm` for Markdown rendering.
• `jszip` for CSV export packaging.
• `idb` for IndexedDB interactions.
• HTML5, CSS3, ES Modules

## Getting Started (Using Vercel for Testing)

The primary way to test and use the Gemini Topic Streamer is by deploying your own instance to Vercel. This allows you to use your own Google Gemini API key directly in the deployed application.

1. **Prerequisites:**
   
   • A [GitHub](https://github.com/) account.
   • A [Vercel](https://vercel.com/) account.
   • A Google Gemini API Key (you can get one from [Google AI Studio](https://aistudio.google.com/)).

2. **Fork the Repository:**
   
   • Go to the [Gemini Topic Streamer GitHub repository](https://github.com/your-username/gemini-topic-streamer) (replace with the actual link if you have one, or instruct users to find it).
   • Click the "Fork" button in the top-right corner to create a copy of the repository under your GitHub account.

3. **Deploy to Vercel:**
   
   • Log in to your Vercel dashboard.
   • Click "Add New..." and then "Project".
   • Under "Import Git Repository," select your forked `gemini-topic-streamer` repository.
   • Vercel should automatically detect that it's a React/TypeScript project. You generally don't need to change the default build and output settings.
     ■ Framework Preset: `Vite` (or it might auto-detect as Create React App if configuration matches that more closely, but Vite is generally a good default for modern React with TS).
     ■ Build Command: Usually `npm run build` or `vite build`.
     ■ Output Directory: `dist`.
   • Click "Deploy." Vercel will build and deploy your application.

4. **Using the Deployed Application:**
   
   • Once deployed, Vercel will provide you with a URL (e.g., `your-project-name.vercel.app`).
   • Open this URL in your browser.
   • The application will guide you to enter your Google Gemini API key via the UI (click the "API Key" button in the header). This key is stored locally in your browser and is necessary for the app to function.
   • You can now start creating streams, fetching updates, and exploring the features!

**Note on Local Development (for contributors):** If you intend to contribute to the development of Gemini Topic Streamer, you'll need a local development environment:

• Clone your forked repository.
• Ensure Node.js (LTS version recommended) and npm are installed.
• Install dependencies: `npm install`
• You'll need a way to serve the `index.html` and compile the TypeScript/JSX. A development server like **Vite** is recommended.
  • Install Vite: `npm install --save-dev vite @vitejs/plugin-react`
  • Create a `vite.config.ts` file (see Vite documentation for setup).
  • Update `package.json` scripts:
    ```
    "scripts": {
      "dev": "vite",
      "build": "tsc && vite build",
      "preview": "vite preview"
    }
    ```
  • Run the development server: `npm run dev`
• You will also need to manage your Gemini API Key for local development. The application attempts to use `process.env.API_KEY`. For client-side development with Vite, you'd typically set this in a `.env.local` file as `VITE_API_KEY=your_key_here` and access it in `geminiService.ts` via `import.meta.env.VITE_API_KEY`. The application's UI key management will override this if a key is entered there.

## Disclaimer

This application interacts with the Google Gemini API. Use of the API is subject to Google's terms of service and pricing. Ensure you have a valid API key and are aware of potential costs associated with its usage. The API key is stored locally in your browser and is not transmitted to any server other than Google's.

This project provides a robust foundation for deep topic exploration. Future enhancements are planned to further improve its capabilities and user experience. See the [ROADMAP.md](https://github.com/para-droid-ai/Gemini-Topic-Streamer/blob/main/docs/ROADMAP.md) and [TODO.md](https://github.com/para-droid-ai/Gemini-Topic-Streamer/blob/main/docs/TODO.md) for more details.
