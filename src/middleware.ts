import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "../auth.config";

const { auth } = NextAuth(authConfig);

const publicRoutes = ["/login", "/signup"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isPublic = publicRoutes.includes(nextUrl.pathname);

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Redirect logged-in users away from login/signup
  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
