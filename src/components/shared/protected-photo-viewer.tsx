"use client";

import { useEffect, useState } from "react";
import type { WorkflowPhoto } from "@/lib/manager-workflow";

export function ProtectedPhotoViewer({ photo, alt, loading, unavailable }: { photo: WorkflowPhoto; alt: string; loading: string; unavailable: string }) {
  const [state, setState] = useState<{ url?: string; error?: boolean }>({});
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setState({});
    fetch(photo.url, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("photo unavailable");
        const blob = await response.blob();
        if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type)) throw new Error("unsupported image");
        objectUrl = URL.createObjectURL(blob);
        if (!controller.signal.aborted) setState({ url: objectUrl });
      }).catch(() => { if (!controller.signal.aborted) setState({ error: true }); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo.url]);
  return <figure className="vf-photo">{state.url ? <img src={state.url} alt={alt} /> : <p role={state.error ? "alert" : "status"}>{state.error ? unavailable : loading}</p>}</figure>;
}
