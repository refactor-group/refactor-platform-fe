import { NextRequest, NextResponse } from "next/server";

// 1. Specify protected and public routes
const protectedRoutes = [
  "/dashboard",
  "/coaching-sessions",
  "/settings",
  "/profile",
];
const publicRoutes = ["/"];

export default async function middleware(req: NextRequest) {
  // 2. Check if the current route is protected or public
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.includes(path);
  const isPublicRoute = publicRoutes.includes(path);

  // 3. Decrypt the session from the cookie
  const sessionCookie = req.cookies.get("id");
  let session = sessionCookie?.value;

  // 4. Redirect to / if the user is not authenticated
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // 5. Redirect to /dashboard if the user is authenticated
  if (
    isPublicRoute &&
    session &&
    !req.nextUrl.pathname.startsWith("/dashboard")
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

// Routes Middleware should not run on
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
