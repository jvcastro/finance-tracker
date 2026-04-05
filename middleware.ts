import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isSecure = request.nextUrl.protocol === "https:";

  const token = await getToken({
    req: request,
    secret,
    secureCookie: isSecure,
  });

  const isLoggedIn = !!token;

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  const isPublicApi =
    pathname.startsWith("/api/auth") || pathname.startsWith("/api/trpc");

  if (!isLoggedIn && !isAuthPage && !isPublicApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
