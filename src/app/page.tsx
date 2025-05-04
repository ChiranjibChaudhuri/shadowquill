import Link from 'next/link';
import { BookOpen, Globe, Users, ListTree, Feather } from 'lucide-react'; // Import icons

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] px-4 py-12 md:py-20"> {/* Adjusted padding */}

      {/* Hero Section */}
      <div className="w-full max-w-4xl text-center mb-16 md:mb-20">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 text-transparent bg-clip-text">
          Unleash Your Story with Shadowquill
        </h1>
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
          Your AI co-author for crafting immersive worlds, compelling characters, intricate plots, and captivating chapters. Let your imagination flow, powered by cutting-edge AI.
        </p>
        <Link href="/stories" className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors shadow-lg hover:shadow-xl">
            Start Writing Now
        </Link>
      </div>

      {/* Features/Stages Section */}
      <div className="w-full max-w-6xl">
        <h2 className="text-3xl font-bold text-center mb-10 md:mb-12">The Writer`&apos;s Journey</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {/* Card for Story Management */}
          <StageCard
            href="/stories"
            title="My Stories"
            description="Organize your projects, create new tales, and pick up where you left off."
            Icon={BookOpen}
            iconColor="text-blue-500"
          />
          {/* Card for Stage 1: World Building */}
          <StageCard
            href="/world"
            title="1. World Building"
            description="Forge unique settings, establish rules, and breathe life into your narrative's backdrop."
            Icon={Globe}
            iconColor="text-green-500"
          />
          {/* Card for Stage 2: Character Creation */}
          <StageCard
            href="/characters"
            title="2. Character Creation"
            description="Design memorable characters with rich histories, distinct personalities, and driving motivations."
            Icon={Users}
            iconColor="text-yellow-500"
          />
          {/* Card for Stage 3: Outline Generation */}
          <StageCard
            href="/outline"
            title="3. Outline Generation"
            description="Architect your plot with a detailed, AI-assisted chapter-by-chapter structure."
            Icon={ListTree}
            iconColor="text-red-500"
          />
          {/* Card for Stage 4: Write Chapters */}
          <StageCard
            href="/write"
            title="4. Write Chapters"
            description="Generate compelling prose scene-by-scene or chapter-by-chapter, guided by your outline."
            Icon={Feather}
            iconColor="text-indigo-500"
          />
        </div>
      </div>
    </div>
  );
}

// Updated StageCard component with Icon support
interface StageCardProps {
  href: string;
  title: string;
  description: string;
  Icon: React.ElementType; // Accept Lucide icon component
  iconColor: string; // Tailwind color class for the icon
}

const StageCard: React.FC<StageCardProps> = ({ href, title, description, Icon, iconColor }) => {
  return (
    <Link href={href} className="group block p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md hover:shadow-xl hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-300 transform hover:-translate-y-1">
        <div className="flex items-center mb-3">
            <Icon className={`h-7 w-7 mr-3 ${iconColor} transition-colors group-hover:scale-110`} />
            <h5 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{title}</h5>
        </div>
        <p className="font-normal text-gray-600 dark:text-gray-400 text-sm">{description}</p>
    </Link>
  );
};
