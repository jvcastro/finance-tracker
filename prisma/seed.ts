import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

import { ensureDefaultTagsForUser } from "../lib/default-tags";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for prisma db seed");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    await ensureDefaultTagsForUser(prisma, u.id);
  }
  console.log(
    `Ensured default tags (groceries, housing, credit card, etc.) for ${users.length} user(s).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
