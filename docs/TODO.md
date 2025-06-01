
# TODO List & Project Tracking: Gemini Topic Streamer

This document tracks the development process, outstanding tasks, potential issues, and future improvements for the Gemini Topic Streamer application.

## 1. Pre-Build / Initial Setup (Inferred)

This section outlines the assumed steps taken before the application's current state was achieved. This is for understanding the project's foundation.

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
    *   [x] Initial state management for streams and updates (likely started with simple `useState`).
    *   [x] Basic layout components (e.g., Sidebar, Main View).
*   **API Key Management:**
    *   [x] Decision to use `process.env.API_KEY`.
    *   [x] Logic to handle API key availability client-side (for warnings/disabling features, though the actual key value comes from the environment where the code is run).
*   **Styling:**
    *   [x] Initial Tailwind CSS classes applied for basic layout and theming.
    *   [x] Custom global styles in `index.html` for scrollbars and Markdown.
*   **Initial Feature Prototyping (Includes TTS):**
    *   [x] Stream creation form/modal.
    *   [x] API call logic to `fetchStreamUpdates`.
    *   [x] Displaying stream updates.
    *   [x] Local storage persistence for streams and updates.
    *   [x] Text-to-Speech (TTS) integration for reading updates, including playback controls (play/pause, stop, seek, speed) and audio export.

## 2. Future TODOs / Enhancements

### Core Functionality
*   [ ] **Advanced Stream Update Prompts:**
    *   [ ] Allow negative prompts (e.g., "don't include information about X").
    *   [ ] Option for user to specify preferred sources or types of sources.
*   [ ] **Stream Update Scheduling (Client-Side PoC):**
    *   [ ] Allow users to set a refresh interval (e.g., daily, weekly) per stream.
    *   [ ] Use browser mechanisms (e.g., `setTimeout` with logic to persist across sessions, or `requestIdleCallback`) for "best-effort" client-side scheduling. *Note: True reliable scheduling needs a backend.*
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
    *   [ ] Dynamic voice selection from a predefined list (if Gemini TTS API offers more named voices easily accessible and client-side implementation is feasible).
    *   [ ] More prominent visual feedback for TTS audio buffering/loading state.
    *   [ ] Persist user's preferred playback speed across sessions and streams.
*   [ ] **Theming:**
    *   [ ] Allow users to choose between a few predefined themes (e.g., light mode, alternative dark modes).
    *   [ ] Font selection options.
*   [ ] **Enhanced Loading/Empty States:**
    *   [ ] More engaging skeletons or loading indicators for initial page load and stream fetching.
*   [ ] **Animations & Transitions:**
    *   [ ] Subtle animations for modal dialogs, sidebar transitions, card appearances.
*   [ ] **Keyboard Navigation:**
    *   [ ] Improve keyboard accessibility for all interactive elements, including TTS controls.
*   [ ] **Stream Grouping/Tagging:**
    *   [ ] Allow users to organize streams into folders or apply tags for better management.
*   [ ] **Update Versioning/History:**
    *   [ ] If an update is manually refreshed with different parameters, keep a history or allow rollback.
*   [ ] **Better Error Display:**
    *   [ ] Use toasts or non-modal notifications for non-critical errors.
*   [ ] **Focus Prompt Templates:**
    *   [ ] Offer a library of pre-defined focus prompt templates for common use cases (e.g., "Track a new technology", "Monitor a company", "Research a historical event").
*   [ ] **Per-Stream Update Display Density:** Allow users to choose how much of each update is initially visible in the stream view (e.g., title only, first paragraph, full).
*   [ ] **Bulk Actions:** Select multiple streams/updates for deletion or export.

### Data Management & Export/Import
*   [ ] **More Export Formats:**
    *   [ ] Export to OPML (for RSS readers, if applicable to structure).
    *   [ ] Export to PDF (client-side generation).
*   [ ] **TTS Data Management:**
    *   [ ] Option to batch-generate TTS for all unread/new updates in a stream.
    *   [ ] Client-side caching of generated TTS audio (e.g., using IndexedDB) to avoid re-fetching and enable faster playback.
*   [ ] **Selective Import:** Allow merging imported data with existing data, or choosing specific streams to import.
*   [ ] **Local Storage Quota Management:**
    *   [ ] Warn users if they are approaching browser local storage limits.
    *   [ ] Offer options to clear older updates or cached TTS audio for specific streams.

