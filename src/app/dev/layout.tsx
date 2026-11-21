import "../globals.css";

// The original local DB check remains outside localized product routes.
export default function DevelopmentLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}
