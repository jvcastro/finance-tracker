import { z } from "zod";

export const FINANCIAL_ACCOUNT_KIND_VALUES = [
  "SAVINGS",
  "CHECKING",
  "CREDIT_CARD",
  "E_WALLET",
  "CASH",
] as const;

export type FinancialAccountKindValue =
  (typeof FINANCIAL_ACCOUNT_KIND_VALUES)[number];

export const FINANCIAL_ACCOUNT_KIND_LABEL: Record<
  FinancialAccountKindValue,
  string
> = {
  SAVINGS: "Savings",
  CHECKING: "Checking",
  CREDIT_CARD: "Credit card",
  E_WALLET: "E-wallet",
  CASH: "Cash",
};

export const financialAccountKindSchema = z.enum(FINANCIAL_ACCOUNT_KIND_VALUES);
