import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";

// Supplemental read-only catalog; existing v1 report payloads remain unchanged.
export function GET(request: NextRequest) {
  return handle(async requestId => {
    await currentUser(request);
    const [buildings, categories] = await getDb().$transaction([
      getDb().building.findMany({
        orderBy: { code: "asc" },
        select: { id: true, code: true, nameVi: true, nameEn: true, floors: {
          orderBy: { code: "asc" }, select: { id: true, nameVi: true, nameEn: true, areas: {
            orderBy: { code: "asc" }, select: { id: true, nameVi: true, nameEn: true },
          } },
        } },
      }),
      getDb().category.findMany({ orderBy: { code: "asc" }, select: { code: true, nameVi: true, nameEn: true } }),
    ]);
    return json({ buildings, categories, requestId });
  });
}
