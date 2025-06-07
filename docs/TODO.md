# TODO List & Project Tracking: Gemini Topic Streamer

This document tracks the development process, outstanding tasks, potential issues, and future improvements for the Gemini Topic Streamer application.

## 1. Pre-Build / Initial Setup (Inferred)

This section outlines the assumed steps taken to reach the state *before* the recent major overhaul of reasoning controls and model list update. This is for understanding the project's foundation leading up to those changes.

*   **Environment Setup:**
    *   [x] Node.js and npm/yarn installed.
    *   [x] Basic project directory structure created.
*   **Project Initialization:**
    *   [x] `npm init` (or similar) to create `package.json`.
    *   [x] Git repository initialized.
*   **Core Dependencies Installation:**
    *   [x] React & ReactDOM: `npm install react react-dom`
    *   [x] TypeScript: `npm install typescript @types/react @types/react-dom --save-dev`
    *   [x] `@google/genai`: `npm install @google/genai`
    *   [x] `react-markdown` & `remark-gfm`: `npm install react-markdown remark-gfm`
    *   [x] `jszip`: `npm install jszip`
    *   [x] `idb`: `npm install idb`
*   **TypeScript Configuration:**
    *   [x] `npx tsc --init` to create `tsconfig.json`.
    *   [x] Configuration for JSX, ESNext modules, DOM, etc.
*   **HTML Structure:**
    *   [x] `index.html` created with:
        *   Basic HTML5 boilerplate.
        *   CDN link for Tailwind CSS.
        *   Import map for ES module resolution (React, `@google/genai`, etc.).
        *   Root div (`<div id="root"></div>`).
        *   Script tag to load `index.tsx` as a module.
*   **Application Entry Point:**
    *   [x] `index.tsx` created to:
        *   Import React, ReactDOM.
        *   Import the main `App` component.
        *   Render the `App` component into the root div.
*   **Core Application Structure:**
    *   [x] `App.tsx` component created as the main application shell.
    *   [x] Initial state management for streams and updates.
    *   [x] Basic layout components (e.g., Sidebar, Main View).
    *   [x] Initial `constants.ts` including `AVAILABLE_MODELS` like:
        ```typescript
        // export const AVAILABLE_MODELS = [
        //   { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash (04-17)", supportsThinkingConfig: true, default: true },
        //   { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash (05-20)", supportsThinkingConfig: false, default: false },
        //   { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro (05-06)", supportsThinkingConfig: false, default: false },
        // ] as const;
        ```
    *   [x] Initial `types.ts` including `Stream` interface with `enableReasoning: boolean;`.
    *   [x] Initial `constants.ts` including `DEFAULT_ENABLE_REASONING = true;`.
*   **API Key Management:**
    *   [x] Decision to use `process.env.API_KEY` with user override via UI.
    *   [x] Logic to handle API key availability client-side.
*   **Styling:**
    *   [x] Initial Tailwind CSS classes applied for basic layout and theming.
    *   [x] Custom global styles in `index.html` for scrollbars and Markdown.
*   **Initial Feature Prototyping (Includes TTS, Chat, Reasoning):**
    *   [x] Stream creation form/modal.
    *   [x] API call logic to `fetchStreamUpdates`.
    *   [x] Displaying stream updates.
    *   [x] IndexedDB persistence for streams and updates.
    *   [x] Text-to-Speech (TTS) integration for reading updates.
    *   [x] Chat functionality for "Deep Dive" with Google Search grounding.
    *   [x] Pinning chat messages.
    *   [x] Initial "Enable Reasoning" toggle (`enableReasoning: boolean`) and associated logic for `thinkingConfig` based on model support.

## 2. Future TODOs / Enhancements

### Core Functionality
*   [ ] **Advanced Stream Update Prompts:**
    *   [ ] Allow negative prompts (e.g., "don't include information about X").
    *   [ ] Option for user to specify preferred sources or types of sources.
