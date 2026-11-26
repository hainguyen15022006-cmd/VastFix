import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { currentUser } from "@/lib/current-user";
import { requirePhotoOrigin } from "@/lib/photo-http";
import { deleteDraftPhoto, readablePhoto } from "@/lib/photo-service";
import { readPhotoFile } from "@/lib/photo-storage";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function serve(request: NextRequest, context: Context, head = false) {
  return handle(async () => {
    const actor = await currentUser(request);
    const { id } = await context.params;
    const photo = await readablePhoto(actor, id);
    const bytes = await readPhotoFile(photo.storageKey, photo.sizeBytes);
    return new Response(head ? null : new Uint8Array(bytes), { headers: {
      "Content-Type": photo.mimeType, "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="photo-${photo.id}.${photo.mimeType === "image/jpeg" ? "jpg" : photo.mimeType.split("/")[1]}"`,
      "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin", "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  });
}

export function GET(request: NextRequest, context: Context) { return serve(request, context); }
export function HEAD(request: NextRequest, context: Context) { return serve(request, context, true); }
export function DELETE(request: NextRequest, context: Context) {
  return handle(async requestId => {
    const actor = await currentUser(request);
    requirePhotoOrigin(request);
    const { id } = await context.params;
    await deleteDraftPhoto(actor, id);
    return json({ deleted: true, requestId });
  });
}
