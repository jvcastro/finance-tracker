"use client";

import {
  DEFAULT_CURRENCY,
  formatCurrency,
  getCurrencySymbol,
} from "@/lib/format";
import { trpc } from "@/lib/trpc/react";

export type CurrencyFormatter = ((amount: number) => string) & {
  code: string;
  symbol: string;
};

export function useCurrencyFormatter(): CurrencyFormatter {
  const { data } = trpc.settings.get.useQuery();
  const code = data?.currency ?? DEFAULT_CURRENCY;
  const format = (amount: number) => formatCurrency(amount, code);
  return Object.assign(format, {
    code,
    symbol: getCurrencySymbol(code),
  });
}
