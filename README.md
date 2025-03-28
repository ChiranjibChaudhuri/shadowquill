# Shadowquill - AI Book Writer

Shadowquill is a web application designed to assist authors in the creative process of writing books, leveraging the power of generative AI. It guides users through structured stages, from initial world-building and character development to outlining and drafting chapters.

Built with Next.js, React, TypeScript, and Tailwind CSS, Shadowquill provides an interactive and streamlined experience for bringing stories to life.

## Features

*   **Guided Writing Process:** Follows a step-by-step workflow:
    *   **World Building:** Define the setting, rules, history, and atmosphere of your story's world through an interactive chat interface.
    *   **Character Creation:** Develop compelling characters, outlining their backstories, motivations, appearances, and relationships via chat.
    *   **Outline Generation:** Create a structured plot outline, breaking down the story into acts, chapters, and key scenes based on your world and characters.
    *   **Chapter/Scene Writing:** Generate draft content for individual chapters or scenes based on the established outline, world, and character details.
*   **Interactive AI Chat:** Utilizes large language models (like Google Gemini) via dedicated chat interfaces for each stage, allowing for dynamic brainstorming and content generation.
*   **Streaming Responses:** Provides real-time feedback and content generation using streaming technology.
*   **Content Management:** Allows users to review, edit, and save the generated content (world description, character profiles, outline, chapters) at each stage.
*   **Modern Tech Stack:** Built with robust and popular web technologies for a performant and maintainable application.

## Technology Stack

*   **Framework:** [Next.js](https://nextjs.org/) (React Framework)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **AI Integration:** Google Gemini API (or other configurable LLM)
*   **API Communication:** Next.js API Routes, Server-Sent Events (SSE) / Streaming
*   **State Management:** (To be determined - e.g., React Context, Zustand)

## Project Structure (Illustrative)

```
.
├── public/             # Static assets
├── src/
│   ├── app/            # Next.js App Router
│   │   ├── api/        # API Routes
│   │   │   └── ai-writer/
│   │   │       ├── world/
│   │   │       ├── characters/
│   │   │       ├── outline/
│   │   │       └── chapter/
│   │   ├── (stages)/   # UI Routes/Components for each writing stage
│   │   ├── layout.tsx  # Root layout
│   │   └── page.tsx    # Home page
│   ├── components/     # Reusable UI components (e.g., ChatInterface)
│   ├── lib/            # Utility functions, AI client setup
│   ├── prompts/        # AI prompt templates
│   └── styles/         # Global styles (if needed beyond Tailwind)
├── .env.local          # Environment variables (API Keys)
├── next.config.ts      # Next.js configuration
├── tailwind.config.ts  # Tailwind CSS configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Project dependencies
```

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn
*   Access to a Generative AI API (e.g., Google AI Studio for a Gemini API Key)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd shadowquill
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Set up environment variables:**
    *   Create a file named `.env.local` in the root directory.
    *   Add your AI API key:
        ```
        GOOGLE_API_KEY=YOUR_API_KEY_HERE
        ```
4.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

Navigate through the application's stages:

1.  **World Building:** Start by defining your story's world. Engage with the AI chat to flesh out details. Save the final description.
2.  **Character Creation:** Create your main characters, interacting with the AI to explore their traits and backstories. Save the character profiles.
3.  **Outline:** Develop a plot outline based on your world and characters. Use the chat to structure your story. Save the outline.
4.  **Write:** Generate draft content for chapters or scenes using the previously defined elements.

*(Further details on specific interactions and features will be added as development progresses.)*

## Contributing

Contributions are welcome! Please follow standard Git workflow (fork, branch, pull request).

*(Contribution guidelines to be added)*

## License

*(License information to be added)*
