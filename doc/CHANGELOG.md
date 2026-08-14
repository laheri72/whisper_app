# Changelog

All notable changes to the **Academic Quran Portal** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to Semantic Versioning.

---

## [v2.0.0] - 2026-08-10

### [Added]
* **Dynamic Student Authentication & Onboarding**:
  * Implemented client-side toggle states in `Login.jsx` to dynamically switch layout forms between "Sign In" and "Register Now".
  * Integrated an onboarding flow that intercepts first-time authenticated users using an `is_first_login` flag and displays a display name setup modal.
  * Added clean JSON response communication between the frontend client and backend API.
* **Advanced Audio Recitation Suite (`TilawatTab.jsx`)**:
  * Added **Playback Speed** cycler button allowing students to play recitation audio at `0.75x`, `1.0x`, `1.25x`, `1.5x`, and `2.0x` speeds.
  * Added **Loop Ayah** toggle switch to repeat single tracks indefinitely.
  * Added **Auto Next** pill toggle switch for continuous playback.
* **Intelligent Juz-Wise Page Mapping**:
  * Incorporated complex Juz-wise math logic to automatically map Quran Juz `1` through `30` to their exact start and end pages, aligning dropdown jumps with publisher standards.
* **Batch-Processed Voice Testing (`TasmeeTab.jsx` & `IkhtebaarTab.jsx`)**:
  * Added a batch-processed recording feature ("record all then send" mechanism) that collects full oral recitations locally before invoking transcription APIs, replacing the previous continuous-stream microphone bugs.

### [Changed]
* **Modernized System Architecture**:
  * Migrated the application frontend from a legacy multi-page Jinja2 HTML layout to a single-page React, Vite, and Tailwind CSS SPA (Single Page Application).
  * Shifted routing responsibilities from backend redirect responses to dynamic, stateful rendering components in React.
* **Tailwind CSS Light/Dark Theme Standardization**:
  * Rewrote layout structures (Sidebar, Header, Main Content, User Inspector) to follow Tailwind's class-based theming guidelines.
  * Refactored default utility classes to represent Light Theme styles, while applying Dark Theme overrides under the `dark:` variant namespace (e.g. `bg-slate-50 dark:bg-slate-950`).
  * Wired up root DOM mutations (`document.documentElement.classList`) inside `App.jsx` to synchronize transitions, saving user configurations in `localStorage`.

### [Fixed]
* **Asynchronous Auto-Next Page Turning Delay**:
  * Resolved a severe playback error where the audio player would crash or stop when advancing beyond page boundaries.
  * Introduced a `pendingAutoPlay` state variable and a `useEffect` hook listening to `[mappedBoxes, pendingAutoPlay]`. The system now correctly waits for new page structural coordinates to load from the database before initiating playback for the first Ayah of the new page.
* **Manuscript Image Visibility & Bounding Boxes Alignment**:
  * Fixed an issue where the background Quran manuscript image was completely invisible. Loaded the page base64 string directly from `/data/quran_data.json` instead of fetching non-existent static page files.
  * Added a `getFormattedImageSrc` utility to verify and format raw image strings with appropriate MIME-type data prefixes.
  * Captures the `naturalWidth` and `naturalHeight` of the image via the `onLoad` event handler. The absolute positioned bounding box button overlays are calculated as dynamic percentage-based coordinates ($left, top, width, height$), ensuring exact alignment on top of the text lines across all screen resolutions and responsive layouts.
* **FastAPI Server Startup Unicode Errors**:
  * Fixed a Windows console encoding startup crash in `main.py` caused by python standard output streams trying to output emoji characters (`🚀`, `❌`). Removed emojis from all backend `print()` calls to avoid CP-1256 Unicode encoding errors.
