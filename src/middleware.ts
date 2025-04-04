/// <reference types="node" />

// src/middleware.ts
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt'; // Use getToken
import type { NextRequest } from 'next/server';

// Add routes you want to protect here
const protectedRoutes = ['/stories', '/world', '/characters', '/outline', '/write'];

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    // Get the session token using getToken
    const token = await getToken({ req, secret: process.env.AUTH_SECRET });

    // If no token (not logged in), redirect to sign-in page
    if (!token) {
      const signInUrl = new URL('/auth/signin', req.url);
      signInUrl.searchParams.set('callbackUrl', pathname); // Add callbackUrl
      console.log(`Middleware: No token found for protected route ${pathname}. Redirecting to signin.`);
      return NextResponse.redirect(signInUrl);
    }
    // console.log(`Middleware: Token found for protected route ${pathname}. Allowing access.`);
  }

  // Allow access for non-protected routes or authenticated users on protected routes
  return NextResponse.next();
}

// Matcher configuration remains the same, targeting specific pages/routes
export const config = {
  matcher: [
     '/stories/:path*',
     '/world/:path*',
     '/characters/:path*',
     '/outline/:path*',
     '/write/:path*',
     // Add other specific routes to protect here
     // Exclude API, static files, auth routes etc. using negative lookaheads if needed,
     // but explicitly listing protected routes is often clearer.
  ],
};
