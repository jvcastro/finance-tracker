"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import * as React from "react";

/**
 * When the JWT/session is gone or invalid, NextAuth reports `unauthenticated`.
 * Sign out (clears client state) and send the user to login with a return URL.
 */
export function AuthSessionSync() {
  const { status } = useSession();
  const pathname = usePathname();
  const redirectPendingRef = React.useRef(false);

  React.useEffect(() => {
    if (status === "authenticated") {
      redirectPendingRef.current = false;
    }
    if (status !== "unauthenticated") return;
    const onAuthRoute =
      pathname.startsWith("/login") || pathname.startsWith("/register");
    if (onAuthRoute) return;
    if (redirectPendingRef.current) return;
    redirectPendingRef.current = true;

    const returnTo =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : pathname;
    void signOut({
      callbackUrl: `/login?callbackUrl=${encodeURIComponent(returnTo)}`,
    });
  }, [status, pathname]);

  return null;
}
