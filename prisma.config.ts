import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Default allows `pnpm install` / `prisma generate` before `.env` exists; copy `.env.example` for local DB.
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
