import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../database-starter/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { vastfixPrisma?: PrismaClient };

// Lazy initialization lets the app build without connecting to a database.
// Reuse a client during development so hot reload does not create extra pools.
export function getDb() {
  if (globalForPrisma.vastfixPrisma) return globalForPrisma.vastfixPrisma;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is missing");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
  globalForPrisma.vastfixPrisma = client;
  return client;
}
