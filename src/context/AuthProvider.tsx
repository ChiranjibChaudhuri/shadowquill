'use client'; // This component uses client-side context

import { SessionProvider } from 'next-auth/react';
import React from 'react';
import type { Session } from 'next-auth'; // Import Session type

interface AuthProviderProps {
  children: React.ReactNode;
  // Session is optional because it might not be available server-side initially
  session?: Session | null; // Use Session type from next-auth, allow null
}

export default function AuthProvider({ children, session }: AuthProviderProps) {
  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  );
}
