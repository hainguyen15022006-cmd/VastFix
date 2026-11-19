import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale routing only. Authentication and resource authorization belong to the backend.
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api(?:/|$)|dev(?:/|$)|_next|_vercel|.*\\..*).*)"],
};
