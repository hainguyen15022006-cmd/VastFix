import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "VastFix | Khung ứng dụng",
  description: "Khung ứng dụng VastFix cho Checkpoint 1.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
