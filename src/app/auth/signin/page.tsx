'use client';

import { useState, type FormEvent, Suspense } from 'react'; // Import Suspense
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaGoogle, FaGithub } from 'react-icons/fa'; // Import icons

// Define the component logic that uses useSearchParams
function SignInFormContent() { // Renamed inner component
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Get error from query params *inside* the component using the hook
  const initialError = searchParams.get('error');
  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null); // Clear previous errors

    try {
      const result = await signIn('credentials', {
        redirect: false, // Handle redirect manually after checking result
        email: email,
        password: password,
      });

      if (result?.error) {
        console.error('Sign-in error:', result.error);
        // Map common errors to user-friendly messages
        if (result.error === 'CredentialsSignin') {
          setError('Invalid email or password.');
        } else {
          setError(`Sign-in failed: ${result.error}`);
        }
        setIsLoading(false);
      } else if (result?.ok) {
        // Sign-in successful
        console.log('Sign-in successful, redirecting...');
        // Redirect to the page the user was trying to access, or default to '/stories'
        const callbackUrl = searchParams.get('callbackUrl') || '/stories';
        router.push(callbackUrl);
        // No need to setIsLoading(false) as we are navigating away
      } else {
         // Handle unexpected cases where result is ok=false but no error
         setError('An unexpected error occurred during sign-in.');
         setIsLoading(false);
      }
    } catch (err) {
      console.error('Exception during sign-in:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  // Get callbackUrl inside the component
  const callbackUrl = searchParams.get('callbackUrl') || '/stories';

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-200px)]"> {/* Adjust height as needed */}
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Sign In</h2>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Or continue with</span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: callbackUrl })}
            disabled={isLoading}
            className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <FaGoogle className="w-5 h-5 mr-2" />
            Sign in with Google
          </button>
          <button
            type="button"
            onClick={() => signIn('github', { callbackUrl: callbackUrl })}
            disabled={isLoading}
            className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <FaGithub className="w-5 h-5 mr-2" />
            Sign in with GitHub
          </button>
        </div>

         <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              Register here
            </Link>
          </p>
      </div>
    </div>
  );
}

// Wrap the component that uses useSearchParams in Suspense
// This is the default export for the page
export default function SignInPage() {
  // You can add layout or other non-Suspense-dependent elements here if needed
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInFormContent /> {/* Render the component using the hook inside Suspense */}
    </Suspense>
  );
}
