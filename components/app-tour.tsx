"use client";

import "driver.js/dist/driver.css";

import { driver } from "driver.js";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { trpc } from "@/lib/trpc/react";

const PENDING_SETTINGS_KEY = "appTourPendingSettings";

export function AppTour() {
  const { status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const utils = trpc.useUtils();

  const skipIntroCompleteRef = React.useRef(false);
  const introDriverRef = React.useRef<ReturnType<typeof driver> | null>(null);

  const skipSettingsCompleteRef = React.useRef(false);
  const settingsDriverRef = React.useRef<ReturnType<typeof driver> | null>(null);

  const { data: settings } = trpc.settings.get.useQuery(undefined, {
    enabled: status === "authenticated",
  });

  const completeTour = trpc.settings.completeAppTour.useMutation({
    onSuccess: () => {
      void utils.settings.get.invalidate();
    },
  });

  const mutateComplete = completeTour.mutate;

  React.useEffect(() => {
    if (status !== "authenticated") return;
    if (!settings || settings.completedAppTour) return;
    if (pathname !== "/") return;

    const timer = window.setTimeout(() => {
      const drv = driver({
        showProgress: true,
        smoothScroll: true,
        allowClose: true,
        nextBtnText: "Next",
        doneBtnText: "Done",
        onDestroyed: () => {
          introDriverRef.current = null;
          if (skipIntroCompleteRef.current) return;
          if (
            typeof window !== "undefined" &&
            sessionStorage.getItem(PENDING_SETTINGS_KEY) === "1"
          ) {
            sessionStorage.removeItem(PENDING_SETTINGS_KEY);
            return;
          }
          mutateComplete();
        },
        steps: [
          {
            element: "body",
            popover: {
              title: "Welcome",
              description:
                "Finance Tracker helps you record income and expenses, see cash flow, and stay on top of spending across your accounts.",
              side: "over",
              align: "center",
            },
          },
          {
            element: () => {
              const mq = window.matchMedia("(min-width: 768px)");
              const sel = mq.matches
                ? '[data-tour="app-nav-desktop"]'
                : '[data-tour="app-nav-mobile"]';
              return document.querySelector(sel) ?? document.body;
            },
            popover: {
              title: "Navigate the app",
              description:
                "Use the sidebar on desktop or the bottom bar on mobile to switch between Dashboard, Income, Expenses, and Settings.",
              side: "right",
              align: "start",
            },
          },
          {
            element: '[data-tour="dashboard-hero"]',
            popover: {
              title: "Dashboard",
              description:
                "This overview shows cash flow, recent activity, and quick insight into the current month.",
              side: "bottom",
            },
          },
          {
            element: '[data-tour="dashboard-hero"]',
            popover: {
              title: "Accounts & tags",
              description:
                "Next, open Settings to add your accounts and tags so you can categorize income and expenses.",
              doneBtnText: "Open Settings",
              onNextClick: (_el, _step, { driver: d }) => {
                sessionStorage.setItem(PENDING_SETTINGS_KEY, "1");
                d.destroy();
                router.push("/settings?tour=setup");
              },
            },
          },
        ],
      });
      introDriverRef.current = drv;
      drv.drive();
    }, 700);

    return () => {
      window.clearTimeout(timer);
      if (introDriverRef.current) {
        skipIntroCompleteRef.current = true;
        introDriverRef.current.destroy();
        introDriverRef.current = null;
        skipIntroCompleteRef.current = false;
      }
    };
  }, [status, pathname, settings, mutateComplete, router]);

  const tourSetup = searchParams.get("tour") === "setup";

  React.useEffect(() => {
    if (status !== "authenticated") return;
    if (!settings || settings.completedAppTour) return;
    if (pathname !== "/settings" || !tourSetup) return;

    const timer = window.setTimeout(() => {
      const drv = driver({
        showProgress: true,
        smoothScroll: true,
        allowClose: true,
        nextBtnText: "Next",
        doneBtnText: "Done",
        onDestroyed: () => {
          settingsDriverRef.current = null;
          if (skipSettingsCompleteRef.current) return;
          mutateComplete();
          router.replace("/settings");
        },
        steps: [
          {
            element: '[data-tour="settings-accounts"]',
            popover: {
              title: "Accounts",
              description:
                "Add checking, savings, credit cards, e-wallets, or cash. Link them when you record income or expenses.",
              side: "bottom",
            },
          },
          {
            element: '[data-tour="settings-tags"]',
            popover: {
              title: "Tags",
              description:
                "Create tags like Groceries or Utilities to categorize transactions. You can edit them anytime.",
              side: "top",
            },
          },
        ],
      });
      settingsDriverRef.current = drv;
      drv.drive();
    }, 500);

    return () => {
      window.clearTimeout(timer);
      if (settingsDriverRef.current) {
        skipSettingsCompleteRef.current = true;
        settingsDriverRef.current.destroy();
        settingsDriverRef.current = null;
        skipSettingsCompleteRef.current = false;
      }
    };
  }, [status, pathname, tourSetup, settings, mutateComplete, router]);

  return null;
}
