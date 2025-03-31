import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center px-4"> {/* Adjust height based on header/footer */}
      <h1 className="text-4xl font-bold mb-4">Welcome to Shadowquill</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl">
        Your AI-powered assistant for crafting compelling stories. Manage your stories or follow the stages below to build your world, create characters, outline your plot, and write your book.
      </p>

      {/* Adjusted grid to potentially accommodate 5 cards better, or wrap */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 w-full max-w-6xl">
        {/* Added Story Management Card */}
        <StageCard href="/stories" title="My Stories" description="Manage your existing stories or start a new creative journey." />

        <StageCard href="/world" title="1. World Building" description="Define the setting, rules, and atmosphere of your story." />
        <StageCard href="/characters" title="2. Character Creation" description="Develop compelling characters with unique backstories and motivations." />
        <StageCard href="/outline" title="3. Outline Generation" description="Structure your plot with a detailed chapter-by-chapter outline." />
        <StageCard href="/write" title="4. Write Chapters" description="Generate and refine the content for each chapter of your book." />
      </div>

      <p className="mt-12 text-sm text-gray-500">
        Use the navigation bar above to jump between stages. Your progress is saved per story.
      </p>
    </div>
  );
}

// Simple component for stage links on the home page
interface StageCardProps {
  href: string;
  title: string;
  description: string;
}

const StageCard: React.FC<StageCardProps> = ({ href, title, description }) => {
  return (
    <Link href={href} className="block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h5>
        <p className="font-normal text-gray-700 dark:text-gray-400 text-sm">{description}</p>
    </Link>
  );
};
