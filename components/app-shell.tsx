"use client"

import {
  IconLayoutDashboard,
  IconSettings,
  IconTrendingDown,
  IconTrendingUp,
  IconUser,
} from "@tabler/icons-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { ScrollArea } from "@/components/ui/scroll-area"
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter"
import { cn } from "@/lib/utils"

const nav = [
  {
    href: "/",
    label: "Dashboard",
    shortLabel: "Home",
    icon: IconLayoutDashboard,
  },
  {
    href: "/income",
    label: "Income",
    shortLabel: "Income",
    icon: IconTrendingUp,
  },
  {
    href: "/expenses",
    label: "Expenses",
    shortLabel: "Spend",
    icon: IconTrendingDown,
  },
  {
    href: "/settings",
    label: "Settings",
    shortLabel: "Settings",
    icon: IconSettings,
  },
  { href: "/account", label: "Account", shortLabel: "You", icon: IconUser },
] as const

function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void
  className?: string
}) {
  const pathname = usePathname()

  return (
    <nav className={cn("flex flex-col gap-0.5", className)}>
      {nav.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href || (href !== "/" && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed right-0 bottom-0 left-0 z-50 border-t border-border bg-background/95 supports-backdrop-filter:backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Main navigation"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-0 px-1 pt-1">
        {nav.map(({ href, shortLabel, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/" && pathname.startsWith(href))
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[0.625rem] leading-tight font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground active:bg-muted/80"
                )}
              >
                <Icon
                  className={cn(
                    "size-6 shrink-0",
                    active ? "stroke-[2]" : "stroke-[1.5]"
                  )}
                  aria-hidden
                />
                <span className="max-w-full truncate">{shortLabel}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function SidebarBrand() {
  const fmt = useCurrencyFormatter()
  return (
    <div className="flex h-12 flex-col justify-center border-b border-sidebar-border px-3 py-1.5">
      <Link href="/" className="leading-tight font-semibold tracking-tight">
        Finance Tracker
      </Link>
      {/* <p className="text-[0.625rem] font-medium text-muted-foreground tabular-nums">
        {fmt.symbol} {fmt.code}
      </p> */}
    </div>
  )
}

function MobileCurrencyBadge() {
  const fmt = useCurrencyFormatter()
  return (
    <div className="border-b border-border bg-muted/30 px-4 py-1.5 text-center text-[0.625rem] font-medium text-muted-foreground tabular-nums md:hidden">
      {fmt.symbol} {fmt.code}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarBrand />
        <ScrollArea className="flex-1 px-2 py-3">
          <NavLinks />
        </ScrollArea>
        <div className="border-t border-sidebar-border px-3 py-2 text-[0.625rem] text-muted-foreground">
          Press <kbd className="rounded border px-1">d</kbd> for theme
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* <MobileCurrencyBadge /> */}
        <main className="flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          {children}
        </main>

        <MobileBottomNav />
      </div>
    </div>
  )
}
