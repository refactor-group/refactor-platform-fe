import { NextRequest, NextResponse } from "next/server";
import { createLoginUrlWithCallback } from "@/lib/utils/redirect";

// 1. Specify protected and public routes
const protectedRoutes = [
  "/dashboard",
  "/coaching-sessions",
  "/settings",
  "/profile",
  "/members",
  "/organizations"
];

// Routes accessible to everyone (landing page)
const publicRoutes = ["/"];

// Auth routes redirect authenticated users to dashboard
const authRoutes = ["/login"];

export async function proxy(req: NextRequest) {
  // 2. Check if the current route is protected, public, or an auth route
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) =>
    path.startsWith(route)
  );
  const isPublicRoute = publicRoutes.some((route) => path === route);
  const isAuthRoute = authRoutes.some((route) => path === route);

  // 3. Get the session cookie - we only check for existence since the cookie is
  // http-only and managed by the backend. If it exists and is invalid, the backend
  // API calls will fail and trigger a logout.
  const sessionCookie = req.cookies.get("id");
  const isValidSession = !!sessionCookie;

  // 4. Redirect to /login with callback URL if the user is not authenticated
  if (isProtectedRoute && !isValidSession) {
    // Preserve the original path as callback URL for post-login redirect
    const callbackUrl = req.nextUrl.pathname + req.nextUrl.search;
    const loginUrl = createLoginUrlWithCallback(callbackUrl);
    return NextResponse.redirect(new URL(loginUrl, req.nextUrl));
  }

  // 5. Redirect authenticated users from /login to /dashboard
  if (isAuthRoute && isValidSession) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // 6. Public routes (landing page) are accessible regardless of auth state
  if (isPublicRoute) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Routes proxy should not run on
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
