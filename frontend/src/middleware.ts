// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define which routes are public (don't require authentication)
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",  // All sign-in routes
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow all public routes to pass through
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // For protected routes, check authentication
  const { userId } = await auth();
  
  if (!userId) {
    // Redirect to sign-in if not authenticated
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  return NextResponse.next();
});

// Simplified matcher - this is the recommended pattern for Clerk
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};