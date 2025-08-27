// middleware.ts - Fixed route matching
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define which routes are public (don't require authentication)
const isPublicRoute = createRouteMatcher([
  '/',               // Home page 
  '/sign-in(.*)',    // Sign-in page and ALL sub-routes (this is key!)
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect all routes that aren't public
  if (!isPublicRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      // Redirect to sign-in if not authenticated
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};