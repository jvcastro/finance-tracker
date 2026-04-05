import { router } from "@/server/trpc";
import { authRegisterRouter } from "@/server/routers/auth-register";
import { bankRouter } from "@/server/routers/bank";
import { creditCardDebtRouter } from "@/server/routers/credit-card-debt";
import { dashboardRouter } from "@/server/routers/dashboard";
import { expenseRouter } from "@/server/routers/expense";
import { incomeRouter } from "@/server/routers/income";
import { profileRouter } from "@/server/routers/profile";
import { settingsRouter } from "@/server/routers/settings";
import { tagRouter } from "@/server/routers/tag";

export const appRouter = router({
  auth: authRegisterRouter,
  dashboard: dashboardRouter,
  tag: tagRouter,
  bank: bankRouter,
  income: incomeRouter,
  expense: expenseRouter,
  creditCardDebt: creditCardDebtRouter,
  settings: settingsRouter,
  profile: profileRouter,
});

export type AppRouter = typeof appRouter;