### Backend & Advanced Features (Requires Server-Side Component)
*   [ ] **User Accounts & Cloud Sync:**
    *   [ ] Allow users to create accounts and sync their streams/updates/TTS preferences across devices.
*   [ ] **Reliable Update Scheduling:** Implement server-side cron jobs for fetching updates.
*   [ ] **Shared Streams:** Allow users to share read-only versions of their streams with others.
*   [ ] **Collaboration:** Allow multiple users to contribute to or manage a stream.
*   [ ] **Server-Side TTS Caching:** Cache generated TTS audio on the server to reduce API calls for popular content if shared.

### Technical & Development
*   [ ] **Comprehensive Testing:**
    *   [ ] Unit tests for utility functions (audioUtils, textUtils) and individual components.
    *   [ ] Integration tests for user flows (e.g., creating a stream, fetching an update, TTS playback).
*   [ ] **CI/CD Pipeline:**
    *   [ ] Automate testing and deployment (e.g., using GitHub Actions).
*   [ ] **Performance Optimization:**
    *   [ ] Analyze and optimize rendering performance for very large numbers of streams or updates.
    *   [ ] Virtualization for long lists of updates.
*   [ ] **Accessibility (A11y) Audit & Improvements:**
    *   [ ] Conduct a thorough accessibility review and implement ARIA attributes and other best practices more consistently.
*   [ ] **Internationalization (i18n):**
    *   [ ] Prepare the app for translation into other languages.
*   [ ] **Code Refactoring & Documentation:**
    *   [ ] Regularly review and refactor code for clarity and maintainability.
    *   [ ] Improve inline code comments and update documentation.
*   [ ] **State Management Review:** For larger scale, consider a more robust state management library (e.g., Zustand, Redux Toolkit) if `useState` and prop drilling become too complex.

## 3. Issue Tracking

*Use this section to log specific bugs or issues as they are discovered.*

| ID  | Severity | Description                                                      | Status      | Assigned To | Notes                                                                              |
|-----|----------|------------------------------------------------------------------|-------------|-------------|------------------------------------------------------------------------------------|
| #001| Minor    | Example: Grid view card text overflows on X screen                | Open        | Dev Team    | Occurs when stream name is excessively long                                        |
| #002| Medium   | Stream deletion in Sidebar was unreliable due to `window.confirm`. | Resolved    | Dev Team    | Removed `window.confirm` from delete flow. Deletion is now immediate (Sidebar.tsx). |
|     |          |                                                                  |             |             |                                                                                    |

## 4. Troubleshooting Performed

*Use this section to document troubleshooting steps taken for recurring or complex issues.*

*   **Issue:** API Key not detected / Updates fail with "API Key not configured".
    *   **Steps:**
        1.  Verified `process.env.API_KEY` access pattern in `geminiService.ts`.
        2.  Confirmed `apiKeyAvailable` state logic in `App.tsx`.
        3.  Checked console for warnings related to API key.
        4.  *Resolution/Guidance:* Remind user that `API_KEY` must be set in the *execution environment* (e.g., .env file if using a Node server, or system environment variables). Client-side code cannot directly access system env vars without a build step or server.
*   **Issue:** Data import or stream update deletion confirmation dialogs not appearing or causing issues in sandboxed environments.
    *   **Steps:**
        1.  Identified `window.confirm` as a potential source of conflict in restricted iframes.
        2.  Reviewed instances of `window.confirm` in `App.tsx` (for import) and `StreamUpdateCard.tsx` (for update deletion) and `Sidebar.tsx` (for stream deletion).
        3.  *Resolution/Guidance:* For the sandboxed environment, `window.confirm` calls were temporarily bypassed or behavior adjusted to proceed with the action to ensure core functionality could be tested. For stream deletion, the `window.confirm` was removed entirely for more consistent behavior. For other critical confirmations, a custom modal solution would be a more robust long-term fix if `window.confirm` remains problematic.

## 5. Next Steps (Immediate Focus)

*   [ ] **Prioritize:** Select 2-3 high-impact UI/UX improvements from the TODO list (e.g., TTS control refinement, theming options).
*   [ ] **User Feedback:** If possible, gather feedback from initial users on current functionality, including TTS.
*   [ ] **Testing:** Start implementing basic unit tests for key utility functions (e.g., `exportUtils.ts`, `textUtils.ts`, `audioUtils.ts`).
*   [ ] **Documentation:** Ensure `README.md` and `ROADMAP.md` are up-to-date with any immediate decisions and reflect recent changes.
