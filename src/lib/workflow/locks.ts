import { Prisma } from "../../../database-starter/generated/prisma/client";

export function isWriteConflict(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 4) return false;
  const value = error as Record<string, unknown>;
  if ([value.code, value.originalCode, value.sqlState].some(code => ["P2034", "40001", "40P01"].includes(String(code)))) return true;
  return [value.meta, value.cause, value.driverAdapterError].some(cause => isWriteConflict(cause, depth + 1));
}

export async function lockIssues(tx: Prisma.TransactionClient, ids: string[]) {
  const unique = [...new Set(ids.map(id => id.toLowerCase()))].sort();
  await tx.$queryRaw`SELECT id FROM "Issue" WHERE id IN (${Prisma.join(unique.map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
}

// With event-count versions, a merge must also write the Issue row so a waiter
// using an older Serializable snapshot gets a conflict instead of stale graph data.
export async function touchIssue(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`UPDATE "Issue" SET status = status WHERE id = ${id}::uuid`;
}
