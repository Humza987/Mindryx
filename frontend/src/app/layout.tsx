import { ClerkProvider, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import './globals.css'
import Link from 'next/link'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen">
          {/* Header - shown to both signed in and signed out users */}
          <header className="w-full bg-white shadow-md sticky top-0 z-50">
            <div className="max-w-6xl mx-auto flex justify-between items-center py-4 px-6">
              <Link href="/" className="text-xl font-bold text-gray-900">
                Mindryx - AI Study Platform
              </Link>
              
              <nav className="flex items-center space-x-4 mx-auto">        
                {/* Show different nav items based on auth state */}
                <SignedIn>
                <Link href="/" className="text-gray-700 hover:text-blue-600 transition">
                  Home
                </Link>
                  <Link href="/chatbot" className="text-gray-700 hover:text-blue-600 transition">
                    Local AI Chat
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
                </SignedIn>
              </nav>
              
              {/* Auth buttons */}
              <div className="flex items-center space-x-2">
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
                <SignedOut>
                  <Link 
                    href="/sign-up" 
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    Sign in to Get Started
                  </Link>
                </SignedOut>
              </div>
            </div>
          </header>

          {/* Main content area */}
          <main>
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  )
}