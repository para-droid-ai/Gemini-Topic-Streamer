# Gemini Topic Streamer: Product Roadmap

## Vision

To establish Gemini Topic Streamer as a premier tool for individuals and teams seeking to deeply understand and continuously track evolving topics, transforming information overload into structured, actionable knowledge that can be consumed in multiple ways.

---

## Phase 1: Foundation & Core Experience (Current - Q3 2024)

**Goal:** Solidify the core functionality, enhance user experience, ensure robust data management, and refine the initial Text-to-Speech (TTS) implementation.

*   **UI/UX Refinements:**
    *   **Enhanced Visual Feedback:** Improve loading states, empty states, and transitions for a smoother experience.
    *   **Keyboard Navigation & Accessibility:** Conduct an initial review and implement improvements for better keyboard navigation and ARIA compliance, including for TTS controls.
    *   **Streamlined Modals:**
        *   [x] **Advanced Stream Configuration UI:** Made Top-K, Top-P, Seed settings more intuitive within the Edit Stream modal.
        *   [x] **Reasoning Controls:** Overhauled reasoning controls in "Edit Stream" modal with a clear "Off"/"Request" selection for `reasoningMode`. UI now indicates if model support for thinking is "Recommended" (official) or "Experimental". "Thinking Token Budget" slider is conditional.
    *   **Improved Error Handling:** More user-friendly error messages and notifications.
    *   **Refine TTS Controls:** Enhance the UI for TTS playback, including clearer status indication.
*   **Core Feature Enhancements:**
    *   **Model Options:**
        *   [x] Added `gemini-2.5-pro-preview-06-05` to the list of selectable models.
    *   **Focus Prompt Assistance:**
        *   Provide examples or templates for effective focus prompts.
        *   Refine the "Optimize Focus" feature for better results.
    *   **Conditional Pinned Chat Context:** Pinned chat messages are included in the prompt for new stream updates *only if* the stream's `contextPreference` for past stream updates is 'last' or 'all'.
    *   **Reasoning System:**
        *   [x] Replaced `enableReasoning: boolean` with `reasoningMode: 'off' | 'request'`.
        *   [x] API `thinkingConfig` parameter is applied if model supports it:
            *   If `reasoningMode` is 'off', `thinkingBudget: 0` is used.
            *   If `reasoningMode` is 'request', manual/auto budget logic applies, or model default if auto.
        *   [x] If model doesn't support `thinkingConfig`, this API parameter is omitted, but the prompt for `<think>` tags is still included if `reasoningMode` is 'request' (experimental).
    *   **Basic Client-Side Scheduling PoC:**
        *   Experiment with simple client-side timers for stream refresh reminders.
*   **Data Management:**
    *   **Local Storage Quota Warnings:** Alert users if they are approaching browser storage limits.
    *   **Selective Data Pruning:** Allow users to delete older updates from a stream.
*   **Technical Debt & Testing:**
    *   **Unit Testing:** Implement unit tests for critical utility functions and core service logic, including the new reasoning configurations.
    *   **Code Documentation:** Improve inline comments and ensure component props are well-documented.

---

## Phase 2: Power User Features & Customization (Q4 2024 - Q1 2025)

**Goal:** Empower users with more control, better organization, deeper analytical capabilities, and advanced TTS options.

*   **Advanced Stream Control:**
    *   **Negative Prompts:** Allow users to specify topics or keywords to exclude from updates.
    *   **Source Prioritization/Filtering (Concept):** Explore ways for users to indicate preferred types of sources.
    *   **Update Comparison (Basic):** Highlight differences or new sections in an update.
*   **Organization & Management:**
    *   **Stream Tagging/Categorization:** Allow users to tag or group streams into folders.
    *   **Bulk Actions:** Enable selecting multiple streams/updates for actions.
*   **Content Interaction & TTS:**
    *   **Improved Markdown Export:** Ensure exported Markdown is highly compatible.
    *   **Export to PDF (Client-Side):** Implement "Print to PDF" or client-side PDF generation.
    *   **Annotation/Notes (Local):** Allow users to add personal notes to updates.
    *   **Advanced TTS Options:**
        *   Explore richer voice selection.
        *   Client-side caching of generated TTS audio.
        *   Persist user's preferred playback speed.
*   **Visualizations:**
    *   **Token Usage Stats:** Display estimated token usage per update and total.
    *   **Update Frequency Chart:** Basic visualization of update fetching.
*   **Performance:**
    *   **Long List Optimization:** Implement virtualization for stream update list and sidebar.

---

## Phase 3: Collaboration & Ecosystem Integration (Q2 2025 - Q4 2025)

**Goal:** Expand beyond individual use, enabling sharing and integration with other tools. (This phase likely requires a backend component).

*   **Optional Cloud Sync & Backup:**
    *   User accounts for syncing streams, updates, and preferences.
    *   Secure cloud backup and restore.
*   **Sharing & Collaboration (Read-Only First):**
    *   Allow users to share a read-only link to a stream or update.
    *   Explore concepts for collaborative stream building.
*   **Expanded Export/Import:**
    *   Integration with note-taking apps.
    *   OPML export for stream lists.
*   **Community Features (Conceptual):**
    *   A way to share and discover effective focus prompt templates.
*   **API for Power Users (Conceptual):**
    *   Allow programmatic interaction if a backend is established.

---

## Future Exploration (Beyond 2025)

**Goal:** Push the boundaries of intelligent information tracking.

*   **AI-Powered Insights:**
    *   Automatic sub-topic identification.
    *   Trend analysis based on stream content.
    *   AI-generated summaries *of entire streams*.
*   **Multi-Modal Support (TTS is the first step):** Explore support for summarizing or tracking topics involving images, videos, or other audio inputs.
*   **Plugin Architecture:** Allow third-party developers to extend functionality.
*   **Deeper Personalization:** AI that learns user preferences.

---

*This roadmap is a living document and will be updated based on user feedback, technological advancements, and project priorities.*
