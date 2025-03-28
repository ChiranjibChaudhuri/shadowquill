import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link'; // Import Link
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Shadowquill - AI Book Writer', // Updated title
  description: 'AI-assisted book writing application',
};

// Simple Header component with navigation
const AppHeader = () => {
  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/world', label: '1. World' },
    { href: '/characters', label: '2. Characters' },
    { href: '/outline', label: '3. Outline' },
    { href: '/write', label: '4. Write' },
  ];

  return (
    <header className="bg-gray-800 text-white p-4 shadow-md sticky top-0 z-10"> {/* Added sticky header */}
      <nav className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold hover:text-gray-300">
          Shadowquill
        </Link>
        <ul className="flex space-x-4">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">
                  {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Added dark class for potential dark mode styling via Tailwind */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen flex flex-col`}
      >
        <AppHeader /> {/* Add the header */}
        <main className="flex-grow container mx-auto px-4 py-8"> {/* Added container styling to main */}
          {children}
        </main>
        {/* Optional: Add a footer */}
        <footer className="text-center p-4 text-xs text-gray-500">
            Shadowquill &copy; {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
