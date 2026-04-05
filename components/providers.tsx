"use client";

import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TRPCProvider } from "@/lib/trpc/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TRPCProvider>
        <NuqsAdapter>
          <ThemeProvider>
            {children}
            <Toaster richColors position="top-center" />
          </ThemeProvider>
        </NuqsAdapter>
      </TRPCProvider>
    </SessionProvider>
  );
}
