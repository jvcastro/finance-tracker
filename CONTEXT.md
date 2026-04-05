# Finance tracker — product & technical context

This document describes what the app does, how money is modeled, and where the code lives. Use it for onboarding, planning, or AI-assisted work.

## Purpose

A **single-user–scoped** personal finance tool: track **expected and actual income**, **expenses**, **credit card pay-downs**, and see **dashboard** summaries (this month, trends, income outlook). Users authenticate with email/password (and optionally Google).

## High-level features

| Area        | What users do |
| ----------- | ------------- |
| **Dashboard** | Net this month, income vs expenses vs card payments, 6‑month cash flow, 12‑month income outlook, breakdowns, recent income/expense lines. |
| **Income** | Two concepts: **recurring setup (streams)** and **payment records** (one row per expected/actual payday). |
| **Expenses** | Dated spending with optional tags. |
| **Credit card debt** | Record pay-down transfers (from/to labels, date, amount). |
| **Settings** | Currency, week start; **Tags** and **Banks** for organization. |
| **Account / profile** | User profile and account-related UI as implemented. |

## Domain: income (important)

### IncomeStream (recurring setup)

- Describes **what** you expect: amount, **source type** (salary / project / other), optional name, tag, **active period** (`startDate` / optional `endDate`), and **`isActive`**.
- **Does not** by itself appear on the ledger as money received; it drives generation of **Income** rows.
- **Pay timing is not inferred from `startDate`.** Instead:
  - **`paymentDay`** (1–31): calendar day of month for each pay in that month (short months clamp to the last day).
  - **`secondPaymentDay`**: second day in the month for **salary bi-weekly** (e.g. 15 and 30). Required when schedule is bi-weekly; must differ from `paymentDay`.
- **Salary schedule** (`SalaryPaySchedule`): `MONTHLY`, `BI_WEEKLY`, `ONE_OFF` — only applies when `sourceType` is **SALARY**.
- **Amount semantics:** monthly salary = one month’s gross; bi-weekly salary = **one paycheck**; project/other is usually treated as a monthly amount per pay pattern in the UI.

### Income (payment records)

- One row per **payday** (or manual entry): **`scheduledDate`**, **amount**, **`received`** (pending vs received), optional note/tag.
- **From stream:** `incomeStreamId` set; rows are **generated** from the stream’s schedule and payment days.
- **Manual:** no stream; `sourceType` / `sourceName` / optional salary schedule stored on the row for display and breakdowns.
- Unique constraint (when linked to a stream): **`(incomeStreamId, scheduledDate)`** so the same stream does not duplicate the same payday.

### Generating payment rows from streams

- Logic lives in **`lib/income-schedule.ts`** (compute pay dates in a month) and **`lib/income-ensure.ts`** (create missing `Income` rows).
- **Rolling window:** current month plus the next **three** months are ensured automatically when:
  - The **dashboard** summary loads,
  - The **income payment list** loads,
  - A **stream is created or updated**.
- **Per viewed month:** listing payment records also ensures that **calendar month** (for past/future navigation).
- Generation is **idempotent**: existing rows are skipped.

### Schedule behavior (summary)

- **Project / other (no salary schedule):** one pay per overlapping month on `paymentDay`.
- **Salary monthly:** one pay per month on `paymentDay`.
- **Salary bi-weekly:** two pays per month on `paymentDay` and `secondPaymentDay`.
- **Salary one-off:** a **single** pay on the first `paymentDay` on or after `startDate`, within the stream window.

## Other domain models (short)

- **Expense:** dated amount, optional tag/description.
- **CreditCardDebt:** transfer-style entry (from/to text, date, amount, optional note).
- **Tag:** user-scoped labels; used on income streams, income rows, expenses.
- **Bank:** user-defined institutions (metadata).
- **AppSettings:** per-user currency and week start.

## Technical architecture

### Frontend

- **Next.js App Router** under `app/`: `(auth)` for login/register, `(app)` for the shell and main pages (`/`, `/income`, `/expenses`, `/settings`, `/account`).
- **tRPC + TanStack Query** for server state; **`lib/trpc`** for client setup.
- **UI:** `components/ui` (shadcn), feature components under `components/` (e.g. `components/income`, `components/dashboard`).

### Backend

- **tRPC routers** in `server/routers/`; composed in `server/routers/_app.ts` as `appRouter`.
- **Prisma** client output: `generated/prisma` (see `prisma/schema.prisma`).
- **Database:** PostgreSQL (`datasource` in schema).

### API surface (tRPC)

Routers include: `auth`, `dashboard`, `tag`, `bank`, `income` (nested: **`income.stream`**, **`income.record`**), `expense`, `creditCardDebt`, `settings`, `profile`. Income mutations invalidate dashboard/list queries as implemented in the UI.

### Auth

- **Auth.js** (NextAuth v5 beta) with Prisma adapter; session used in tRPC **`protectedProcedure`** for `userId`.

### Environment

See **`.env.example`**: `DATABASE_URL`, `AUTH_SECRET`, optional Google OAuth vars.

## Repo hygiene

- **Migrations:** `prisma/migrations/` — run `pnpm db:migrate` (or deploy with `prisma migrate deploy` in CI/production).
- **Typecheck:** `pnpm typecheck`; **lint:** `pnpm lint`.

## Out of scope / assumptions

- Not multi-tenant beyond per-user data isolation.
- Income “forecast” on the dashboard is **planning math** from streams, not bank reconciliation.
- No built-in cron: materialization of rows happens on **requests** (dashboard / income / stream saves) as described above.
