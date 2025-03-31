# Shadowquill - AI Book Writing Assistant

Shadowquill is a web application designed to assist authors in the creative process of writing a book, leveraging AI for brainstorming, generation, and refinement across different stages.

![Shadowquill Logo](public/shadowquill-logo.svg)

## Features

*   **Multi-Story Management:** Organize and work on multiple writing projects simultaneously.
*   **Staged Workflow:** Guides users through a structured writing process:
    *   **World Building:** Define settings, rules, and atmosphere with AI brainstorming.
    *   **Character Creation:** Develop detailed characters within the established world context.
    *   **Outline Generation:** Structure the plot with an AI-assisted chapter-by-chapter outline.
    *   **Chapter Writing:** Generate chapter content scene-by-scene or as a whole, based on the outline and defined scenes.
*   **AI Integration:** Utilizes Google Gemini models via the Vercel AI SDK for content generation and brainstorming.
*   **Persistence:** Saves story progress (world, characters, outline, chapters, scenes) locally using the browser's `localStorage` and saves generated artifacts as Markdown files on the server within story-specific directories.
*   **Manuscript Compilation:** Compiles individual chapter files into a single Markdown manuscript for the selected story.

## Tech Stack

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **AI:** Vercel AI SDK, Google Gemini
*   **Icons:** Lucide React

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm (usually comes with Node.js) or pnpm (recommended, install via `npm install -g pnpm`)
*   Google Cloud Project with Generative AI API enabled.
*   Google API Key

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ChiranjibChaudhuri/shadowquill.git
    cd shadowquill
    ```
2.  **Install dependencies:**
    ```bash
    pnpm install
    # or
    # npm install
    ```
3.  **Set up environment variables:**
    *   Create a file named `.env.local` in the root directory.
    *   Add your Google API key:
        ```
        GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY_HERE
        ```
    *   *(Optional: If implementing Google OAuth)* Add OAuth credentials and a secret:
        ```
        GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
        GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
        AUTH_SECRET=YOUR_GENERATED_AUTH_SECRET # Generate with 'openssl rand -base64 32'
        ```
4.  **Run the development server:**
    ```bash
    pnpm dev
    # or
    # npm run dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

*   `src/app/`: Main application routes (App Router).
    *   `page.tsx`: Homepage.
    *   `layout.tsx`: Root layout, includes header/footer and context providers.
    *   `stories/page.tsx`: Story management page.
    *   `(stages)/`: Directory group for the main writing stages (world, characters, etc.).
    *   `api/`: Backend API routes.
        *   `ai-writer/`: Routes for AI generation (chat, finalize, chapter, scene).
        *   `save-file/`: Route for saving generated content to files.
        *   `read-story-file/`: Route for reading saved content files.
        *   `compile-book/`: Route for compiling chapters into a manuscript.
        *   `create-story-directory/`: Route for creating story directories.
*   `src/components/`: Reusable React components (e.g., `ChatInterface`, `StageLayout`).
*   `src/context/`: React Context providers (e.g., `StoryContext`).
*   `src/lib/`: Utility functions and constants (e.g., `prompts.ts`).
*   `public/`: Static assets.
    *   `ai-writer-output/`: Default directory for saved story files (organized by story ID).

## Contributing

Contributions are welcome! If you'd like to contribute, please follow these steps:

1.  **Fork the repository.**
2.  **Create a new branch** for your feature or bug fix (`git checkout -b feature/your-feature-name` or `git checkout -b fix/your-bug-fix`).
3.  **Make your changes.**
4.  **Commit your changes** with clear, descriptive messages.
5.  **Push your branch** to your fork (`git push origin feature/your-feature-name`).
6.  **Open a Pull Request** against the `main` branch of the original repository.

Please ensure your code adheres to the existing style and includes relevant updates if necessary.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

*Happy Writing!*
