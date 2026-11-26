import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { currentUser } from "@/lib/current-user";
import { requirePhotoOrigin, uploadForm } from "@/lib/photo-http";
import { uploadPhoto } from "@/lib/photo-service";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handle(async requestId => {
    const actor = await currentUser(request);
    requirePhotoOrigin(request);
    const { file, purpose, issueId } = await uploadForm(request);
    const photo = await uploadPhoto(actor, purpose, issueId, file);
    return json({ photo, requestId }, 201);
  });
}
