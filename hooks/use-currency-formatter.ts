"use client";

import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc/react";

export function useCurrencyFormatter() {
  const { data } = trpc.settings.get.useQuery();
  const currency = data?.currency ?? "USD";
  return (amount: number) => formatCurrency(amount, currency);
}