*   [ ] **Stream Update Scheduling (Client-Side PoC):**
    *   [ ] Allow users to set a refresh interval (e.g., daily, weekly) per stream.
    *   [ ] Use browser mechanisms for "best-effort" client-side scheduling.
*   [ ] **Improved Context Management:**
    *   [ ] More granular context selection (e.g., pick specific past updates).
    *   [ ] Summarization of "all previous context" if it becomes too large to send directly.
*   [ ] **Smart Update Diffing:**
    *   [ ] (Complex) Attempt to highlight *new* information within an update compared to the immediate previous one.
*   [ ] **Token Usage Optimization:**
    *   [ ] Provide clearer warnings if a prompt/context combination is likely to exceed model limits.
    *   [ ] Explore techniques to condense context for the "all updates" option.

### UI/UX
*   [ ] **Advanced TTS Controls:**
    *   [ ] Dynamic voice selection from a predefined list.
    *   [ ] More prominent visual feedback for TTS audio buffering/loading state.
    *   [ ] Persist user's preferred playback speed across sessions and streams.
*   [ ] **Theming:**
    *   [ ] Allow users to choose between a few predefined themes.
    *   [ ] Font selection options.
*   [ ] **Enhanced Loading/Empty States:**
    *   [ ] More engaging skeletons or loading indicators.
*   [ ] **Animations & Transitions:**
    *   [ ] Subtle animations for modal dialogs, sidebar transitions, card appearances.
*   [ ] **Keyboard Navigation:**
    *   [ ] Improve keyboard accessibility for all interactive elements.
*   [ ] **Stream Grouping/Tagging:**
    *   [ ] Allow users to organize streams into folders or apply tags.
*   [ ] **Update Versioning/History:**
    *   [ ] If an update is manually refreshed with different parameters, keep a history or allow rollback.
*   [ ] **Better Error Display:**
    *   [ ] Use toasts or non-modal notifications for non-critical errors.
*   [ ] **Focus Prompt Templates:**
    *   [ ] Offer a library of pre-defined focus prompt templates.
*   [ ] **Per-Stream Update Display Density:** Control initial visibility of update content.
*   [ ] **Bulk Actions:** Select multiple streams/updates for deletion or export.
*   [ ] **Refine "Experimental" Reasoning UI:** Further clarify for users what "Experimental" reasoning means for models that don't officially support `thinkingConfig` (e.g., more descriptive tooltips).

### Data Management & Export/Import
*   [ ] **More Export Formats:**
    *   [ ] Export to OPML (for RSS readers).
    *   [ ] Export to PDF (client-side generation).
*   [ ] **TTS Data Management:**
    *   [ ] Option to batch-generate TTS for all unread/new updates.
    *   [ ] Client-side caching of generated TTS audio.
*   [ ] **Selective Import:** Allow merging imported data or choosing specific streams.
*   [ ] **Local Storage Quota Management:**
    *   [ ] Warn users if they are approaching browser storage limits.
    *   [ ] Offer options to clear older updates or cached TTS audio.

### Backend & Advanced Features (Requires Server-Side Component)
*   [ ] **User Accounts & Cloud Sync.**
*   [ ] **Reliable Update Scheduling.**
*   [ ] **Shared Streams.**
*   [ ] **Collaboration.**
*   [ ] **Server-Side TTS Caching.**

### Technical & Development
*   [ ] **Comprehensive Testing:**
    *   [ ] Unit tests for utility functions and components, including the new reasoning logic and display.
    *   [ ] Integration tests for user flows.
*   [ ] **CI/CD Pipeline.**
*   [ ] **Performance Optimization.**
*   [ ] **Accessibility (A11y) Audit & Improvements.**
*   [ ] **Internationalization (i18n).**
*   [ ] **Code Refactoring & Documentation:**
    *   [ ] Regularly review and refactor code.
    *   [ ] Improve inline code comments and update documentation.
*   [ ] **State Management Review:** Consider Zustand or Redux Toolkit if complexity grows.

## 3. Issue Tracking / Design Changes

