import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
// Removed adapter/prisma/bcrypt imports

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      // This authorize stub is only for type checking if config is used elsewhere directly.
      // It does NOT run during actual authentication.
      async authorize(credentials) {
        if (credentials?.email && credentials?.password) {
          return { id: "placeholder-id", email: credentials.email as string };
        }
        return null;
      }
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    // Only include callbacks needed by middleware (authorized)
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const protectedRoutes = ['/stories', '/world', '/characters', '/outline', '/write'];
      const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

      if (isProtectedRoute) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        if (pathname.startsWith('/auth/signin') || pathname.startsWith('/auth/register')) {
            return Response.redirect(new URL('/stories', nextUrl));
        }
      }
      return true;
    },
  },
  // Adapter, session strategy, secret, debug are NOT included here - only in main auth.ts
};
