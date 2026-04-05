import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

function LoginFallback() {
  return (
    <div className="bg-card text-muted-foreground w-full max-w-sm rounded-lg border p-8 text-center text-sm">
      Loading…
    </div>
  );
}

export default function LoginPage() {
  const googleEnabled =
    Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET);

  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