| ID  | Type    | Description                                                                                                                                    | Status      | Assigned To | Notes                                                                                                                                                                                                |
|-----|---------|------------------------------------------------------------------------------------------------------------------------------------------------|-------------|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| #001| Minor   | Example: Grid view card text overflows on X screen                                                                                               | Open        | Dev Team    | Occurs when stream name is excessively long                                                                                                                                                            |
| #002| Medium  | Stream deletion in Sidebar was unreliable due to `window.confirm`.                                                                               | Resolved    | Dev Team    | Removed `window.confirm` from delete flow. Deletion is now immediate (Sidebar.tsx).                                                                                                                    |
| #003| Design  | Pinned chat messages were always included in stream update context. Changed to be conditional based on stream's `contextPreference` ('last'/'all'). | Resolved    | Dev Team    | This makes the pinned chat context behavior consistent with how stream update context is handled. If stream context is 'none', pinned chats are also excluded. Implemented in `services/geminiService.ts`. |
| #004| UX      | Pinned chat messages not consistently visible in chat when starting a new "Deep Dive".                                                         | Resolved    | Dev Team    | Adjusted `StreamView.tsx` (`handleStartDeepDiveChat`) to always prepend pinned messages to the chat display when a new deep dive session for an update is initiated. Ensures they are visible for review. |
| #005| Design  | **Reasoning Control Overhaul.** Replaced `enableReasoning: boolean` with `reasoningMode: 'off' | 'request'`. UI updated with two-state button ("Off", "Request") and conditional "Thinking Token Budget" slider. System now distinguishes between models that officially support `thinkingConfig` vs. those where reasoning is experimental. | Resolved    | Dev Team    | Implemented via recent "Build Guide". Affects `types.ts`, `constants.ts`, `services/geminiService.ts`, `App.tsx`, `components/EditStreamModal.tsx`, `components/StreamView.tsx`, `components/StreamGridCard.tsx`. |
| #006| Feature | **Model Addition.** Added `gemini-2.5-pro-preview-06-05` model (with `supportsThinkingConfig: false`).                                            | Resolved    | Dev Team    | Implemented via recent "Build Guide". Added to `constants.ts`. UI allows selection.                                                                                                                       |

## 4. Troubleshooting Performed

*Use this section to document troubleshooting steps taken for recurring or complex issues.*

*   **Issue:** API Key not detected / Updates fail with "API Key not configured".
    *   **Steps:**
        1.  Verified `process.env.API_KEY` access pattern in `geminiService.ts`.
        2.  Confirmed `apiKeyAvailable` state logic in `App.tsx`.
        3.  Checked console for warnings related to API key.
        4.  *Resolution/Guidance:* Remind user that `API_KEY` must be set in the *execution environment*. Client-side code cannot directly access system env vars without a build step or server. The app also supports user-provided keys via the UI.
*   **Issue:** Data import or stream update deletion confirmation dialogs not appearing or causing issues in sandboxed environments.
    *   **Steps:**
        1.  Identified `window.confirm` as a potential source of conflict in restricted iframes.
        2.  Reviewed instances of `window.confirm`.
        3.  *Resolution/Guidance:* For the sandboxed environment, `window.confirm` calls were bypassed. For stream deletion, `window.confirm` was removed entirely. For other critical confirmations, a custom modal solution is preferred.

## 5. Next Steps (Immediate Focus)

*   [ ] **Testing:** Thoroughly test the new reasoning controls across different models, especially the "experimental" path for models not officially supporting `thinkingConfig`.
*   [ ] **User Feedback:** If possible, gather feedback on the clarity and usability of the new reasoning controls.
*   [ ] **Documentation:** Ensure all user-facing documentation (like `README.md`) clearly explains the new reasoning system. (This task, being addressed now).
*   [ ] **Prioritize:** Select 1-2 high-impact UI/UX improvements from the TODO list (e.g., advanced TTS controls, theming).
*   [ ] **Technical Debt:** Start implementing basic unit tests for key utility functions and the reasoning logic in `geminiService.ts`.

