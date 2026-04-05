# Finance tracker

Personal finance app: cash flow, income streams with scheduled payment rows, expenses, credit card payments, tags, and settings. Built with Next.js and a type-safe API.

For product behavior and domain rules, see **[CONTEXT.md](./CONTEXT.md)**.

## Stack

- **Framework:** Next.js (App Router), React, TypeScript  
- **API:** tRPC + TanStack Query  
- **Auth:** Auth.js (NextAuth v5) with credentials; optional Google  
- **Data:** Prisma ORM, PostgreSQL (e.g. Neon)  
- **UI:** Tailwind CSS, shadcn/ui, Recharts  

## Prerequisites

- Node.js (LTS recommended)  
- pnpm (see `package.json` `packageManager` if present)  
- A PostgreSQL `DATABASE_URL`  

## Setup

1. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

2. Set `DATABASE_URL` and `AUTH_SECRET` (see `.env.example`).

3. Install and generate the Prisma client:

   ```bash
   pnpm install
   pnpm db:generate
   ```

4. Apply migrations:

   ```bash
   pnpm db:migrate
   ```

   Or use `pnpm db:push` for prototyping without migration history.

5. Run the dev server:

   ```bash
   pnpm dev
   ```

## Scripts

| Command            | Description                |
| ------------------ | -------------------------- |
| `pnpm dev`         | Dev server (Turbopack)     |
| `pnpm build`       | Production build           |
| `pnpm start`       | Start production server    |
| `pnpm typecheck`   | TypeScript check             |
| `pnpm lint`        | ESLint                       |
| `pnpm db:migrate`  | Prisma migrate (dev)         |
| `pnpm db:generate` | Regenerate Prisma client     |
| `pnpm db:studio`   | Prisma Studio                |

## UI components (shadcn)

Add components with:

```bash
npx shadcn@latest add button
```

Imports use the `@/components/ui/...` alias.
