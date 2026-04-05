import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Must match prisma/schema.prisma `provider` (postgresql). Use Neon or local Postgres URL.
    url:
      process.env.DATABASE_URL ??
      "postgresql://127.0.0.1:5432/finance_tracker",
  },
});
