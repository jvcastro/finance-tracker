import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for prisma db seed");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

async function main() {
  console.log(
    "Seed skipped: create an account via /register. Optional: set up OAuth in .env.",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
