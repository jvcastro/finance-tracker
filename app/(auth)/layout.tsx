export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <p className="text-lg font-semibold tracking-tight">Finance Tracker</p>
        <p className="text-muted-foreground text-sm">Sign in to continue</p>
      </div>
      {children}
    </div>
  );
}
