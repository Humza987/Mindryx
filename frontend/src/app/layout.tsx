"use client";

import { ClerkProvider, useSession, UserButton } from "@clerk/nextjs";
import SupabaseProvider from "@/utils/supabase-provider";
import "./globals.css";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ClerkProvider>
          <SupabaseProvider>
            <Header />
            <main>{children}</main>
          </SupabaseProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

function Header() {
  const { session } = useSession();
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);

  useEffect(() => {
    setIsSignedIn(!!session);
  }, [session]);

  return (
    <header className="w-full bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex justify-between items-center py-4 px-6">
        <Link href="/" className="text-xl font-bold text-gray-900">
          Mindryx - AI Study Platform
        </Link>

        <nav className="flex items-center space-x-4 mx-auto">
          {isSignedIn ? (
            <>
              <Link href="/" className="text-gray-700 hover:text-blue-600 transition">
                Home
              </Link>
              <Link href="/quiz/new" className="text-gray-700 hover:text-blue-600 transition">
                New Quiz
              </Link>
              <Link href="/outstanding-quizzes" className="text-gray-700 hover:text-blue-600 transition">
                Outstanding Quizzes
              </Link>
              <Link href="/past-quizzes" className="text-gray-700 hover:text-blue-600 transition">
                Past Quizzes
              </Link>
              <Link href="/chatbot" className="text-gray-700 hover:text-blue-600 transition">
                WebLLM AI Chat
              </Link>
              <Link href="/checkout" className="text-gray-700 hover:text-blue-600 transition">
                Pricing
              </Link>
            </>
          ) : null}
        </nav>

        <div className="flex items-center space-x-2">
          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" showName={true} />
          ) : (
            <Link
              href="/sign-up"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Sign in to Get Started
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
