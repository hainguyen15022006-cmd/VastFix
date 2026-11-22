import type { NextRequest } from "next/server";
import { ApiError } from "./api";

// Optional presentation preference; never changes stored user descriptions.
export function requestLocale(request: NextRequest, fallback: string): "vi" | "en" {
  const locale = request.nextUrl.searchParams.get("locale");
  if (locale !== null && locale !== "vi" && locale !== "en") {
    throw new ApiError(400, "BAD_REQUEST", "Ngôn ngữ không hợp lệ");
  }
  return locale ?? (fallback === "en" ? "en" : "vi");
}
