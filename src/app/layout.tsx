import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WEMIX TOWER RUN — Balance Challenge",
  description: "위메이드플레이 · 애니팡 프렌즈와 함께하는 밸런스 러너. Next.js + Tailwind CSS.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
