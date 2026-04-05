import { Suspense } from "react";

import { ExpensesPage } from "@/components/expenses/expenses-page";
import { Skeleton } from "@/components/ui/skeleton";

function ExpensesPageFallback() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ExpensesPageFallback />}>
      <ExpensesPage />
    </Suspense>
  );
}
