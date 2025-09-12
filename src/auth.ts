/// <reference types="node" />

import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config'; // Import the base config
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from 'next-auth/adapters';
import { prisma } from '@/lib/prisma';
import type { Session, User as NextAuthUser, NextAuthConfig } from 'next-auth'; // Import NextAuthConfig
import type { JWT } from 'next-auth/jwt';
import bcrypt from 'bcryptjs';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';

// Define a type for the User model fetched from Prisma, including hashedPassword
interface PrismaUser {
  id: string;
  email: string;
  name: string | null;
  hashedPassword: string | null; // Ensure this matches your schema
  // Add other fields if needed by authorize logic
}

// Extend the default Session User type to include id
interface SessionUser extends NextAuthUser {
  id: string;
}

// Extend the default Session type
interface ExtendedSession extends Session {
  user: SessionUser;
}

// Construct the final config object merging base and handler-specific options
const finalAuthConfig: NextAuthConfig = {
  ...authConfig, // Spread base config (pages, authorized callback)
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: 'jwt',
  },
  providers: [ // Define providers fully here
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<NextAuthUser | null> {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials in main handler');
          return null;
        }
        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email: email },
        });

        if (!user) {
          console.log('No user found with email in main handler:', email);
          return null;
        }

        // Assert the type of the fetched user
        const prismaUser = user as PrismaUser;
        const hashedPassword = prismaUser.hashedPassword;
        if (!hashedPassword) {
            console.log('User found but has no valid password set in main handler.');
            return null;
        }

        const isValidPassword = await bcrypt.compare(password, hashedPassword);

        if (!isValidPassword) {
          console.log('Invalid password for user in main handler:', email);
          return null;
        }

        console.log('Credentials authorized in main handler for user:', user.email);
        return { id: user.id, name: user.name, email: user.email };
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHubProvider({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // Keep authorized from authConfig
    authorized: authConfig.callbacks?.authorized,

    // Session and JWT callbacks handle token/session enrichment
    async session({ session, token }: { session: Session; token: JWT }): Promise<ExtendedSession> {
      const extendedSession = session as ExtendedSession;
      if (token?.sub && extendedSession.user) {
        extendedSession.user.id = token.sub;
      }
      return extendedSession;
    },
    async jwt({ token, user }: { token: JWT; user?: NextAuthUser }): Promise<JWT> {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    }
  },
  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};


// Initialize NextAuth and export the auth helper and handlers
export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(finalAuthConfig); // Pass the combined config object
