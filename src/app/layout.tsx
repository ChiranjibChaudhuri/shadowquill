'use client'; // Needed for useSession hook in AppHeader

// Keep type import for Metadata if needed elsewhere, but cannot export const metadata here
// import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { StoryProvider } from '@/context/StoryContext';
import AuthProvider from '@/context/AuthProvider';
import { useSession, signOut, signIn } from 'next-auth/react';
import './globals.css';
import React from 'react'; // Ensure React is imported

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Header component with Auth status
const AppHeader = () => {
  const { data: session, status } = useSession(); // Get session status

  const navItems = [
    { href: '/stories', label: 'My Stories' },
    { href: '/world', label: '1. World' },
    { href: '/characters', label: '2. Characters' },
    { href: '/outline', label: '3. Outline' },
    { href: '/write', label: '4. Write' },
  ];

  // Conditionally render nav items based on auth status
  const displayedNavItems = status === 'authenticated' ? navItems : [];

  return (
    <header className="bg-gray-800 text-white p-4 shadow-md sticky top-0 z-10">
      <nav className="container mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
          <img src="/shadowquill-logo.svg" alt="Shadowquill Logo" width={32} height={32} className="inline-block" />
          <span className="text-xl font-bold">Shadowquill</span>
        </Link>
        <div className="flex items-center space-x-4">
          {/* Only show main nav if authenticated */}
          {status === 'authenticated' && (
             <ul className="flex space-x-4">
                {displayedNavItems.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="hover:text-gray-300 px-3 py-2 rounded-md text-sm font-medium">
                        {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
          )}
          {/* Auth Status */}
          <div className="text-sm">
            {status === 'loading' ? (
              <span className="px-3 py-1">Loading...</span>
            ) : session?.user ? (
              <div className="flex items-center space-x-2">
                <span className="hidden sm:inline">{session.user.email}</span>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })} // Sign out and redirect to home
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-xs font-medium"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn()} // Trigger default sign-in flow
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-xs font-medium"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
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
      <head>
         {/* Define metadata directly in head for client components */}
         <title>Shadowquill - AI Book Writer</title>
         <meta name="description" content="AI-assisted book writing application" />
         <link rel="icon" href="/shadowquill-logo.svg" type="image/svg+xml" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen flex flex-col`}
      >
        <AuthProvider> {/* SessionProvider needs to wrap components using useSession */}
          <StoryProvider> {/* StoryProvider can be inside or outside AuthProvider */}
            <AppHeader /> {/* AppHeader uses useSession, so must be inside AuthProvider */}
            <main className="flex-grow container mx-auto px-4 py-8">
              {children}
            </main>
            <footer className="text-center p-4 text-xs text-gray-500">
                Shadowquill &copy; {new Date().getFullYear()}
            </footer>
          </StoryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
