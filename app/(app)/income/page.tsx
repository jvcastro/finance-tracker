import { Suspense } from "react";

import { IncomePage } from "@/components/income/income-page";
import { Skeleton } from "@/components/ui/skeleton";

function IncomePageFallback() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-2 h-4 w-full max-w-lg" />
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<IncomePageFallback />}>
      <IncomePage />
    </Suspense>
  );
}
