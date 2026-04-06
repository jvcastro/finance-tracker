import { AppLogo } from "@/components/app-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center p-4">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <AppLogo size={40} />
        <div>
          <p className="text-lg font-semibold tracking-tight">Finance Tracker</p>
          <p className="text-muted-foreground text-sm">Sign in to continue</p>
        </div>
      </div>
      {children}
    </div>
  );
}
