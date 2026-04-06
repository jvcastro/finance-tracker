"use client";

import { TRPCLink, isTRPCClientError } from "@trpc/client";
import type { QueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { observable } from "@trpc/server/observable";

import type { AppRouter } from "@/server/routers/_app";

function loginCallbackUrl(): string {
  if (typeof window === "undefined") return "/login";
  const returnTo = `${window.location.pathname}${window.location.search}`;
  return `/login?callbackUrl=${encodeURIComponent(returnTo)}`;
}

/**
 * Clears React Query cache and signs out when the API reports no valid session.
 */
export function createUnauthorizedLink(
  queryClient: QueryClient,
): TRPCLink<AppRouter> {
  return () => {
    return ({ next, op }) => {
      return observable((observer) => {
        return next(op).subscribe({
          next(value) {
            observer.next(value);
          },
          error(err) {
            if (isTRPCClientError(err) && err.data?.code === "UNAUTHORIZED") {
              queryClient.clear();
              void signOut({ callbackUrl: loginCallbackUrl() });
            }
            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        });
      });
    };
  };
}
