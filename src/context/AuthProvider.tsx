'use client'; // This component uses client-side context

import { SessionProvider } from 'next-auth/react';
import React from 'react';

interface AuthProviderProps {
  children: React.ReactNode;
  // Session is optional because it might not be available server-side initially
  session?: any; // Use 'any' for now, can be refined if needed
}

export default function AuthProvider({ children, session }: AuthProviderProps) {
  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  );
}
